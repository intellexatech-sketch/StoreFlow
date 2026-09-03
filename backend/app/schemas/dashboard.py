from __future__ import annotations

from typing import List

from pydantic import BaseModel


class Counter(BaseModel):
    label: str
    value: int


class KV(BaseModel):
    key: str
    value: int


class DashboardResponse(BaseModel):
    totals: dict[str, int]
    by_status: List[KV]
    by_condition: List[KV]
    by_customer: List[KV]
    by_zone: List[KV]
    recent_movements: List[dict]
    recent_assets: List[dict]
