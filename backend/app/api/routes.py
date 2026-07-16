import hashlib
import json
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.core import CatalogRawImport, CatalogSnapshot, CatalogValidationRun, MutationLog, PlayerManager
from app.schemas.api import CatalogSnapshotOutput, CatalogUpload, ManagerOutput, SnapshotStatusUpdate, SyncRequest

router = APIRouter(prefix="/api/v1")
INLINE_ARTIFACT_LIMIT_BYTES = 256 * 1024
ARTIFACT_FIELD_NAMES = {"apk", "apk_base64", "apk_bytes", "binary", "content_base64"}
SNAPSHOT_TRANSITIONS = {
    "staged": {"reviewed", "published"},
    "reviewed": {"published"},
    "published": set(),
}


def manager_out(model: PlayerManager) -> ManagerOutput:
    return ManagerOutput(
        id=model.id,
        revision=model.revision,
        device_id=model.device_id or "",
        manager_key=model.manager_key,
        level=model.level,
        rank=model.rank,
        promoted=model.promoted,
        fragments=model.fragments,
        unlocked=model.unlocked,
        updated_at=model.updated_at,
    )


def compute_object_counts(payload: dict[str, Any]) -> dict[str, int]:
    return {
        key: len(value) if isinstance(value, list) else 1
        for key, value in payload.items()
    }


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def scrub_large_artifacts(value: Any, path: tuple[str, ...] = ()) -> tuple[Any, dict[str, dict[str, Any]]]:
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        manifest: dict[str, dict[str, Any]] = {}
        for key, item in value.items():
            item_path = path + (key,)
            if (
                isinstance(item, str)
                and key.lower() in ARTIFACT_FIELD_NAMES
                and len(item.encode("utf-8")) > INLINE_ARTIFACT_LIMIT_BYTES
            ):
                item_hash = hashlib.sha256(item.encode("utf-8")).hexdigest()
                manifest_key = ".".join(item_path)
                manifest[manifest_key] = {
                    "bytes": len(item.encode("utf-8")),
                    "sha256": item_hash,
                    "storage": "manifest-only",
                }
                normalized[key] = {
                    "artifact_manifest_ref": manifest_key,
                    "bytes": len(item.encode("utf-8")),
                    "sha256": item_hash,
                    "storage": "manifest-only",
                }
                continue
            normalized_item, nested_manifest = scrub_large_artifacts(item, item_path)
            normalized[key] = normalized_item
            manifest.update(nested_manifest)
        return normalized, manifest
    if isinstance(value, list):
        normalized_list = []
        manifest: dict[str, dict[str, Any]] = {}
        for index, item in enumerate(value):
            normalized_item, nested_manifest = scrub_large_artifacts(item, path + (str(index),))
            normalized_list.append(normalized_item)
            manifest.update(nested_manifest)
        return normalized_list, manifest
    return value, {}


