from datetime import datetime
from pydantic import BaseModel, Field


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
    game_version: str | None = None
    payload: dict


class CatalogSnapshotOutput(BaseModel):
    id: str
    source_type: str
    source_hash: str
    import_status: str
    record_counts: dict
