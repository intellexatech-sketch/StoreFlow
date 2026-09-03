from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.models.asset import Asset
from app.models.customer import Customer
from app.models.lot import Lot
from app.models.user import User
from app.schemas.lot import LotCreate, LotOut, LotWithCustomer

router = APIRouter()


@router.get("", response_model=list[LotWithCustomer])
def list_lots(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.execute(
        select(Lot, Customer.name, func.count(Asset.id))
        .join(Customer, Customer.id == Lot.customer_id)
        .outerjoin(Asset, Asset.lot_id == Lot.id)
        .group_by(Lot.id, Customer.name)
        .order_by(Lot.id.desc())
    ).all()
    result: list[LotWithCustomer] = []
    for lot, customer_name, count in rows:
        result.append(
            LotWithCustomer(
                id=lot.id,
                lot_number=lot.lot_number,
                customer_id=lot.customer_id,
                description=lot.description,
                received_date=lot.received_date,
                status=lot.status,
                created_at=lot.created_at,
                customer_name=customer_name,
                asset_count=count or 0,
            )
        )
    return result


@router.post("", response_model=LotOut, status_code=201)
def create_lot(
    payload: LotCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "INTAKE")),
):
    if db.execute(select(Lot.id).where(Lot.lot_number == payload.lot_number)).scalar():
        raise ConflictError("DUPLICATE_LOT", "Lot number exists")
    if not db.get(Customer, payload.customer_id):
        raise NotFoundError("CUSTOMER_NOT_FOUND", "Customer not found")
    lot = Lot(**payload.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.get("/{lot_id}", response_model=LotWithCustomer)
def get_lot(lot_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise NotFoundError("LOT_NOT_FOUND", "Lot not found")
    count = db.execute(select(func.count(Asset.id)).where(Asset.lot_id == lot_id)).scalar_one()
    return LotWithCustomer(
        id=lot.id,
        lot_number=lot.lot_number,
        customer_id=lot.customer_id,
        description=lot.description,
        received_date=lot.received_date,
        status=lot.status,
        created_at=lot.created_at,
        customer_name=lot.customer.name if lot.customer else None,
        asset_count=count or 0,
    )
