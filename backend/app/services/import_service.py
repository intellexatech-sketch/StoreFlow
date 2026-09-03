from __future__ import annotations

import csv
import io
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import AssetCondition, AssetStatus, DeviceType
from app.models.asset import Asset
from app.models.customer import Customer
from app.models.lot import Lot
from app.models.warehouse import Warehouse, WarehouseZone
from app.models.user import User
from app.services import asset_service

REQUIRED_HEADERS = {"asset_tag", "customer_code", "device_type"}


def import_assets_csv(
    db: Session, content: bytes, *, user: User, ip_address: str | None = None
) -> dict[str, Any]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = set(h.strip() for h in reader.fieldnames or [])
    missing = REQUIRED_HEADERS - headers
    if missing:
        return {
            "total_rows": 0,
            "successful": 0,
            "failed": 0,
            "duplicate": 0,
            "errors": [{"row": 0, "error": f"Missing required columns: {', '.join(sorted(missing))}"}],
        }

    total = 0
    successful = 0
    failed = 0
    duplicate = 0
    errors: list[dict[str, Any]] = []

    condition_values = {c.value for c in AssetCondition}
    status_values = {s.value for s in AssetStatus}
    device_values = {d.value for d in DeviceType}

    customer_cache: dict[str, Customer] = {}
    lot_cache: dict[str, Lot] = {}
    warehouse_cache: dict[str, Warehouse] = {}
    zone_cache: dict[tuple[int, str], WarehouseZone] = {}

    for row_index, raw in enumerate(reader, start=2):
        total += 1
        row = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in raw.items()}
        try:
            customer_code = row.get("customer_code")
            if not customer_code:
                raise ValueError("customer_code is required")
            customer = customer_cache.get(customer_code)
            if not customer:
                customer = db.execute(
                    select(Customer).where(Customer.customer_code == customer_code)
                ).scalar_one_or_none()
                if not customer:
                    raise ValueError(f"Unknown customer_code {customer_code}")
                customer_cache[customer_code] = customer

            asset_tag = row.get("asset_tag")
            if not asset_tag:
                raise ValueError("asset_tag is required")

            if db.execute(select(Asset.id).where(Asset.asset_tag == asset_tag)).scalar():
                duplicate += 1
                errors.append({"row": row_index, "error": f"Duplicate asset_tag {asset_tag}"})
                continue

            serial = row.get("serial_number") or None
            if serial and db.execute(select(Asset.id).where(Asset.serial_number == serial)).scalar():
                duplicate += 1
                errors.append({"row": row_index, "error": f"Duplicate serial_number {serial}"})
                continue

            barcode = row.get("barcode") or None
            if barcode and db.execute(select(Asset.id).where(Asset.barcode == barcode)).scalar():
                duplicate += 1
                errors.append({"row": row_index, "error": f"Duplicate barcode {barcode}"})
                continue

            device_type = row.get("device_type") or DeviceType.OTHER.value
            if device_type not in device_values:
                raise ValueError(f"Invalid device_type {device_type}")

            condition = row.get("condition") or AssetCondition.GOOD.value
            if condition not in condition_values:
                raise ValueError(f"Invalid condition {condition}")

            status = row.get("status") or AssetStatus.RECEIVED.value
            if status not in status_values:
                raise ValueError(f"Invalid status {status}")

            lot_id = None
            lot_number = row.get("lot_number") or None
            if lot_number:
                lot = lot_cache.get(lot_number)
                if not lot:
                    lot = db.execute(select(Lot).where(Lot.lot_number == lot_number)).scalar_one_or_none()
                    if not lot:
                        raise ValueError(f"Unknown lot_number {lot_number}")
                    lot_cache[lot_number] = lot
                lot_id = lot.id

            warehouse_id = None
            warehouse_code = row.get("warehouse_code") or None
            if warehouse_code:
                warehouse = warehouse_cache.get(warehouse_code)
                if not warehouse:
                    warehouse = db.execute(
                        select(Warehouse).where(Warehouse.code == warehouse_code)
                    ).scalar_one_or_none()
                    if not warehouse:
                        raise ValueError(f"Unknown warehouse_code {warehouse_code}")
                    warehouse_cache[warehouse_code] = warehouse
                warehouse_id = warehouse.id

            zone_id = None
            zone_code = row.get("zone_code") or None
            if zone_code:
                if not warehouse_id:
                    raise ValueError("zone_code requires warehouse_code")
                key = (warehouse_id, zone_code)
                zone = zone_cache.get(key)
                if not zone:
                    zone = db.execute(
                        select(WarehouseZone).where(
                            WarehouseZone.warehouse_id == warehouse_id,
                            WarehouseZone.code == zone_code,
                        )
                    ).scalar_one_or_none()
                    if not zone:
                        raise ValueError(f"Unknown zone_code {zone_code} in warehouse {warehouse_code}")
                    zone_cache[key] = zone
                zone_id = zone.id

            data = {
                "asset_tag": asset_tag,
                "serial_number": serial,
                "barcode": barcode,
                "customer_id": customer.id,
                "lot_id": lot_id,
                "manufacturer": row.get("manufacturer") or None,
                "model": row.get("model") or None,
                "device_type": device_type,
                "condition": condition,
                "status": status,
                "warehouse_id": warehouse_id,
                "zone_id": zone_id,
                "notes": row.get("notes") or None,
            }

            asset_service.create_asset(
                db, data, user=user, ip_address=ip_address, commit=False
            )
            successful += 1
        except Exception as e:  # noqa: BLE001
            failed += 1
            errors.append({"row": row_index, "error": str(e)})

    try:
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        return {
            "total_rows": total,
            "successful": 0,
            "failed": total,
            "duplicate": 0,
            "errors": [{"row": 0, "error": f"Import transaction failed: {e}"}],
        }

    return {
        "total_rows": total,
        "successful": successful,
        "failed": failed,
        "duplicate": duplicate,
        "errors": errors,
    }
