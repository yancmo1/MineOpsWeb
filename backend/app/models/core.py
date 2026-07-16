import uuid
from datetime import datetime
from sqlalchemy import DateTime, Integer, JSON, String, Text, event, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class RevisionedMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    device_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class User(Base, RevisionedMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(32), default="admin")


class PlayerManager(Base, RevisionedMixin):
    __tablename__ = "player_managers"
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    manager_key: Mapped[str] = mapped_column(String(128), index=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    rank: Mapped[int] = mapped_column(Integer, default=0)
    promoted: Mapped[int] = mapped_column(Integer, default=0)
    fragments: Mapped[int] = mapped_column(Integer, default=0)
    unlocked: Mapped[bool] = mapped_column(default=False)


class MutationLog(Base):
    __tablename__ = "mutation_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ImmutableEvidenceMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CatalogSnapshot(Base, RevisionedMixin):
    __tablename__ = "catalog_snapshots"
    source_type: Mapped[str] = mapped_column(String(64))
    source_version: Mapped[str | None] = mapped_column(String(128))
    source_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    release_id: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    raw_import_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    validation_run_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    game_version: Mapped[str | None] = mapped_column(String(128))
    import_status: Mapped[str] = mapped_column(String(32), default="staged")
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    record_counts: Mapped[dict] = mapped_column(JSON, default=dict)
    validation_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class CatalogRawImport(Base, ImmutableEvidenceMixin):
    __tablename__ = "catalog_raw_imports"
    release_id: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    source_type: Mapped[str] = mapped_column(String(64))
    source_version: Mapped[str | None] = mapped_column(String(128))
    source_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    game_version: Mapped[str | None] = mapped_column(String(128))
    capture_schema_version: Mapped[str | None] = mapped_column(String(64))
    capture_engine_version: Mapped[str | None] = mapped_column(String(128))
    configuration_hash: Mapped[str | None] = mapped_column(String(128))
    input_hashes: Mapped[dict] = mapped_column(JSON, default=dict)
    object_counts: Mapped[dict] = mapped_column(JSON, default=dict)
    payload_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    payload_manifest: Mapped[dict] = mapped_column(JSON, default=dict)
    artifact_manifest: Mapped[dict] = mapped_column(JSON, default=dict)
    raw_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CatalogValidationRun(Base, ImmutableEvidenceMixin):
    __tablename__ = "catalog_validation_runs"
    raw_import_id: Mapped[str] = mapped_column(String(36), index=True)
    snapshot_id: Mapped[str] = mapped_column(String(36), index=True)
    validation_schema_version: Mapped[str | None] = mapped_column(String(64))
    validation_engine_version: Mapped[str | None] = mapped_column(String(128))
    accepted: Mapped[bool] = mapped_column(default=True)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)


def _raise_append_only_error(_: object, __: object, target: CatalogRawImport | CatalogValidationRun) -> None:
    raise ValueError(f"{target.__class__.__name__} rows are append-only.")


for append_only_model in (CatalogRawImport, CatalogValidationRun):
    event.listen(append_only_model, "before_update", _raise_append_only_error)
    event.listen(append_only_model, "before_delete", _raise_append_only_error)
