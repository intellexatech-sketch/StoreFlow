from __future__ import annotations

from datetime import date
from typing import Any, Iterable, Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import AssetStatus, MovementType, is_transition_allowed
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.asset import Asset
from app.models.customer import Customer
from app.models.lot import Lot
from app.models.movement import AssetMovement
from app.models.user import User
from app.models.warehouse import Warehouse, WarehouseZone
from app.services import audit_service
from app.websocket.manager import broadcast_sync


def _serialize_asset(asset: Asset) -> dict[str, Any]:
    return {
        "id": asset.id,
        "asset_tag": asset.asset_tag,
        "serial_number": asset.serial_number,
        "barcode": asset.barcode,
        "customer_id": asset.customer_id,
        "customer_name": asset.customer.name if asset.customer else None,
        "lot_id": asset.lot_id,
        "lot_number": asset.lot.lot_number if asset.lot else None,
        "category_id": asset.category_id,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "device_type": asset.device_type,
        "condition": asset.condition,
        "status": asset.status,
        "warehouse_id": asset.warehouse_id,
        "warehouse_name": asset.warehouse.name if asset.warehouse else None,
        "zone_id": asset.zone_id,
        "zone_name": asset.zone.name if asset.zone else None,
        "current_location_description": asset.current_location_description,
        "purchase_date": asset.purchase_date,
        "received_date": asset.received_date,
        "processed_date": asset.processed_date,
        "disposition_date": asset.disposition_date,
        "resale_value": float(asset.resale_value) if asset.resale_value is not None else None,
        "notes": asset.notes,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }


def get_asset_or_404(db: Session, asset_id: int) -> Asset:
    asset = db.get(Asset, asset_id)
    if not asset:
        raise NotFoundError(code="ASSET_NOT_FOUND", message="Asset not found")
    return asset


def get_by_barcode(db: Session, barcode: str) -> Asset | None:
    q = select(Asset).where(
        or_(Asset.barcode == barcode, Asset.serial_number == barcode, Asset.asset_tag == barcode)
    )
    return db.execute(q).scalar_one_or_none()


def _validate_refs(db: Session, data: dict[str, Any]) -> None:
    cid = data.get("customer_id")
    if cid is not None and not db.get(Customer, cid):
        raise ValidationError("INVALID_CUSTOMER", "Customer does not exist")

    lot_id = data.get("lot_id")
    if lot_id is not None and not db.get(Lot, lot_id):
        raise ValidationError("INVALID_LOT", "Lot does not exist")

    wh_id = data.get("warehouse_id")
    if wh_id is not None and not db.get(Warehouse, wh_id):
        raise ValidationError("INVALID_WAREHOUSE", "Warehouse does not exist")

    zone_id = data.get("zone_id")
    if zone_id is not None:
        zone = db.get(WarehouseZone, zone_id)
        if not zone:
            raise ValidationError("INVALID_ZONE", "Zone does not exist")
        if wh_id is not None and zone.warehouse_id != wh_id:
            raise ValidationError("ZONE_MISMATCH", "Zone does not belong to the selected warehouse")


