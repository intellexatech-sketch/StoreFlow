from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogOut
from app.schemas.common import Page

router = APIRouter()


def _to_out(log: AuditLog) -> AuditLogOut:
    return AuditLogOut(
        id=log.id,
        user_id=log.user_id,
        user_name=log.user.name if log.user else None,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        action=log.action,
        old_values=log.old_values,
        new_values=log.new_values,
        ip_address=log.ip_address,
        timestamp=log.timestamp,
    )


@router.get("", response_model=Page[AuditLogOut])
def list_audit(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    user_id: int | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    action: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE")),
):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc())
    filters = []
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filters.append(AuditLog.entity_id == entity_id)
    if action:
        filters.append(AuditLog.action == action)
    if from_date:
        filters.append(AuditLog.timestamp >= from_date)
    if to_date:
        filters.append(AuditLog.timestamp <= to_date)
    if filters:
        stmt = stmt.where(and_(*filters))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = db.execute(stmt).scalars().all()
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return Page[AuditLogOut](
        items=[_to_out(l) for l in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
