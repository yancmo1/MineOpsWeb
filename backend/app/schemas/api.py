from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ManagerInput(BaseModel):
    id: str
    revision: int | None = None
    device_id: str = Field(min_length=1, max_length=64)
    manager_key: str
    level: int = Field(default=1, ge=1)
    rank: int = Field(default=0, ge=0)
    promoted: int = Field(default=0, ge=0)
    fragments: int = Field(default=0, ge=0)
    unlocked: bool = False


class ManagerOutput(ManagerInput):
    model_config = ConfigDict(from_attributes=True)
    revision: int
    updated_at: datetime


class SyncRequest(BaseModel):
    device_id: str
    cursor: datetime | None = None
    mutations: list[ManagerInput] = []


class CatalogUpload(BaseModel):
    source_type: str
    source_version: str | None = None
    source_hash: str
    release_id: str | None = None
    game_version: str | None = None
    capture_schema_version: str | None = None
    capture_engine_version: str | None = None
    validation_schema_version: str | None = None
    validation_engine_version: str | None = None
    configuration_hash: str | None = None
    input_hashes: dict = Field(default_factory=dict)
    object_counts: dict = Field(default_factory=dict)
    validation_summary: dict = Field(default_factory=dict)
    artifact_manifest: dict = Field(default_factory=dict)
    raw_metadata: dict = Field(default_factory=dict)
    payload_size_bytes: int | None = Field(default=None, ge=0)
    captured_at: datetime | None = None
    payload: dict


class CatalogSnapshotOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_type: str
    source_hash: str
    release_id: str | None = None
    raw_import_id: str | None = None
    validation_run_id: str | None = None
    import_status: str
    record_counts: dict
    validation_summary: dict


class SnapshotStatusUpdate(BaseModel):
    import_status: str = Field(pattern="^(reviewed|superseded)$")
