from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.lot import Lot
    from app.models.movement import AssetMovement
    from app.models.warehouse import Warehouse, WarehouseZone


class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_customer_status", "customer_id", "status"),
        Index("ix_assets_wh_zone", "warehouse_id", "zone_id"),
        Index("ix_assets_status_condition", "status", "condition"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_tag: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    serial_number: Mapped[str | None] = mapped_column(String(150), unique=True, nullable=True, index=True)
    barcode: Mapped[str | None] = mapped_column(String(150), unique=True, nullable=True, index=True)

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    lot_id: Mapped[int | None] = mapped_column(ForeignKey("lots.id", ondelete="SET NULL"), nullable=True, index=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("asset_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )

    manufacturer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(150), nullable=True)
    device_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)

    condition: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouse_zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    current_location_description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    processed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    disposition_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    resale_value: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="assets", lazy="joined")
    lot: Mapped["Lot | None"] = relationship("Lot", back_populates="assets", lazy="joined")
    category: Mapped["AssetCategory | None"] = relationship("AssetCategory", lazy="joined")
    warehouse: Mapped["Warehouse | None"] = relationship("Warehouse", back_populates="assets", lazy="joined")
    zone: Mapped["WarehouseZone | None"] = relationship("WarehouseZone", back_populates="assets", lazy="joined")
    movements: Mapped[List["AssetMovement"]] = relationship(
        "AssetMovement", back_populates="asset", order_by="AssetMovement.timestamp.desc()"
    )
