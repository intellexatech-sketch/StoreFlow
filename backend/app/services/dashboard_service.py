from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import AssetStatus
from app.models.asset import Asset
from app.models.customer import Customer
from app.models.movement import AssetMovement
from app.models.warehouse import WarehouseZone


def build_dashboard(db: Session) -> dict[str, Any]:
    total = db.execute(select(func.count(Asset.id))).scalar_one()

    def _count_by_status(status: str) -> int:
        return db.execute(select(func.count(Asset.id)).where(Asset.status == status)).scalar_one()

    today = date.today()
    received_today = db.execute(
        select(func.count(Asset.id)).where(Asset.received_date == today)
    ).scalar_one()

    totals = {
        "total_assets": total,
        "received_today": received_today,
        "in_processing": _count_by_status(AssetStatus.PROCESSING.value),
        "ready_for_resale": _count_by_status(AssetStatus.READY_FOR_RESALE.value),
        "ready_for_recycling": _count_by_status(AssetStatus.READY_FOR_RECYCLING.value),
        "sold": _count_by_status(AssetStatus.SOLD.value),
        "recycled": _count_by_status(AssetStatus.RECYCLED.value),
        "on_hold": _count_by_status(AssetStatus.ON_HOLD.value),
    }

    by_status = [
        {"key": s, "value": c}
        for s, c in db.execute(
            select(Asset.status, func.count(Asset.id)).group_by(Asset.status)
        ).all()
    ]
    by_condition = [
        {"key": s, "value": c}
        for s, c in db.execute(
            select(Asset.condition, func.count(Asset.id)).group_by(Asset.condition)
        ).all()
    ]
    by_customer = [
        {"key": name, "value": c}
        for name, c in db.execute(
            select(Customer.name, func.count(Asset.id))
            .join(Asset, Asset.customer_id == Customer.id)
            .group_by(Customer.name)
            .order_by(func.count(Asset.id).desc())
            .limit(10)
        ).all()
    ]
    by_zone = [
        {"key": name, "value": c}
        for name, c in db.execute(
            select(WarehouseZone.name, func.count(Asset.id))
            .join(Asset, Asset.zone_id == WarehouseZone.id)
            .group_by(WarehouseZone.name)
            .order_by(func.count(Asset.id).desc())
            .limit(10)
        ).all()
    ]

    recent_movements_q = (
        select(AssetMovement)
        .order_by(AssetMovement.timestamp.desc())
        .limit(10)
    )
    recent_movements = []
    for m in db.execute(recent_movements_q).scalars().all():
        recent_movements.append(
            {
                "id": m.id,
                "asset_id": m.asset_id,
                "asset_tag": m.asset.asset_tag if m.asset else None,
                "movement_type": m.movement_type,
                "from_zone": m.from_zone.name if m.from_zone else None,
                "to_zone": m.to_zone.name if m.to_zone else None,
                "from_status": m.from_status,
                "to_status": m.to_status,
                "user": m.user.name if m.user else None,
                "timestamp": m.timestamp,
            }
        )

    recent_assets_q = select(Asset).order_by(Asset.created_at.desc()).limit(10)
    recent_assets = []
    for a in db.execute(recent_assets_q).scalars().unique().all():
        recent_assets.append(
            {
                "id": a.id,
                "asset_tag": a.asset_tag,
                "device_type": a.device_type,
                "manufacturer": a.manufacturer,
                "model": a.model,
                "status": a.status,
                "condition": a.condition,
                "customer": a.customer.name if a.customer else None,
                "created_at": a.created_at,
            }
        )

    return {
        "totals": totals,
        "by_status": by_status,
        "by_condition": by_condition,
        "by_customer": by_customer,
        "by_zone": by_zone,
        "recent_movements": recent_movements,
        "recent_assets": recent_assets,
    }
