from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.asset import Asset
from app.models.audit import AuditLog
from app.models.customer import Customer
from app.models.lot import Lot
from app.models.movement import AssetMovement
from app.models.user import User
from app.services import report_service

router = APIRouter()


def _asset_rows(db: Session, filters):
    stmt = select(Asset)
    if filters:
        stmt = stmt.where(and_(*filters))
    stmt = stmt.order_by(Asset.asset_tag)
    rows = []
    for a in db.execute(stmt).scalars().unique().all():
        rows.append(
            [
                a.asset_tag,
                a.serial_number,
                a.manufacturer,
                a.model,
                a.device_type,
                a.condition,
                a.status,
                a.customer.name if a.customer else "",
                a.warehouse.name if a.warehouse else "",
                a.zone.name if a.zone else "",
                a.lot.lot_number if a.lot else "",
                a.received_date,
                a.disposition_date,
                float(a.resale_value) if a.resale_value is not None else "",
            ]
        )
    return rows


ASSET_HEADERS = [
    "Asset Tag",
    "Serial Number",
    "Manufacturer",
    "Model",
    "Device Type",
    "Condition",
    "Status",
    "Customer",
    "Warehouse",
    "Zone",
    "Lot",
    "Received",
    "Disposition",
    "Resale Value",
]


def _download_response(payload: bytes, filename: str, media_type: str) -> Response:
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/inventory")
def inventory_report(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    customer_id: int | None = None,
    warehouse_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE", "SALES", "PROCESSING")),
):
    filters = []
    if customer_id:
        filters.append(Asset.customer_id == customer_id)
    if warehouse_id:
        filters.append(Asset.warehouse_id == warehouse_id)
    if status:
        filters.append(Asset.status == status)

    rows = _asset_rows(db, filters)
    title = "Inventory Report"
    subtitle = f"Filters: customer_id={customer_id or 'all'}, warehouse_id={warehouse_id or 'all'}, status={status or 'all'}"
    if format == "csv":
        return _download_response(
            report_service.csv_bytes(ASSET_HEADERS, rows), "inventory_report.csv", "text/csv"
        )
    return _download_response(
        report_service.pdf_bytes(title, ASSET_HEADERS, rows, subtitle),
        "inventory_report.pdf",
        "application/pdf",
    )


@router.get("/customer")
def customer_report(
    customer_id: int = Query(...),
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE", "SALES")),
):
    customer = db.get(Customer, customer_id)
    name = customer.name if customer else str(customer_id)
    rows = _asset_rows(db, [Asset.customer_id == customer_id])
    title = f"Customer Asset Report — {name}"
    if format == "csv":
        return _download_response(
            report_service.csv_bytes(ASSET_HEADERS, rows),
            f"customer_{customer_id}_report.csv",
            "text/csv",
        )
    return _download_response(
        report_service.pdf_bytes(title, ASSET_HEADERS, rows),
        f"customer_{customer_id}_report.pdf",
        "application/pdf",
    )


@router.get("/lot")
def lot_report(
    lot_id: int = Query(...),
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE", "SALES")),
):
    lot = db.get(Lot, lot_id)
    name = lot.lot_number if lot else str(lot_id)
    rows = _asset_rows(db, [Asset.lot_id == lot_id])
    title = f"Lot Report — {name}"
    if format == "csv":
        return _download_response(
            report_service.csv_bytes(ASSET_HEADERS, rows), f"lot_{lot_id}_report.csv", "text/csv"
        )
    return _download_response(
        report_service.pdf_bytes(title, ASSET_HEADERS, rows),
        f"lot_{lot_id}_report.pdf",
        "application/pdf",
    )


@router.get("/movement")
def movement_report(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    asset_id: int | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE", "PROCESSING")),
):
    stmt = select(AssetMovement).order_by(AssetMovement.timestamp.desc())
    filters = []
    if asset_id:
        filters.append(AssetMovement.asset_id == asset_id)
    if from_date:
        filters.append(AssetMovement.timestamp >= from_date)
    if to_date:
        filters.append(AssetMovement.timestamp <= to_date)
    if filters:
        stmt = stmt.where(and_(*filters))

    headers = [
        "Timestamp",
        "Asset Tag",
        "Movement Type",
        "From Status",
        "To Status",
        "From Zone",
        "To Zone",
        "User",
        "Notes",
    ]
    rows = []
    for m in db.execute(stmt).scalars().all():
        rows.append(
            [
                m.timestamp.strftime("%Y-%m-%d %H:%M"),
                m.asset.asset_tag if m.asset else "",
                m.movement_type,
                m.from_status,
                m.to_status,
                m.from_zone.name if m.from_zone else "",
                m.to_zone.name if m.to_zone else "",
                m.user.name if m.user else "",
                m.notes or "",
            ]
        )
    if format == "csv":
        return _download_response(
            report_service.csv_bytes(headers, rows), "movement_report.csv", "text/csv"
        )
    return _download_response(
        report_service.pdf_bytes("Asset Movement Report", headers, rows),
        "movement_report.pdf",
        "application/pdf",
    )


@router.get("/recycling")
def recycling_report(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE")),
):
    rows = _asset_rows(
        db, [Asset.status.in_(["RECYCLED", "READY_FOR_RECYCLING", "DISPOSED"])]
    )
    if format == "csv":
        return _download_response(
            report_service.csv_bytes(ASSET_HEADERS, rows), "recycling_report.csv", "text/csv"
        )
    return _download_response(
        report_service.pdf_bytes("Recycling & Disposition Report", ASSET_HEADERS, rows),
        "recycling_report.pdf",
        "application/pdf",
    )


@router.get("/disposition")
def disposition_report(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE", "SALES")),
):
    rows = _asset_rows(db, [Asset.status.in_(["SOLD", "RECYCLED", "DISPOSED"])])
    if format == "csv":
        return _download_response(
            report_service.csv_bytes(ASSET_HEADERS, rows), "disposition_report.csv", "text/csv"
        )
    return _download_response(
        report_service.pdf_bytes("Final Disposition Report", ASSET_HEADERS, rows),
        "disposition_report.pdf",
        "application/pdf",
    )


@router.get("/audit")
def audit_report(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    entity_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "COMPLIANCE")),
):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc())
    filters = []
    if from_date:
        filters.append(AuditLog.timestamp >= from_date)
    if to_date:
        filters.append(AuditLog.timestamp <= to_date)
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if filters:
        stmt = stmt.where(and_(*filters))
    headers = ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "IP Address"]
    rows = []
    for l in db.execute(stmt).scalars().all():
        rows.append(
            [
                l.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                l.user.name if l.user else "system",
                l.action,
                l.entity_type,
                l.entity_id,
                l.ip_address or "",
            ]
        )
    if format == "csv":
        return _download_response(
            report_service.csv_bytes(headers, rows), "audit_report.csv", "text/csv"
        )
    return _download_response(
        report_service.pdf_bytes("Audit Report", headers, rows),
        "audit_report.pdf",
        "application/pdf",
    )
