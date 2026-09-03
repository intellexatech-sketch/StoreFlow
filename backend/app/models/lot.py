from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import LotStatus

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.customer import Customer


class Lot(Base):
    __tablename__ = "lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lot_number: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=LotStatus.OPEN.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer: Mapped["Customer"] = relationship("Customer", back_populates="lots")
    assets: Mapped[List["Asset"]] = relationship("Asset", back_populates="lot")
