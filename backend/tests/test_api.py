import uuid
from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.db.session import SessionLocal
from app.models.core import CatalogRawImport, CatalogSnapshot, CatalogValidationRun


def test_health_and_manager_sync():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        body = {
            "device_id": "device-a",
            "mutations": [
                {
                    "id": "manager-a",
                    "device_id": "device-a",
                    "manager_key": "dr-nova",
                    "level": 5,
                    "rank": 1,
                    "promoted": 0,
                    "fragments": 12,
                    "unlocked": True,
                }
            ],
        }
        response = client.post("/api/v1/sync/managers", json=body, headers={"Idempotency-Key": "test-manager-a"})
        assert response.status_code == 200
        assert response.json()[0]["revision"] == 1


def test_catalog_upload_persists_linked_provenance_and_validation():
    suffix = uuid.uuid4().hex
    upload = {
        "source_type": "emulator-capture",
        "source_version": "2026.07.16",
        "source_hash": f"hash-capture-a-{suffix}",
        "release_id": f"release-a-{suffix}",
        "game_version": "4.0.0",
        "capture_schema_version": "capture-v1",
        "capture_engine_version": "mineops-ingest/0.1.0",
        "validation_schema_version": "validation-v1",
        "validation_engine_version": "mineops-ingest/0.1.0",
        "configuration_hash": "config-a",
        "input_hashes": {
            "capture_json": f"hash-capture-a-{suffix}",
            "apk_manifest": f"hash-apk-a-{suffix}",
        },
        "validation_summary": {"accepted": True, "warnings": [], "errors": []},
        "payload": {"managers": [{"id": "nova"}, {"id": "blingsley"}], "version": "4.0.0"},
    }

    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/uploads", json=upload)
        assert response.status_code == 200
        body = response.json()
        assert body["release_id"] == upload["release_id"]
        assert body["raw_import_id"]
        assert body["validation_run_id"]
        assert body["import_status"] == "staged"
        assert body["record_counts"] == {"managers": 2, "version": 1}
        assert body["validation_summary"]["accepted"] is True

        duplicate = client.post(
            "/api/v1/ingestion/uploads",
            json={
                **upload,
                "payload": {"managers": [{"id": "alt"}]},
            },
        )
        assert duplicate.status_code == 200
        assert duplicate.json()["id"] == body["id"]

        conflict = client.post(
            "/api/v1/ingestion/uploads",
            json={
                **upload,
                "source_hash": f"hash-capture-b-{suffix}",
                "payload": {"managers": [{"id": "alt"}]},
            },
        )
        assert conflict.status_code == 409
        assert conflict.json()["detail"]["code"] == "RELEASE_ID_HASH_CONFLICT"

    with SessionLocal() as db:
        snapshot = db.get(CatalogSnapshot, body["id"])
        raw_import = db.get(CatalogRawImport, body["raw_import_id"])
        validation_run = db.get(CatalogValidationRun, body["validation_run_id"])

        assert snapshot is not None
        assert raw_import is not None
        assert validation_run is not None
        assert snapshot.raw_import_id == raw_import.id
        assert snapshot.validation_run_id == validation_run.id
        assert raw_import.input_hashes == {
            "capture_json": f"hash-capture-a-{suffix}",
            "apk_manifest": f"hash-apk-a-{suffix}",
        }
        assert raw_import.object_counts == {"managers": 2, "version": 1}
        assert validation_run.summary["accepted"] is True
        assert validation_run.snapshot_id == snapshot.id


def test_catalog_upload_scrubs_large_artifacts_to_manifest_only():
    suffix = uuid.uuid4().hex
    large_artifact = "A" * (300 * 1024)
    upload = {
        "source_type": "emulator-capture",
        "source_hash": f"hash-capture-artifact-{suffix}",
        "release_id": f"release-artifact-{suffix}",
        "payload": {
            "apk_base64": large_artifact,
            "managers": [{"id": "nova"}],
        },
    }

    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/uploads", json=upload)
        assert response.status_code == 200
        body = response.json()
        assert body["validation_summary"]["artifact_manifest_entries"] == 1
        assert "manifest-only" in body["validation_summary"]["warnings"][0]

    with SessionLocal() as db:
        snapshot = db.get(CatalogSnapshot, body["id"])
        raw_import = db.get(CatalogRawImport, body["raw_import_id"])

        assert snapshot.payload["apk_base64"]["storage"] == "manifest-only"
        assert raw_import.artifact_manifest["apk_base64"]["storage"] == "manifest-only"
        assert raw_import.payload_size_bytes > 300 * 1024


def test_snapshot_status_updates_do_not_mutate_raw_evidence():
    suffix = uuid.uuid4().hex
    upload = {
        "source_type": "emulator-capture",
        "source_hash": f"hash-capture-status-{suffix}",
        "release_id": f"release-status-{suffix}",
        "payload": {"managers": [{"id": "nova"}]},
    }

    with TestClient(app) as client:
        create_response = client.post("/api/v1/ingestion/uploads", json=upload)
        assert create_response.status_code == 200
        body = create_response.json()

        premature_activate = client.post(f"/api/v1/catalog/snapshots/{body['id']}/activate")
        assert premature_activate.status_code == 409

        reviewed = client.post(
            f"/api/v1/catalog/snapshots/{body['id']}/status",
            json={"import_status": "reviewed"},
        )
        assert reviewed.status_code == 200
        assert reviewed.json()["import_status"] == "reviewed"

        published = client.post(
            f"/api/v1/catalog/snapshots/{body['id']}/activate"
        )
        assert published.status_code == 200
        assert published.json()["import_status"] == "published"

        invalid = client.post(
            f"/api/v1/catalog/snapshots/{body['id']}/status",
            json={"import_status": "reviewed"},
        )
        assert invalid.status_code == 409

        direct_status_publish = client.post(
            f"/api/v1/catalog/snapshots/{body['id']}/status",
            json={"import_status": "published"},
        )
        assert direct_status_publish.status_code == 422

        superseded = client.post(
            f"/api/v1/catalog/snapshots/{body['id']}/status",
            json={"import_status": "superseded"},
        )
        assert superseded.status_code == 200
        assert superseded.json()["import_status"] == "superseded"

        republish = client.post(f"/api/v1/catalog/snapshots/{body['id']}/activate")
        assert republish.status_code == 409

        premature_publish = client.post(
            "/api/v1/ingestion/uploads",
            json={
                "source_type": "emulator-capture",
                "source_hash": f"hash-capture-direct-publish-{suffix}",
                "release_id": f"release-direct-publish-{suffix}",
                "validation_summary": {"accepted": True, "errors": ["boom"]},
                "payload": {"managers": [{"id": "nova"}]},
            },
        )
        assert premature_publish.status_code == 200
        direct_body = premature_publish.json()
        assert direct_body["import_status"] == "staged"
        assert direct_body["validation_summary"]["accepted"] is False

    with SessionLocal() as db:
        raw_import = db.get(CatalogRawImport, body["raw_import_id"])
        snapshot = db.get(CatalogSnapshot, body["id"])

        assert raw_import is not None
        raw_import.raw_metadata = {"tampered": True}
        with pytest.raises(ValueError):
            db.commit()
        db.rollback()
        db.delete(raw_import)
        with pytest.raises(ValueError):
            db.commit()
        db.rollback()
        assert snapshot.import_status == "superseded"
