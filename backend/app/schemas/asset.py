from __future__ import annotations

from datetime import date, datetime
from typing import List

from pydantic import BaseModel, Field


class AssetBase(BaseModel):
    asset_tag: str
    serial_number: str | None = None
    barcode: str | None = None
    customer_id: int
    lot_id: int | None = None
    category_id: int | None = None
    manufacturer: str | None = None
    model: str | None = None
    device_type: str
    condition: str
    status: str
    warehouse_id: int | None = None
    zone_id: int | None = None
    current_location_description: str | None = None
    purchase_date: date | None = None
    received_date: date | None = None
    processed_date: date | None = None
    disposition_date: date | None = None
    resale_value: float | None = None
    notes: str | None = None


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    asset_tag: str | None = None
    serial_number: str | None = None
    barcode: str | None = None
    lot_id: int | None = None
    category_id: int | None = None
    manufacturer: str | None = None
    model: str | None = None
    device_type: str | None = None
    condition: str | None = None
    status: str | None = None
    warehouse_id: int | None = None
    zone_id: int | None = None
    current_location_description: str | None = None
    purchase_date: date | None = None
    received_date: date | None = None
    processed_date: date | None = None
    disposition_date: date | None = None
    resale_value: float | None = None
    notes: str | None = None


class AssetOut(AssetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    customer_name: str | None = None
    warehouse_name: str | None = None
    zone_name: str | None = None
    lot_number: str | None = None

    class Config:
        from_attributes = True


class MoveRequest(BaseModel):
    to_warehouse_id: int | None = None
    to_zone_id: int | None = None
    movement_type: str = "TRANSFER"
    reference_number: str | None = None
    notes: str | None = None
    new_status: str | None = None


class BulkMoveRequest(BaseModel):
    asset_ids: List[int] = Field(default_factory=list, min_length=1)
    to_warehouse_id: int | None = None
    to_zone_id: int | None = None
    movement_type: str = "TRANSFER"
    reference_number: str | None = None
    notes: str | None = None
    new_status: str | None = None


class BulkMoveResult(BaseModel):
    successful: List[int]
    failed: List[dict]


class StatusChangeRequest(BaseModel):
    new_status: str
    notes: str | None = None
    force: bool = False


class ConditionChangeRequest(BaseModel):
    new_condition: str
    notes: str | None = None


class ScanRequest(BaseModel):
    barcode: str


class ScanResult(BaseModel):
    asset: AssetOut
    recent_movements: List[dict] = Field(default_factory=list)


class ImportSummary(BaseModel):
    total_rows: int
    successful: int
    failed: int
    duplicate: int
    errors: List[dict] = Field(default_factory=list)