def build_validation_summary(
    upload: CatalogUpload,
    object_counts: dict[str, int],
    payload_size_bytes: int,
    artifact_manifest: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    summary = dict(upload.validation_summary)
    summary.setdefault("accepted", True)
    summary.setdefault("errors", [])
    summary.setdefault("warnings", [])
    if artifact_manifest:
        summary["warnings"] = list(summary["warnings"]) + [
            "Large capture artifacts were stored as manifest-only evidence."
        ]
    summary["object_counts"] = object_counts
    summary["payload_size_bytes"] = payload_size_bytes
    summary["inline_artifact_limit_bytes"] = INLINE_ARTIFACT_LIMIT_BYTES
    summary["artifact_manifest_entries"] = len(artifact_manifest)
    return summary


def normalized_snapshot_status(value: str) -> str:
    return "published" if value == "active" else value


@router.get("/version")
def version():
    return {"name": "MineOpsWeb API", "version": "0.1.0"}


@router.post("/sync/managers", response_model=list[ManagerOutput])
def sync_managers(request: SyncRequest, idempotency_key: str = Header(..., alias="Idempotency-Key"), db: Session = Depends(get_db)):
    prior = db.scalar(select(MutationLog).where(MutationLog.idempotency_key == idempotency_key))
    if prior:
        return prior.response["records"]
    records = []
    for incoming in request.mutations:
        model = db.get(PlayerManager, incoming.id)
        if model and incoming.revision is not None and model.revision != incoming.revision:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Record changed on another device", "record": manager_out(model).model_dump(mode="json")})
        if not model:
            model = PlayerManager(id=incoming.id, user_id="bootstrap-admin")
            db.add(model)
        model.device_id, model.manager_key = incoming.device_id, incoming.manager_key
        model.level, model.rank, model.promoted, model.fragments, model.unlocked = incoming.level, incoming.rank, incoming.promoted, incoming.fragments, incoming.unlocked
        model.revision = (model.revision or 0) + 1
        db.flush()
        records.append(manager_out(model).model_dump(mode="json"))
    db.add(MutationLog(idempotency_key=idempotency_key, response={"records": records}))
    db.commit()
    return records


@router.get("/sync/managers", response_model=list[ManagerOutput])
def pull_managers(cursor: datetime | None = None, db: Session = Depends(get_db)):
    query = select(PlayerManager)
    if cursor:
        query = query.where(PlayerManager.updated_at > cursor)
    return [manager_out(item) for item in db.scalars(query.order_by(PlayerManager.updated_at)).all()]


@router.post("/ingestion/uploads", response_model=CatalogSnapshotOutput)
def create_catalog_snapshot(upload: CatalogUpload, db: Session = Depends(get_db)):
    existing = None
    if upload.release_id:
        existing = db.scalar(select(CatalogSnapshot).where(CatalogSnapshot.release_id == upload.release_id))
    if not existing:
        existing = db.scalar(select(CatalogSnapshot).where(CatalogSnapshot.source_hash == upload.source_hash))
    if existing:
        return existing
    normalized_payload, auto_artifact_manifest = scrub_large_artifacts(upload.payload)
    artifact_manifest = {**upload.artifact_manifest, **auto_artifact_manifest}
    object_counts = upload.object_counts or compute_object_counts(normalized_payload)
    payload_size_bytes = upload.payload_size_bytes or len(canonical_json_bytes(upload.payload))
    validation_summary = build_validation_summary(
        upload,
        object_counts,
        payload_size_bytes,
        artifact_manifest,
    )
    raw_import = CatalogRawImport(
        release_id=upload.release_id,
        source_type=upload.source_type,
        source_version=upload.source_version,
        source_hash=upload.source_hash,
        game_version=upload.game_version,
        capture_schema_version=upload.capture_schema_version,
        capture_engine_version=upload.capture_engine_version,
        configuration_hash=upload.configuration_hash or upload.source_hash,
        input_hashes=upload.input_hashes or {"capture_payload": upload.source_hash},
        object_counts=object_counts,
        payload_size_bytes=payload_size_bytes,
        payload_manifest={
            "inline_payload": {
                "bytes": payload_size_bytes,
                "sha256": upload.source_hash,
                "storage": "inline",
            }
        },
        artifact_manifest=artifact_manifest,
        raw_metadata=upload.raw_metadata,
        captured_at=upload.captured_at,
    )
    db.add(raw_import)
    db.flush()
    snapshot = CatalogSnapshot(
        source_type=upload.source_type,
        source_version=upload.source_version,
        source_hash=upload.source_hash,
        release_id=upload.release_id,
        raw_import_id=raw_import.id,
        game_version=upload.game_version,
        import_status="staged",
        record_counts=object_counts,
        validation_summary=validation_summary,
        payload=normalized_payload,
    )
    db.add(snapshot)
    db.flush()
    validation_run = CatalogValidationRun(
        raw_import_id=raw_import.id,
        snapshot_id=snapshot.id,
        validation_schema_version=upload.validation_schema_version,
        validation_engine_version=upload.validation_engine_version,
        accepted=bool(validation_summary.get("accepted", True)),
        summary=validation_summary,
    )
    db.add(validation_run)
    db.flush()
    snapshot.validation_run_id = validation_run.id
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/catalog/snapshots", response_model=list[CatalogSnapshotOutput])
def snapshots(db: Session = Depends(get_db)):
    return db.scalars(select(CatalogSnapshot).order_by(CatalogSnapshot.created_at.desc())).all()


@router.post("/catalog/snapshots/{snapshot_id}/activate", response_model=CatalogSnapshotOutput)
def activate_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    snapshot = db.get(CatalogSnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(404, "Snapshot not found")
    snapshot.import_status = "published"
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.post("/catalog/snapshots/{snapshot_id}/status", response_model=CatalogSnapshotOutput)
def update_snapshot_status(
    snapshot_id: str,
    update: SnapshotStatusUpdate,
    db: Session = Depends(get_db),
):
    snapshot = db.get(CatalogSnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(404, "Snapshot not found")
    current_status = normalized_snapshot_status(snapshot.import_status)
    next_status = normalized_snapshot_status(update.import_status)
    if next_status == current_status:
        return snapshot
    if next_status not in SNAPSHOT_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change snapshot status from {current_status} to {next_status}",
        )
    snapshot.import_status = next_status
    db.commit()
    db.refresh(snapshot)
    return snapshot
