from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.user import User
    from app.models.warehouse import Warehouse, WarehouseZone


class AssetMovement(Base):
    __tablename__ = "asset_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[int] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True
    )
    from_zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouse_zones.id", ondelete="SET NULL"), nullable=True
    )
    to_warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True
    )
    to_zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouse_zones.id", ondelete="SET NULL"), nullable=True
    )
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    performed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    asset: Mapped["Asset"] = relationship("Asset", back_populates="movements")
    from_warehouse: Mapped["Warehouse | None"] = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_warehouse: Mapped["Warehouse | None"] = relationship("Warehouse", foreign_keys=[to_warehouse_id])
    from_zone: Mapped["WarehouseZone | None"] = relationship("WarehouseZone", foreign_keys=[from_zone_id])
    to_zone: Mapped["WarehouseZone | None"] = relationship("WarehouseZone", foreign_keys=[to_zone_id])
    user: Mapped["User | None"] = relationship("User", foreign_keys=[performed_by])
