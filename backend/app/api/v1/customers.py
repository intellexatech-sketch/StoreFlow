from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter()


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Customer).order_by(Customer.name)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.customer_code.ilike(like)))
    return db.execute(stmt).scalars().all()


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "INTAKE", "SALES")),
):
    if db.execute(select(Customer.id).where(Customer.customer_code == payload.customer_code)).scalar():
        raise ConflictError("DUPLICATE_CUSTOMER_CODE", "Customer code already exists")
    c = Customer(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.get(Customer, customer_id)
    if not c:
        raise NotFoundError("CUSTOMER_NOT_FOUND", "Customer not found")
    return c


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "INTAKE", "SALES")),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise NotFoundError("CUSTOMER_NOT_FOUND", "Customer not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c
