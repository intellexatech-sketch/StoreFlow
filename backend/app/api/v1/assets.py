from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_client_ip, get_current_user, require_roles
from app.core.exceptions import NotFoundError
from app.models.asset import Asset
from app.models.user import User
from app.schemas.asset import (
    AssetCreate,
    AssetOut,
    AssetUpdate,
    BulkMoveRequest,
    BulkMoveResult,
    ConditionChangeRequest,
    MoveRequest,
    ScanRequest,
    ScanResult,
    StatusChangeRequest,
)
from app.schemas.common import Page
from app.schemas.movement import MovementOut
from app.services import asset_service

router = APIRouter()


def _to_out(asset: Asset) -> AssetOut:
    return AssetOut(
        id=asset.id,
        asset_tag=asset.asset_tag,
        serial_number=asset.serial_number,
        barcode=asset.barcode,
        customer_id=asset.customer_id,
        lot_id=asset.lot_id,
        category_id=asset.category_id,
        manufacturer=asset.manufacturer,
        model=asset.model,
        device_type=asset.device_type,
        condition=asset.condition,
        status=asset.status,
        warehouse_id=asset.warehouse_id,
        zone_id=asset.zone_id,
        current_location_description=asset.current_location_description,
        purchase_date=asset.purchase_date,
        received_date=asset.received_date,
        processed_date=asset.processed_date,
        disposition_date=asset.disposition_date,
        resale_value=float(asset.resale_value) if asset.resale_value is not None else None,
        notes=asset.notes,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
        customer_name=asset.customer.name if asset.customer else None,
        warehouse_name=asset.warehouse.name if asset.warehouse else None,
        zone_name=asset.zone.name if asset.zone else None,
        lot_number=asset.lot.lot_number if asset.lot else None,
    )


def _movement_to_out(m) -> MovementOut:
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


@router.get("", response_model=Page[AssetOut])
def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    condition: str | None = None,
    warehouse_id: int | None = None,
    zone_id: int | None = None,
    lot_id: int | None = None,
    device_type: str | None = None,
    sort: str = "-updated_at",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total = asset_service.list_assets(
        db,
        page=page,
        page_size=page_size,
        search=search,
        customer_id=customer_id,
        status=status,
        condition=condition,
        warehouse_id=warehouse_id,
        zone_id=zone_id,
        lot_id=lot_id,
        device_type=device_type,
        sort=sort,
    )
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return Page[AssetOut](
        items=[_to_out(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=AssetOut, status_code=201)
def create_asset(
    payload: AssetCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "INTAKE")),
):
    asset = asset_service.create_asset(
        db, payload.model_dump(), user=user, ip_address=get_client_ip(request)
    )
    return _to_out(asset)


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _to_out(asset_service.get_asset_or_404(db, asset_id))


@router.put("/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "INTAKE", "PROCESSING")),
):
    data = payload.model_dump(exclude_unset=True)
    asset = asset_service.update_asset(db, asset_id, data, user=user, ip_address=get_client_ip(request))
    return _to_out(asset)


@router.post("/scan", response_model=ScanResult)
def scan_asset(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    asset = asset_service.get_by_barcode(db, payload.barcode)
    if not asset:
        raise NotFoundError("ASSET_NOT_FOUND", f"No asset for '{payload.barcode}'")
    recent = [
        {
            "id": m.id,
            "movement_type": m.movement_type,
            "from_status": m.from_status,
            "to_status": m.to_status,
            "from_zone": m.from_zone.name if m.from_zone else None,
            "to_zone": m.to_zone.name if m.to_zone else None,
            "timestamp": m.timestamp,
        }
        for m in asset.movements[:10]
    ]
    return ScanResult(asset=_to_out(asset), recent_movements=recent)


@router.post("/{asset_id}/move", response_model=MovementOut)
def move_asset(
    asset_id: int,
    payload: MoveRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "INTAKE", "PROCESSING")),
):
    m = asset_service.move_asset(
        db,
        asset_id,
        to_warehouse_id=payload.to_warehouse_id,
        to_zone_id=payload.to_zone_id,
        movement_type=payload.movement_type,
        reference_number=payload.reference_number,
        notes=payload.notes,
        new_status=payload.new_status,
        user=user,
        ip_address=get_client_ip(request),
    )
    return _movement_to_out(m)


@router.post("/bulk-move", response_model=BulkMoveResult)
def bulk_move(
    payload: BulkMoveRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "INTAKE", "PROCESSING")),
):
    result = asset_service.bulk_move(
        db,
        payload.asset_ids,
        to_warehouse_id=payload.to_warehouse_id,
        to_zone_id=payload.to_zone_id,
        movement_type=payload.movement_type,
        reference_number=payload.reference_number,
        notes=payload.notes,
        new_status=payload.new_status,
        user=user,
        ip_address=get_client_ip(request),
    )
    return BulkMoveResult(**result)


@router.post("/{asset_id}/status", response_model=AssetOut)
def change_status(
    asset_id: int,
    payload: StatusChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "PROCESSING", "SALES", "INTAKE")),
):
    asset = asset_service.change_status(
        db,
        asset_id,
        payload.new_status,
        user=user,
        notes=payload.notes,
        force=payload.force,
        ip_address=get_client_ip(request),
    )
    return _to_out(asset)


@router.post("/{asset_id}/condition", response_model=AssetOut)
def change_condition(
    asset_id: int,
    payload: ConditionChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "PROCESSING")),
):
    asset = asset_service.change_condition(
        db,
        asset_id,
        payload.new_condition,
        user=user,
        notes=payload.notes,
        ip_address=get_client_ip(request),
    )
    return _to_out(asset)


@router.get("/{asset_id}/movements", response_model=list[MovementOut])
def asset_movements(
    asset_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    asset = asset_service.get_asset_or_404(db, asset_id)
    return [_movement_to_out(m) for m in asset.movements[:limit]]
