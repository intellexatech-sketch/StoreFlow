from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class MovementOut(BaseModel):
    id: int
    asset_id: int
    asset_tag: str | None = None
    from_warehouse_id: int | None = None
    from_warehouse_name: str | None = None
    from_zone_id: int | None = None
    from_zone_name: str | None = None
    to_warehouse_id: int | None = None
    to_warehouse_name: str | None = None
    to_zone_id: int | None = None
    to_zone_name: str | None = None
    from_status: str | None = None
    to_status: str | None = None
    movement_type: str
    reference_number: str | None = None
    performed_by: int | None = None
    performed_by_name: str | None = None
    notes: str | None = None
    timestamp: datetime

    class Config:
        from_attributes = True
