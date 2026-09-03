"""Metadata endpoints — exposes enums and demo info so the frontend
never has to hardcode business vocabulary."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.enums import (
    ALLOWED_TRANSITIONS,
    AssetCondition,
    AssetStatus,
    DeviceType,
    LotStatus,
    MovementType,
    RoleName,
)
from app.models.asset import AssetCategory
from app.models.role import Role
from app.models.user import User

router = APIRouter()


AUDIT_ENTITY_TYPES = ["ASSET", "USER", "CUSTOMER", "WAREHOUSE", "ZONE", "LOT", "MOVEMENT"]
AUDIT_ACTIONS = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "ASSET_CREATED",
    "ASSET_UPDATED",
    "STATUS_CHANGED",
    "CONDITION_CHANGED",
    "ASSET_MOVED",
    "BULK_MOVE",
    "IMPORT",
    "LOGIN",
    "LOGOUT",
]


@router.get("/enums")
def get_enums(db: Session = Depends(get_db)) -> dict:
    """Single source of truth for all enum vocabularies used by the UI."""
    categories = [c.name for c in db.execute(select(AssetCategory).order_by(AssetCategory.name)).scalars().all()]
    roles = [r.name for r in db.execute(select(Role).order_by(Role.name)).scalars().all()]
    return {
        "statuses": [s.value for s in AssetStatus],
        "conditions": [c.value for c in AssetCondition],
        "device_types": [d.value for d in DeviceType],
        "movement_types": [m.value for m in MovementType],
        "lot_statuses": [l.value for l in LotStatus],
        "role_names": [r.value for r in RoleName],
        "roles": roles or [r.value for r in RoleName],
        "categories": categories,
        "audit_entity_types": AUDIT_ENTITY_TYPES,
        "audit_actions": AUDIT_ACTIONS,
        "allowed_transitions": {k: sorted(v) for k, v in ALLOWED_TRANSITIONS.items()},
    }


@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)) -> dict:
    """Return the demo login accounts for the login page hint panel.

    Only exposed when the app is running in a non-production environment;
    returns an empty list otherwise so the UI hides the panel."""
    if settings.ENVIRONMENT.lower() not in {"development", "dev", "demo", "local", "test"}:
        return {"enabled": False, "password": None, "users": []}
    users = (
        db.execute(
            select(User)
            .where(User.email.like("%@example.com"))
            .where(User.is_active.is_(True))
        )
        .scalars()
        .all()
    )
    return {
        "enabled": True,
        "password": settings.DEMO_PASSWORD,
        "users": [{"email": u.email, "name": u.name, "role": u.role.name if u.role else None} for u in users],
    }


@router.get("/app-info")
def get_app_info() -> dict:
    return {
        "name": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "api_prefix": settings.API_V1_PREFIX,
    }
