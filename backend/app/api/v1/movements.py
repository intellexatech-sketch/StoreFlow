from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.movement import AssetMovement
from app.models.user import User
from app.schemas.common import Page
from app.schemas.movement import MovementOut

router = APIRouter()


def _to_out(m: AssetMovement) -> MovementOut:
    return MovementOut(
        id=m.id,
        asset_id=m.asset_id,
        asset_tag=m.asset.asset_tag if m.asset else None,
        from_warehouse_id=m.from_warehouse_id,
        from_warehouse_name=m.from_warehouse.name if m.from_warehouse else None,
        from_zone_id=m.from_zone_id,
        from_zone_name=m.from_zone.name if m.from_zone else None,
        to_warehouse_id=m.to_warehouse_id,
        to_warehouse_name=m.to_warehouse.name if m.to_warehouse else None,
        to_zone_id=m.to_zone_id,
        to_zone_name=m.to_zone.name if m.to_zone else None,
        from_status=m.from_status,
        to_status=m.to_status,
        movement_type=m.movement_type,
        reference_number=m.reference_number,
        performed_by=m.performed_by,
        performed_by_name=m.user.name if m.user else None,
        notes=m.notes,
        timestamp=m.timestamp,
    )


@router.get("", response_model=Page[MovementOut])
def list_movements(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    asset_id: int | None = None,
    movement_type: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(AssetMovement).order_by(AssetMovement.timestamp.desc())
    filters = []
    if asset_id:
        filters.append(AssetMovement.asset_id == asset_id)
    if movement_type:
        filters.append(AssetMovement.movement_type == movement_type)
    if from_date:
        filters.append(AssetMovement.timestamp >= from_date)
    if to_date:
        filters.append(AssetMovement.timestamp <= to_date)
    if filters:
        stmt = stmt.where(and_(*filters))

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = db.execute(stmt).scalars().all()
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return Page[MovementOut](
        items=[_to_out(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