def create_asset(
    db: Session,
    data: dict[str, Any],
    *,
    user: User,
    ip_address: str | None = None,
    commit: bool = True,
) -> Asset:
    _validate_refs(db, data)

    if not data.get("asset_tag"):
        raise ValidationError("MISSING_ASSET_TAG", "Asset tag is required")

    # uniqueness checks
    if db.execute(select(Asset.id).where(Asset.asset_tag == data["asset_tag"])).scalar():
        raise ConflictError("DUPLICATE_ASSET_TAG", f"Asset tag {data['asset_tag']} already exists")

    if data.get("serial_number"):
        exists = db.execute(select(Asset.id).where(Asset.serial_number == data["serial_number"])).scalar()
        if exists:
            raise ConflictError("DUPLICATE_SERIAL_NUMBER", f"Serial number {data['serial_number']} already exists")

    if data.get("barcode"):
        exists = db.execute(select(Asset.id).where(Asset.barcode == data["barcode"])).scalar()
        if exists:
            raise ConflictError("DUPLICATE_BARCODE", f"Barcode {data['barcode']} already exists")

    asset = Asset(**data)
    db.add(asset)
    db.flush()

    # Initial movement record if it starts in a location or with RECEIVED status
    if asset.warehouse_id or asset.zone_id or asset.status in {AssetStatus.RECEIVED.value, AssetStatus.COLLECTED.value}:
        movement = AssetMovement(
            asset_id=asset.id,
            from_warehouse_id=None,
            from_zone_id=None,
            to_warehouse_id=asset.warehouse_id,
            to_zone_id=asset.zone_id,
            from_status=None,
            to_status=asset.status,
            movement_type=MovementType.RECEIVED.value,
            performed_by=user.id,
            notes="Initial intake",
        )
        db.add(movement)

    audit_service.record(
        db,
        user_id=user.id,
        entity_type="ASSET",
        entity_id=asset.id,
        action="ASSET_CREATED",
        new_values=_serialize_asset(asset),
        ip_address=ip_address,
    )

    if commit:
        db.commit()
        db.refresh(asset)

    broadcast_sync("ASSET_CREATED", {"asset_id": asset.id, "asset_tag": asset.asset_tag})
    return asset


