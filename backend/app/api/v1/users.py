from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_client_ip, require_roles
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services import audit_service

router = APIRouter()


def _serialize(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.name,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN"))):
    users = db.execute(select(User).order_by(User.id)).scalars().unique().all()
    return [_serialize(u) for u in users]


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    if db.execute(select(User.id).where(User.email == payload.email)).scalar():
        raise ConflictError("DUPLICATE_EMAIL", "Email already exists")
    role = db.execute(select(Role).where(Role.name == payload.role.upper())).scalar_one_or_none()
    if not role:
        raise ValidationError("INVALID_ROLE", f"Role {payload.role} not found")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role_id=role.id,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    audit_service.record(
        db,
        user_id=admin.id,
        entity_type="USER",
        entity_id=user.id,
        action="USER_CREATED",
        new_values={"email": user.email, "role": role.name},
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return _serialize(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    user = db.get(User, user_id)
    if not user:
        raise NotFoundError("USER_NOT_FOUND", "User not found")

    old = {"email": user.email, "role": user.role.name, "is_active": user.is_active}
    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        user.email = payload.email
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.role is not None:
        role = db.execute(select(Role).where(Role.name == payload.role.upper())).scalar_one_or_none()
        if not role:
            raise ValidationError("INVALID_ROLE", f"Role {payload.role} not found")
        user.role_id = role.id
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.flush()
    audit_service.record(
        db,
        user_id=admin.id,
        entity_type="USER",
        entity_id=user.id,
        action="USER_UPDATED",
        old_values=old,
        new_values={"email": user.email, "role": user.role.name, "is_active": user.is_active},
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return _serialize(user)


@router.get("/roles/list")
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN"))):
    return [{"id": r.id, "name": r.name} for r in db.execute(select(Role)).scalars().all()]
