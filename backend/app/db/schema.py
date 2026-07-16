from sqlalchemy import inspect, or_, select
from app.core.serialization import canonical_json_bytes
from app.db.session import SessionLocal, engine
from app.models.core import CatalogRawImport, CatalogSnapshot, CatalogValidationRun

CATALOG_SNAPSHOT_ALTERS = {
    "release_id": "ALTER TABLE catalog_snapshots ADD COLUMN release_id VARCHAR(128)",
    "raw_import_id": "ALTER TABLE catalog_snapshots ADD COLUMN raw_import_id VARCHAR(36)",
    "validation_run_id": "ALTER TABLE catalog_snapshots ADD COLUMN validation_run_id VARCHAR(36)",
}

CATALOG_SNAPSHOT_INDEXES = (
    "CREATE INDEX IF NOT EXISTS ix_catalog_snapshots_release_id ON catalog_snapshots (release_id)",
    "CREATE INDEX IF NOT EXISTS ix_catalog_snapshots_raw_import_id ON catalog_snapshots (raw_import_id)",
    "CREATE INDEX IF NOT EXISTS ix_catalog_snapshots_validation_run_id ON catalog_snapshots (validation_run_id)",
)


def _json_size(value: dict) -> int:
    return len(canonical_json_bytes(value))


def ensure_additive_schema() -> None:
    inspector = inspect(engine)
    if "catalog_snapshots" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("catalog_snapshots")}
    with engine.begin() as connection:
        for column_name, statement in CATALOG_SNAPSHOT_ALTERS.items():
            if column_name not in existing_columns:
                connection.exec_driver_sql(statement)
        for statement in CATALOG_SNAPSHOT_INDEXES:
            connection.exec_driver_sql(statement)
    backfill_missing_provenance_records()


def backfill_missing_provenance_records() -> None:
    with SessionLocal() as db:
        snapshots = db.scalars(
            select(CatalogSnapshot).where(
                or_(
                    CatalogSnapshot.raw_import_id.is_(None),
                    CatalogSnapshot.validation_run_id.is_(None),
                )
            )
        ).all()
        if not snapshots:
            return
        for snapshot in snapshots:
            payload = snapshot.payload or {}
            record_counts = snapshot.record_counts or {}
            validation_summary = snapshot.validation_summary or {
                "accepted": True,
                "object_counts": record_counts,
            }
            if not snapshot.raw_import_id:
                raw_import = CatalogRawImport(
                    release_id=snapshot.release_id,
                    source_type=snapshot.source_type,
                    source_version=snapshot.source_version,
                    source_hash=snapshot.source_hash,
                    game_version=snapshot.game_version,
                    configuration_hash=snapshot.source_hash,
                    input_hashes={"capture_payload": snapshot.source_hash},
                    object_counts=record_counts,
                    payload_size_bytes=_json_size(payload),
                    payload_manifest={
                        "inline_payload": {
                            "bytes": _json_size(payload),
                            "sha256": snapshot.source_hash,
                            "storage": "inline",
                        }
                    },
                    raw_metadata={"backfilled_from_snapshot_id": snapshot.id},
                    captured_at=snapshot.created_at,
                )
                db.add(raw_import)
                db.flush()
                snapshot.raw_import_id = raw_import.id
            if not snapshot.validation_run_id:
                raw_import_id = snapshot.raw_import_id
                if not raw_import_id:
                    continue
                validation_run = CatalogValidationRun(
                    raw_import_id=raw_import_id,
                    snapshot_id=snapshot.id,
                    accepted=not bool(validation_summary.get("errors", [])),
                    summary=validation_summary,
                )
                db.add(validation_run)
                db.flush()
                snapshot.validation_run_id = validation_run.id
        db.commit()
