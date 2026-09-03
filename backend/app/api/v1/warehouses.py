from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.models.user import User
from app.models.warehouse import Warehouse, WarehouseZone
from app.schemas.warehouse import WarehouseCreate, WarehouseOut, ZoneCreate, ZoneOut

router = APIRouter()


@router.get("", response_model=list[WarehouseOut])
def list_warehouses(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(select(Warehouse).order_by(Warehouse.code)).scalars().all()


@router.post("", response_model=WarehouseOut, status_code=201)
def create_warehouse(
    payload: WarehouseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN")),
):
    if db.execute(select(Warehouse.id).where(Warehouse.code == payload.code)).scalar():
        raise ConflictError("DUPLICATE_WAREHOUSE", "Warehouse code exists")
    wh = Warehouse(**payload.model_dump())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


@router.get("/{warehouse_id}/zones", response_model=list[ZoneOut])
def list_zones(warehouse_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.get(Warehouse, warehouse_id):
        raise NotFoundError("WAREHOUSE_NOT_FOUND", "Warehouse not found")
    zones = (
        db.execute(select(WarehouseZone).where(WarehouseZone.warehouse_id == warehouse_id).order_by(WarehouseZone.code))
        .scalars()
        .all()
    )
    return zones


@router.get("/zones/all", response_model=list[ZoneOut])
def list_all_zones(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(select(WarehouseZone).order_by(WarehouseZone.warehouse_id, WarehouseZone.code)).scalars().all()


@router.post("/zones", response_model=ZoneOut, status_code=201)
def create_zone(
    payload: ZoneCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN")),
):
    if not db.get(Warehouse, payload.warehouse_id):
        raise NotFoundError("WAREHOUSE_NOT_FOUND", "Warehouse not found")
    if db.execute(
        select(WarehouseZone.id).where(
            WarehouseZone.warehouse_id == payload.warehouse_id,
            WarehouseZone.code == payload.code,
        )
    ).scalar():
        raise ConflictError("DUPLICATE_ZONE", "Zone code exists in warehouse")
    z = WarehouseZone(**payload.model_dump())
    db.add(z)
    db.commit()
    db.refresh(z)
    return z
