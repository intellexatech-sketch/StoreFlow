from __future__ import annotations

from enum import Enum


class RoleName(str, Enum):
    ADMIN = "ADMIN"
    INTAKE = "INTAKE"
    PROCESSING = "PROCESSING"
    SALES = "SALES"
    COMPLIANCE = "COMPLIANCE"


class AssetStatus(str, Enum):
    COLLECTED = "COLLECTED"
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    PROCESSING = "PROCESSING"
    TESTING = "TESTING"
    READY_FOR_RESALE = "READY_FOR_RESALE"
    SOLD = "SOLD"
    READY_FOR_RECYCLING = "READY_FOR_RECYCLING"
    RECYCLED = "RECYCLED"
    DISPOSED = "DISPOSED"
    ON_HOLD = "ON_HOLD"


class AssetCondition(str, Enum):
    NEW = "New"
    EXCELLENT = "Excellent"
    GOOD = "Good"
    FAIR = "Fair"
    POOR = "Poor"
    DAMAGED = "Damaged"
    SCRAP = "Scrap"


class DeviceType(str, Enum):
    LAPTOP = "Laptop"
    DESKTOP = "Desktop"
    MONITOR = "Monitor"
    MOBILE = "Mobile"
    TABLET = "Tablet"
    SERVER = "Server"
    PRINTER = "Printer"
    NETWORK = "Network Equipment"
    OTHER = "Other"


class MovementType(str, Enum):
    RECEIVED = "RECEIVED"
    TRANSFER = "TRANSFER"
    PROCESSING = "PROCESSING"
    SHIPMENT = "SHIPMENT"
    SALE = "SALE"
    RECYCLING = "RECYCLING"
    DISPOSAL = "DISPOSAL"
    OTHER = "OTHER"


class LotStatus(str, Enum):
    OPEN = "OPEN"
    PROCESSING = "PROCESSING"
    CLOSED = "CLOSED"


# Allowed forward transitions. ADMIN can bypass this.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    AssetStatus.COLLECTED.value: {
        AssetStatus.IN_TRANSIT.value,
        AssetStatus.RECEIVED.value,
        AssetStatus.ON_HOLD.value,
    },
    AssetStatus.IN_TRANSIT.value: {
        AssetStatus.RECEIVED.value,
        AssetStatus.ON_HOLD.value,
    },
    AssetStatus.RECEIVED.value: {
        AssetStatus.PROCESSING.value,
        AssetStatus.ON_HOLD.value,
    },
    AssetStatus.PROCESSING.value: {
        AssetStatus.TESTING.value,
        AssetStatus.READY_FOR_RECYCLING.value,
        AssetStatus.DISPOSED.value,
        AssetStatus.ON_HOLD.value,
    },
    AssetStatus.TESTING.value: {
        AssetStatus.READY_FOR_RESALE.value,
        AssetStatus.READY_FOR_RECYCLING.value,
        AssetStatus.ON_HOLD.value,
    },
    AssetStatus.READY_FOR_RESALE.value: {
        AssetStatus.SOLD.value,
        AssetStatus.ON_HOLD.value,
        AssetStatus.READY_FOR_RECYCLING.value,
    },
    AssetStatus.READY_FOR_RECYCLING.value: {
        AssetStatus.RECYCLED.value,
        AssetStatus.DISPOSED.value,
        AssetStatus.ON_HOLD.value,
    },
    AssetStatus.SOLD.value: set(),
    AssetStatus.RECYCLED.value: set(),
    AssetStatus.DISPOSED.value: set(),
    AssetStatus.ON_HOLD.value: {
        AssetStatus.RECEIVED.value,
        AssetStatus.PROCESSING.value,
        AssetStatus.TESTING.value,
        AssetStatus.READY_FOR_RESALE.value,
        AssetStatus.READY_FOR_RECYCLING.value,
    },
}


def is_transition_allowed(current: str, target: str) -> bool:
    if current == target:
        return True
    return target in ALLOWED_TRANSITIONS.get(current, set())
