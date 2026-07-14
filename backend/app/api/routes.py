from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.core import CatalogSnapshot, MutationLog, PlayerManager
from app.schemas.api import CatalogSnapshotOutput, CatalogUpload, ManagerInput, ManagerOutput, SyncRequest

router = APIRouter(prefix="/api/v1")


def manager_out(model: PlayerManager) -> ManagerOutput:
    return ManagerOutput(id=model.id, revision=model.revision, device_id=model.device_id or "", manager_key=model.manager_key, level=model.level, rank=model.rank, promoted=model.promoted, fragments=model.fragments, unlocked=model.unlocked, updated_at=model.updated_at)


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
    existing = db.scalar(select(CatalogSnapshot).where(CatalogSnapshot.source_hash == upload.source_hash))
    if existing:
        return existing
    snapshot = CatalogSnapshot(source_type=upload.source_type, source_version=upload.source_version, source_hash=upload.source_hash, game_version=upload.game_version, record_counts={key: len(value) if isinstance(value, list) else 1 for key, value in upload.payload.items()}, payload=upload.payload)
    db.add(snapshot)
    db.commit(); db.refresh(snapshot)
    return snapshot


@router.get("/catalog/snapshots", response_model=list[CatalogSnapshotOutput])
def snapshots(db: Session = Depends(get_db)):
    return db.scalars(select(CatalogSnapshot).order_by(CatalogSnapshot.created_at.desc())).all()


@router.post("/catalog/snapshots/{snapshot_id}/activate", response_model=CatalogSnapshotOutput)
def activate_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    snapshot = db.get(CatalogSnapshot, snapshot_id)
    if not snapshot: raise HTTPException(404, "Snapshot not found")
    snapshot.import_status = "active"; db.commit(); db.refresh(snapshot)
    return snapshot
