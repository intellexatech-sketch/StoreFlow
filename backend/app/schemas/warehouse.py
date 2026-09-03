from __future__ import annotations

from pydantic import BaseModel


class WarehouseBase(BaseModel):
    code: str
    name: str
    address: str | None = None
    description: str | None = None


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseOut(WarehouseBase):
    id: int

    class Config:
        from_attributes = True


class ZoneBase(BaseModel):
    code: str
    name: str
    description: str | None = None


class ZoneCreate(ZoneBase):
    warehouse_id: int


class ZoneOut(ZoneBase):
    id: int
    warehouse_id: int

    class Config:
        from_attributes = True
