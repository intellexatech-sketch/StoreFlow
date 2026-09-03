from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class LotBase(BaseModel):
    lot_number: str
    customer_id: int
    description: str | None = None
    received_date: date | None = None
    status: str = "OPEN"


class LotCreate(LotBase):
    pass


class LotOut(LotBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class LotWithCustomer(LotOut):
    customer_name: str | None = None
    asset_count: int = 0
