from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    user_id: int | None = None
    user_name: str | None = None
    entity_type: str
    entity_id: str | None = None
    action: str
    old_values: dict[str, Any] | None = None
    new_values: dict[str, Any] | None = None
    ip_address: str | None = None
    timestamp: datetime

    class Config:
        from_attributes = True