def update_asset(
    db: Session, asset_id: int, data: dict[str, Any], *, user: User, ip_address: str | None = None
) -> Asset:
    asset = get_asset_or_404(db, asset_id)
    _validate_refs(db, {**{"customer_id": asset.customer_id, "warehouse_id": asset.warehouse_id}, **data})

    # uniqueness checks for changed fields
    if "asset_tag" in data and data["asset_tag"] and data["asset_tag"] != asset.asset_tag:
        if db.execute(select(Asset.id).where(Asset.asset_tag == data["asset_tag"])).scalar():
            raise ConflictError("DUPLICATE_ASSET_TAG", "Asset tag already exists")

    if "serial_number" in data and data["serial_number"] and data["serial_number"] != asset.serial_number:
        if db.execute(select(Asset.id).where(Asset.serial_number == data["serial_number"])).scalar():
            raise ConflictError("DUPLICATE_SERIAL_NUMBER", "Serial number already exists")

    if "barcode" in data and data["barcode"] and data["barcode"] != asset.barcode:
        if db.execute(select(Asset.id).where(Asset.barcode == data["barcode"])).scalar():
            raise ConflictError("DUPLICATE_BARCODE", "Barcode already exists")

    old = _serialize_asset(asset)
    for k, v in data.items():
        if v is not None:
            setattr(asset, k, v)
    db.flush()

    audit_service.record(
        db,
        user_id=user.id,
        entity_type="ASSET",
        entity_id=asset.id,
        action="ASSET_UPDATED",
        old_values=old,
        new_values=_serialize_asset(asset),
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(asset)
    broadcast_sync("ASSET_UPDATED", {"asset_id": asset.id})
    return asset


def change_status(
    db: Session,
    asset_id: int,
    new_status: str,
    *,
    user: User,
    notes: str | None = None,
    force: bool = False,
    ip_address: str | None = None,
) -> Asset:
    asset = get_asset_or_404(db, asset_id)
    if new_status not in {s.value for s in AssetStatus}:
        raise ValidationError("INVALID_STATUS", f"Unknown status {new_status}")

    is_admin = user.role.name.upper() == "ADMIN"
    if not (force and is_admin) and not is_transition_allowed(asset.status, new_status):
        raise ValidationError(
            "INVALID_TRANSITION",
            f"Cannot transition asset from {asset.status} to {new_status}",
        )

    old_status = asset.status
    asset.status = new_status
    # Update lifecycle dates
    today = date.today()
    if new_status == AssetStatus.RECEIVED.value and not asset.received_date:
        asset.received_date = today
    if new_status == AssetStatus.PROCESSING.value and not asset.processed_date:
        asset.processed_date = today
    if new_status in {
        AssetStatus.SOLD.value,
        AssetStatus.RECYCLED.value,
        AssetStatus.DISPOSED.value,
    } and not asset.disposition_date:
        asset.disposition_date = today

    db.add(
        AssetMovement(
            asset_id=asset.id,
            from_warehouse_id=asset.warehouse_id,
            from_zone_id=asset.zone_id,
            to_warehouse_id=asset.warehouse_id,
            to_zone_id=asset.zone_id,
            from_status=old_status,
            to_status=new_status,
            movement_type=_movement_type_for_status(new_status),
            performed_by=user.id,
            notes=notes or f"Status changed {old_status} → {new_status}",
        )
    )

    audit_service.record(
        db,
        user_id=user.id,
        entity_type="ASSET",
        entity_id=asset.id,
        action="STATUS_CHANGED",
        old_values={"status": old_status},
        new_values={"status": new_status},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(asset)
    broadcast_sync("STATUS_CHANGED", {"asset_id": asset.id, "from": old_status, "to": new_status})
    return asset


def change_condition(
    db: Session,
    asset_id: int,
    new_condition: str,
    *,
    user: User,
    notes: str | None = None,
    ip_address: str | None = None,
) -> Asset:
    asset = get_asset_or_404(db, asset_id)
    old = asset.condition
    asset.condition = new_condition

    audit_service.record(
        db,
        user_id=user.id,
        entity_type="ASSET",
        entity_id=asset.id,
        action="CONDITION_CHANGED",
        old_values={"condition": old},
        new_values={"condition": new_condition, "notes": notes},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(asset)
    broadcast_sync("CONDITION_CHANGED", {"asset_id": asset.id, "from": old, "to": new_condition})
    return asset


def _movement_type_for_status(status: str) -> str:
    mapping = {
        AssetStatus.RECEIVED.value: MovementType.RECEIVED.value,
        AssetStatus.PROCESSING.value: MovementType.PROCESSING.value,
        AssetStatus.SOLD.value: MovementType.SALE.value,
        AssetStatus.RECYCLED.value: MovementType.RECYCLING.value,
        AssetStatus.DISPOSED.value: MovementType.DISPOSAL.value,
    }
    return mapping.get(status, MovementType.OTHER.value)


def move_asset(
    db: Session,
    asset_id: int,
    *,
    to_warehouse_id: int | None,
    to_zone_id: int | None,
    movement_type: str = MovementType.TRANSFER.value,
    reference_number: str | None = None,
    notes: str | None = None,
    new_status: str | None = None,
    user: User,
    ip_address: str | None = None,
    commit: bool = True,
) -> AssetMovement:
    asset = get_asset_or_404(db, asset_id)
    if to_warehouse_id is None and to_zone_id is None:
        raise ValidationError("MISSING_DESTINATION", "Destination warehouse or zone required")

    if to_warehouse_id is not None and not db.get(Warehouse, to_warehouse_id):
        raise ValidationError("INVALID_WAREHOUSE", "Warehouse does not exist")
    if to_zone_id is not None:
        zone = db.get(WarehouseZone, to_zone_id)
        if not zone:
            raise ValidationError("INVALID_ZONE", "Zone does not exist")
        if to_warehouse_id is None:
            to_warehouse_id = zone.warehouse_id
        elif zone.warehouse_id != to_warehouse_id:
            raise ValidationError("ZONE_MISMATCH", "Zone does not belong to the destination warehouse")

    from_wh = asset.warehouse_id
    from_zone = asset.zone_id
    from_status = asset.status

    to_status = from_status
    if new_status:
        is_admin = user.role.name.upper() == "ADMIN"
        if not is_admin and not is_transition_allowed(asset.status, new_status):
            raise ValidationError(
                "INVALID_TRANSITION",
                f"Cannot transition asset from {asset.status} to {new_status}",
            )
        to_status = new_status
        asset.status = new_status

    asset.warehouse_id = to_warehouse_id
    asset.zone_id = to_zone_id

    movement = AssetMovement(
        asset_id=asset.id,
        from_warehouse_id=from_wh,
        from_zone_id=from_zone,
        to_warehouse_id=to_warehouse_id,
        to_zone_id=to_zone_id,
        from_status=from_status,
        to_status=to_status,
        movement_type=movement_type,
        reference_number=reference_number,
        performed_by=user.id,
        notes=notes,
    )
    db.add(movement)

    audit_service.record(
        db,
        user_id=user.id,
        entity_type="ASSET",
        entity_id=asset.id,
        action="ASSET_MOVED",
        old_values={
            "warehouse_id": from_wh,
            "zone_id": from_zone,
            "status": from_status,
        },
        new_values={
            "warehouse_id": to_warehouse_id,
            "zone_id": to_zone_id,
            "status": to_status,
        },
        ip_address=ip_address,
    )

    if commit:
        db.commit()
        db.refresh(asset)
        db.refresh(movement)

    broadcast_sync(
        "ASSET_MOVED",
        {
            "asset_id": asset.id,
            "to_warehouse_id": to_warehouse_id,
            "to_zone_id": to_zone_id,
        },
    )
    return movement


def bulk_move(
    db: Session,
    asset_ids: Sequence[int],
    *,
    to_warehouse_id: int | None,
    to_zone_id: int | None,
    movement_type: str = MovementType.TRANSFER.value,
    reference_number: str | None = None,
    notes: str | None = None,
    new_status: str | None = None,
    user: User,
    ip_address: str | None = None,
) -> dict[str, Any]:
    successful: list[int] = []
    failed: list[dict[str, Any]] = []
    # single transaction
    try:
        for aid in asset_ids:
            try:
                move_asset(
                    db,
                    aid,
                    to_warehouse_id=to_warehouse_id,
                    to_zone_id=to_zone_id,
                    movement_type=movement_type,
                    reference_number=reference_number,
                    notes=notes,
                    new_status=new_status,
                    user=user,
                    ip_address=ip_address,
                    commit=False,
                )
                successful.append(aid)
            except Exception as e:  # noqa: BLE001
                failed.append({"asset_id": aid, "error": str(e.detail) if hasattr(e, "detail") else str(e)})
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"successful": successful, "failed": failed}


def list_assets(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    customer_id: int | None = None,
    status: str | None = None,
    condition: str | None = None,
    warehouse_id: int | None = None,
    zone_id: int | None = None,
    lot_id: int | None = None,
    device_type: str | None = None,
    sort: str = "-updated_at",
) -> tuple[list[Asset], int]:
    q = select(Asset).options(
        selectinload(Asset.customer),
        selectinload(Asset.lot),
        selectinload(Asset.warehouse),
        selectinload(Asset.zone),
    )
    filters = []
    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                Asset.asset_tag.ilike(like),
                Asset.serial_number.ilike(like),
                Asset.barcode.ilike(like),
                Asset.model.ilike(like),
                Asset.manufacturer.ilike(like),
            )
        )
    if customer_id:
        filters.append(Asset.customer_id == customer_id)
    if status:
        filters.append(Asset.status == status)
    if condition:
        filters.append(Asset.condition == condition)
    if warehouse_id:
        filters.append(Asset.warehouse_id == warehouse_id)
    if zone_id:
        filters.append(Asset.zone_id == zone_id)
    if lot_id:
        filters.append(Asset.lot_id == lot_id)
    if device_type:
        filters.append(Asset.device_type == device_type)
    if filters:
        q = q.where(and_(*filters))

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()

    desc = sort.startswith("-")
    field_name = sort[1:] if desc else sort
    sort_field = getattr(Asset, field_name, Asset.updated_at)
    q = q.order_by(sort_field.desc() if desc else sort_field.asc())

    q = q.offset((page - 1) * page_size).limit(page_size)
    items = db.execute(q).scalars().unique().all()
    return list(items), total
