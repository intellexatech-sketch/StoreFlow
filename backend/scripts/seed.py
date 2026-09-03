"""Seed realistic demo data for the ITAD platform.

Idempotent: safe to re-run — existing rows are preserved and only
missing seed data is added. `target_assets` sets the desired count
of asset rows (defaults to 500 for a demo-worthy dataset).
"""
from __future__ import annotations

import logging
import random
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.enums import (
    AssetCondition,
    AssetStatus,
    DeviceType,
    LotStatus,
    MovementType,
    RoleName,
)
from app.core.security import hash_password
from app.models.asset import Asset, AssetCategory
from app.models.audit import AuditLog
from app.models.customer import Customer
from app.models.lot import Lot
from app.models.movement import AssetMovement
from app.models.role import Role
from app.models.user import User
from app.models.warehouse import Warehouse, WarehouseZone

log = logging.getLogger("seed")

# Deterministic randomness so demos look consistent between rebuilds.
_RNG = random.Random(20260903)


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

DEMO_USERS = [
    ("Alice Adamson", "admin@example.com", RoleName.ADMIN),
    ("Ivan Ito", "intake@example.com", RoleName.INTAKE),
    ("Priya Patel", "processing@example.com", RoleName.PROCESSING),
    ("Sam Sanders", "sales@example.com", RoleName.SALES),
    ("Carla Chen", "compliance@example.com", RoleName.COMPLIANCE),
    ("Marcus Reeves", "marcus.reeves@example.com", RoleName.INTAKE),
    ("Nina Kowalski", "nina.kowalski@example.com", RoleName.PROCESSING),
    ("David Okonkwo", "david.okonkwo@example.com", RoleName.PROCESSING),
    ("Elena Vargas", "elena.vargas@example.com", RoleName.SALES),
    ("Rahul Menon", "rahul.menon@example.com", RoleName.COMPLIANCE),
]

# (code, name, industry, contact, email, phone, address)
DEMO_CUSTOMERS = [
    ("CUST001", "Acme Financial Group", "Anna Rodriguez",   "anna.rodriguez@acme-fin.example.com",   "+1-212-555-0123", "500 Wall St, New York NY 10005"),
    ("CUST002", "Beacon Health Systems", "Benjamin Wright", "b.wright@beaconhealth.example.com",     "+1-617-555-0187", "150 Longwood Ave, Boston MA 02115"),
    ("CUST003", "Coastline Retail Co.",  "Carla Ortiz",     "carla.ortiz@coastline.example.com",     "+1-305-555-0154", "800 Ocean Dr, Miami FL 33139"),
    ("CUST004", "DeltaTech Semiconductors","Derek Yamada",  "derek.yamada@deltatech.example.com",   "+1-408-555-0119", "2200 Mission College Blvd, Santa Clara CA 95054"),
    ("CUST005", "Evergreen Municipal Services","Evelyn Park","evelyn.park@evergreen.example.gov",    "+1-503-555-0142", "1220 SW 5th Ave, Portland OR 97204"),
    ("CUST006", "Forge Manufacturing",    "Franklin Miller","f.miller@forge-mfg.example.com",        "+1-313-555-0165", "3400 Michigan Ave, Detroit MI 48216"),
    ("CUST007", "Global Logistics Ltd.",  "Grace Novak",    "grace.novak@globallog.example.com",     "+44-20-7946-0135","10 Cabot Sq, London E14 4QQ, UK"),
    ("CUST008", "Horizon Education Trust","Hannah Silva",   "h.silva@horizonedu.example.org",        "+1-512-555-0198", "1101 Congress Ave, Austin TX 78701"),
    ("CUST009", "Ironhaven Insurance",    "Isaac Thornton", "isaac.thornton@ironhaven.example.com",  "+1-860-555-0102", "1 Constitution Plaza, Hartford CT 06103"),
    ("CUST010", "Juniper Biotech",        "Jasmine Al-Farsi","j.alfarsi@juniperbio.example.com",     "+1-858-555-0175", "10555 Science Center Dr, San Diego CA 92121"),
    ("CUST011", "Keystone Legal Partners","Kevin O'Reilly", "koreilly@keystonelaw.example.com",      "+1-215-555-0128", "1735 Market St, Philadelphia PA 19103"),
    ("CUST012", "Lakeside Hotels Group",  "Laila Ahmed",    "l.ahmed@lakesidehotels.example.com",    "+1-312-555-0184", "155 N Wacker Dr, Chicago IL 60606"),
    ("CUST013", "Meridian Media Holdings","Marcus Reyes",   "m.reyes@meridianmedia.example.com",     "+1-212-555-0169", "1211 Ave of the Americas, New York NY 10036"),
    ("CUST014", "Northwind Health Network","Ned Hart",      "n.hart@northwind.example.com",          "+1-415-555-0155", "1500 Owens St, San Francisco CA 94158"),
    ("CUST015", "Oakwood Pharmaceuticals","Olivia Bennett", "o.bennett@oakwoodpharma.example.com",   "+1-732-555-0111", "300 Overlook Dr, Somerset NJ 08873"),
    ("CUST016", "Pinnacle Energy Corp.",  "Priya Desai",    "p.desai@pinnacleenergy.example.com",    "+1-713-555-0193", "1000 Louisiana St, Houston TX 77002"),
    ("CUST017", "Quantum Software Labs",  "Quentin Barnes", "q.barnes@quantumlabs.example.com",      "+1-206-555-0107", "500 Boren Ave N, Seattle WA 98109"),
    ("CUST018", "Riverstone Capital",     "Renee Kowalski", "r.kowalski@riverstonecap.example.com",  "+1-646-555-0177", "375 Park Ave, New York NY 10152"),
    ("CUST019", "Summit Automotive",      "Simone Nakamura","s.nakamura@summitauto.example.com",     "+1-248-555-0136", "1 American Rd, Dearborn MI 48126"),
    ("CUST020", "Trailblazer Aerospace",  "Terrence Wu",    "t.wu@trailblazer-aero.example.com",     "+1-310-555-0148", "2201 Seal Beach Blvd, Seal Beach CA 90740"),
]

DEMO_WAREHOUSES = [
    ("WH001", "Newark Main Warehouse", "123 Industrial Way, Newark NJ 07105"),
    ("WH002", "Oakland West Coast Hub", "700 Harbor Blvd, Oakland CA 94607"),
    ("WH003", "Dallas Central Depot",   "4500 Trade Center Dr, Dallas TX 75237"),
    ("WH004", "Atlanta Southern Facility", "2500 Fulton Industrial Blvd, Atlanta GA 30336"),
]

# (code, name, description)
ZONES = [
    ("RECEIVING", "Receiving Dock",       "Inbound docking for customer returns"),
    ("PROCESSING","Processing Area",      "Wipe, disassembly, refurbishment"),
    ("TESTING",   "Testing Bay",          "Functional + diagnostic testing"),
    ("STORAGE_A", "Storage Area A",       "General bulk storage"),
    ("STORAGE_B", "Storage Area B",       "Secure / high-value storage"),
    ("RESALE",    "Resale Staging",       "Ready for shipment to buyers"),
    ("RECYCLING", "Recycling Area",       "Certified recycling handoff"),
    ("SCRAP",     "Scrap Bin",            "Final scrap prior to destruction"),
]

# (manufacturer, model, device_type, base_msrp)
DEVICE_CATALOG = [
    # Laptops
    ("Dell",    "Latitude 5420",        DeviceType.LAPTOP,  1400),
    ("Dell",    "Latitude 5430",        DeviceType.LAPTOP,  1500),
    ("Dell",    "Latitude 7420",        DeviceType.LAPTOP,  1800),
    ("Dell",    "XPS 13 9310",          DeviceType.LAPTOP,  1600),
    ("Dell",    "XPS 15 9520",          DeviceType.LAPTOP,  2200),
    ("HP",      "EliteBook 840 G8",     DeviceType.LAPTOP,  1500),
    ("HP",      "EliteBook 850 G9",     DeviceType.LAPTOP,  1700),
    ("HP",      "ProBook 450 G9",       DeviceType.LAPTOP,  1100),
    ("HP",      "ZBook Fury 15",        DeviceType.LAPTOP,  2500),
    ("Lenovo",  "ThinkPad T14 Gen 3",   DeviceType.LAPTOP,  1600),
    ("Lenovo",  "ThinkPad X1 Carbon G10",DeviceType.LAPTOP, 2100),
    ("Lenovo",  "ThinkPad P16",         DeviceType.LAPTOP,  2600),
    ("Lenovo",  "IdeaPad 5 Pro",        DeviceType.LAPTOP,  900),
    ("Apple",   "MacBook Air M2",       DeviceType.LAPTOP,  1300),
    ("Apple",   "MacBook Pro 14 M2 Pro",DeviceType.LAPTOP,  2400),
    ("Apple",   "MacBook Pro 16 M2 Max",DeviceType.LAPTOP,  3500),
    ("Microsoft","Surface Laptop 5",    DeviceType.LAPTOP,  1500),

    # Desktops
    ("Dell",    "OptiPlex 7090",        DeviceType.DESKTOP, 1000),
    ("Dell",    "Precision 3660 Tower", DeviceType.DESKTOP, 1800),
    ("HP",      "EliteDesk 800 G9",     DeviceType.DESKTOP, 1200),
    ("HP",      "Z2 Tower G9",          DeviceType.DESKTOP, 1900),
    ("Lenovo",  "ThinkCentre M90a",     DeviceType.DESKTOP, 1300),
    ("Apple",   "iMac 24 M1",           DeviceType.DESKTOP, 1500),
    ("Apple",   "Mac mini M2",          DeviceType.DESKTOP,  700),

    # Monitors
    ("Dell",    "UltraSharp U2723QE",   DeviceType.MONITOR,  650),
    ("Dell",    "UltraSharp U3223QE",   DeviceType.MONITOR,  900),
    ("HP",      "Z27k G3",              DeviceType.MONITOR,  700),
    ("LG",      "27UP850-W UltraFine",  DeviceType.MONITOR,  500),
    ("Samsung", "ViewFinity S8 32\"",   DeviceType.MONITOR,  750),
    ("BenQ",    "PD3220U DesignVue",    DeviceType.MONITOR, 1100),

    # Mobile / Tablet
    ("Apple",   "iPhone 14 Pro 128GB",  DeviceType.MOBILE,  1000),
    ("Apple",   "iPhone 13 128GB",      DeviceType.MOBILE,   700),
    ("Samsung", "Galaxy S23 128GB",     DeviceType.MOBILE,   800),
    ("Samsung", "Galaxy S22 128GB",     DeviceType.MOBILE,   700),
    ("Google",  "Pixel 7 Pro 128GB",    DeviceType.MOBILE,   900),
    ("Apple",   "iPad 10th Gen 64GB",   DeviceType.TABLET,   450),
    ("Apple",   "iPad Pro 12.9 M2",     DeviceType.TABLET,  1100),
    ("Samsung", "Galaxy Tab S8",        DeviceType.TABLET,   700),
    ("Microsoft","Surface Pro 9",       DeviceType.TABLET,  1100),

    # Server
    ("Dell",    "PowerEdge R650",       DeviceType.SERVER,  6500),
    ("Dell",    "PowerEdge R750",       DeviceType.SERVER,  8500),
    ("HPE",     "ProLiant DL380 Gen11", DeviceType.SERVER,  7500),
    ("HPE",     "ProLiant DL360 Gen11", DeviceType.SERVER,  6800),
    ("Lenovo",  "ThinkSystem SR650 V3", DeviceType.SERVER,  7200),

    # Network
    ("Cisco",   "Catalyst 9300-24T",    DeviceType.NETWORK, 4500),
    ("Cisco",   "Catalyst 2960-X",      DeviceType.NETWORK, 2000),
    ("Cisco",   "Meraki MS250-48",      DeviceType.NETWORK, 5500),
    ("Aruba",   "CX 6300M-24G",         DeviceType.NETWORK, 3500),
    ("Juniper", "EX2300-48P",           DeviceType.NETWORK, 3200),
    ("Ubiquiti","UniFi Switch Pro 48",  DeviceType.NETWORK,  800),

    # Printer
    ("HP",      "LaserJet Pro M404dn",  DeviceType.PRINTER,   350),
    ("HP",      "Color LaserJet M479",  DeviceType.PRINTER,   600),
    ("Brother", "MFC-L8900CDW",         DeviceType.PRINTER,   700),
    ("Xerox",   "VersaLink C405",       DeviceType.PRINTER,   900),

    # Other
    ("Logitech","MX Master 3S",         DeviceType.OTHER,     100),
    ("Logitech","MX Keys",              DeviceType.OTHER,     120),
    ("Poly",    "Voyager Focus 2 UC",   DeviceType.OTHER,     280),
]

CATEGORIES = [
    ("Compute",   "Servers, desktops, laptops"),
    ("Display",   "Monitors and screens"),
    ("Mobile",    "Phones and tablets"),
    ("Network",   "Switches, routers, wireless"),
    ("Storage",   "External storage arrays"),
    ("Peripheral","Keyboards, mice, headsets, printers"),
    ("Other",     "Miscellaneous devices"),
]

CATEGORY_BY_DEVICE = {
    DeviceType.LAPTOP:  "Compute",
    DeviceType.DESKTOP: "Compute",
    DeviceType.SERVER:  "Compute",
    DeviceType.MONITOR: "Display",
    DeviceType.MOBILE:  "Mobile",
    DeviceType.TABLET:  "Mobile",
    DeviceType.NETWORK: "Network",
    DeviceType.PRINTER: "Peripheral",
    DeviceType.OTHER:   "Peripheral",
}

TAG_PREFIX = {
    DeviceType.LAPTOP:  "LAP",
    DeviceType.DESKTOP: "DSK",
    DeviceType.MONITOR: "MON",
    DeviceType.MOBILE:  "MOB",
    DeviceType.TABLET:  "TAB",
    DeviceType.SERVER:  "SRV",
    DeviceType.NETWORK: "NET",
    DeviceType.PRINTER: "PRN",
    DeviceType.OTHER:   "OTH",
}

CONDITION_NOTES = {
    AssetCondition.NEW.value:       ["Factory-sealed unit", "Unopened retail box"],
    AssetCondition.EXCELLENT.value: ["Light use, no visible wear", "Cosmetically like-new"],
    AssetCondition.GOOD.value:      ["Minor cosmetic wear", "Light scratches on chassis", "Fully functional"],
    AssetCondition.FAIR.value:      ["Visible scratches; keyboard shows use", "Battery below 80%", "Some port wear"],
    AssetCondition.POOR.value:      ["Cracked bezel", "Battery under 50%", "Missing feet / rubber"],
    AssetCondition.DAMAGED.value:   ["Cracked screen — parts unit", "Won't boot, no POST", "Water damage indicator triggered"],
    AssetCondition.SCRAP.value:     ["Beyond economic repair", "Recovering metals only"],
}

STATUS_NOTES = {
    AssetStatus.SOLD.value:      ["Sold to secondary market broker", "Sold via B-stock auction"],
    AssetStatus.RECYCLED.value:  ["Sent to R2v3 certified recycler", "Handoff to e-Stewards partner"],
    AssetStatus.DISPOSED.value:  ["Certificate of destruction issued", "Data destruction verified"],
    AssetStatus.ON_HOLD.value:   ["Hold pending customer authorization", "Data verification hold"],
}

STATUS_WEIGHTS = [
    (AssetStatus.RECEIVED.value,             20),
    (AssetStatus.PROCESSING.value,           14),
    (AssetStatus.TESTING.value,              10),
    (AssetStatus.READY_FOR_RESALE.value,     16),
    (AssetStatus.SOLD.value,                 12),
    (AssetStatus.READY_FOR_RECYCLING.value,   8),
    (AssetStatus.RECYCLED.value,              8),
    (AssetStatus.DISPOSED.value,              4),
    (AssetStatus.ON_HOLD.value,               4),
    (AssetStatus.IN_TRANSIT.value,            2),
    (AssetStatus.COLLECTED.value,             2),
]

CONDITION_WEIGHTS = [
    (AssetCondition.NEW.value,        3),
    (AssetCondition.EXCELLENT.value, 22),
    (AssetCondition.GOOD.value,      38),
    (AssetCondition.FAIR.value,      18),
    (AssetCondition.POOR.value,       9),
    (AssetCondition.DAMAGED.value,    7),
    (AssetCondition.SCRAP.value,      3),
]

CONDITION_RESALE_FACTOR = {
    AssetCondition.NEW.value:       0.72,
    AssetCondition.EXCELLENT.value: 0.55,
    AssetCondition.GOOD.value:      0.40,
    AssetCondition.FAIR.value:      0.25,
    AssetCondition.POOR.value:      0.12,
    AssetCondition.DAMAGED.value:   0.05,
    AssetCondition.SCRAP.value:     0.01,
}

STATUS_TO_ZONE = {
    AssetStatus.COLLECTED.value:           "RECEIVING",
    AssetStatus.IN_TRANSIT.value:          "RECEIVING",
    AssetStatus.RECEIVED.value:            "RECEIVING",
    AssetStatus.PROCESSING.value:          "PROCESSING",
    AssetStatus.TESTING.value:             "TESTING",
    AssetStatus.READY_FOR_RESALE.value:    "RESALE",
    AssetStatus.SOLD.value:                "RESALE",
    AssetStatus.READY_FOR_RECYCLING.value: "RECYCLING",
    AssetStatus.RECYCLED.value:            "RECYCLING",
    AssetStatus.DISPOSED.value:            "SCRAP",
    AssetStatus.ON_HOLD.value:             "STORAGE_B",
}

# Ordered lifecycle path used to synthesise multi-step movement history.
STATUS_LIFECYCLE_ORDER = [
    AssetStatus.COLLECTED.value,
    AssetStatus.IN_TRANSIT.value,
    AssetStatus.RECEIVED.value,
    AssetStatus.PROCESSING.value,
    AssetStatus.TESTING.value,
    AssetStatus.READY_FOR_RESALE.value,
    AssetStatus.SOLD.value,
]

STATUS_LIFECYCLE_RECYCLE = [
    AssetStatus.COLLECTED.value,
    AssetStatus.RECEIVED.value,
    AssetStatus.PROCESSING.value,
    AssetStatus.READY_FOR_RECYCLING.value,
    AssetStatus.RECYCLED.value,
]

STATUS_LIFECYCLE_DISPOSE = [
    AssetStatus.RECEIVED.value,
    AssetStatus.PROCESSING.value,
    AssetStatus.DISPOSED.value,
]


# ---------------------------------------------------------------------------
# Ensure functions
# ---------------------------------------------------------------------------

def _ensure_roles(db: Session) -> dict[str, Role]:
    result: dict[str, Role] = {}
    for name in RoleName:
        r = db.execute(select(Role).where(Role.name == name.value)).scalar_one_or_none()
        if not r:
            r = Role(name=name.value, description=f"{name.value.title()} role")
            db.add(r)
            db.flush()
        result[name.value] = r
    return result


def _ensure_users(db: Session, roles: dict[str, Role]) -> dict[str, User]:
    result: dict[str, User] = {}
    for name, email, role in DEMO_USERS:
        u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if not u:
            u = User(
                name=name,
                email=email,
                password_hash=hash_password(settings.DEMO_PASSWORD),
                role_id=roles[role.value].id,
                is_active=True,
            )
            db.add(u)
            db.flush()
        result[email] = u
    return result


def _ensure_customers(db: Session) -> list[Customer]:
    result: list[Customer] = []
    for code, name, contact, email, phone, address in DEMO_CUSTOMERS:
        c = db.execute(select(Customer).where(Customer.customer_code == code)).scalar_one_or_none()
        if not c:
            c = Customer(
                customer_code=code,
                name=name,
                contact_name=contact,
                email=email,
                phone=phone,
                address=address,
            )
            db.add(c)
            db.flush()
        result.append(c)
    return result


def _ensure_warehouses(db: Session) -> list[Warehouse]:
    warehouses: list[Warehouse] = []
    for code, name, address in DEMO_WAREHOUSES:
        w = db.execute(select(Warehouse).where(Warehouse.code == code)).scalar_one_or_none()
        if not w:
            w = Warehouse(code=code, name=name, address=address, description=f"{name} — primary regional hub")
            db.add(w)
            db.flush()
        warehouses.append(w)
    for w in warehouses:
        for code, name, desc in ZONES:
            z = db.execute(
                select(WarehouseZone).where(
                    WarehouseZone.warehouse_id == w.id, WarehouseZone.code == code
                )
            ).scalar_one_or_none()
            if not z:
                db.add(WarehouseZone(warehouse_id=w.id, code=code, name=name, description=desc))
        db.flush()
    return warehouses


def _ensure_categories(db: Session) -> list[AssetCategory]:
    result: list[AssetCategory] = []
    for name, desc in CATEGORIES:
        c = db.execute(select(AssetCategory).where(AssetCategory.name == name)).scalar_one_or_none()
        if not c:
            c = AssetCategory(name=name, description=desc)
            db.add(c)
            db.flush()
        result.append(c)
    return result


def _ensure_lots(db: Session, customers: list[Customer]) -> list[Lot]:
    lots: list[Lot] = []
    year = datetime.utcnow().year
    for cust in customers:
        for j in range(_RNG.randint(2, 4)):
            num = f"LOT-{year}-{cust.customer_code[-3:]}-{j + 1:02d}"
            lot = db.execute(select(Lot).where(Lot.lot_number == num)).scalar_one_or_none()
            if not lot:
                received = date.today() - timedelta(days=_RNG.randint(1, 180))
                # Skew status by age: older lots more likely closed
                age_days = (date.today() - received).days
                status = LotStatus.CLOSED.value if age_days > 120 else (
                    LotStatus.PROCESSING.value if age_days > 30 else LotStatus.OPEN.value
                )
                lot = Lot(
                    lot_number=num,
                    customer_id=cust.id,
                    description=f"Batch #{j + 1} — pickup from {cust.name}",
                    received_date=received,
                    status=status,
                )
                db.add(lot)
                db.flush()
            lots.append(lot)
    return lots


# ---------------------------------------------------------------------------
# Asset seeding
# ---------------------------------------------------------------------------

def _weighted(items: list[tuple[str, int]]) -> str:
    values, weights = zip(*items)
    return _RNG.choices(values, weights=weights, k=1)[0]


def _random_serial(mfr: str) -> str:
    return f"{mfr[:3].upper()}{_RNG.randint(100_000_000, 999_999_999)}"


def _resale_value(base_msrp: float, condition: str, age_days: int, dtype: DeviceType) -> float | None:
    """Approximate depreciation-based resale value."""
    if dtype == DeviceType.SERVER:
        floor = 0.06
    elif dtype in {DeviceType.LAPTOP, DeviceType.DESKTOP, DeviceType.MOBILE, DeviceType.TABLET}:
        floor = 0.04
    else:
        floor = 0.03

    years = age_days / 365
    time_factor = max(floor, 0.72 ** years)  # ~28% depreciation/year
    condition_factor = CONDITION_RESALE_FACTOR.get(condition, 0.2)
    value = base_msrp * time_factor * condition_factor
    # add some jitter
    value *= _RNG.uniform(0.9, 1.1)
    if value < 5:
        return None
    return round(value, 2)


def _lifecycle_path(target_status: str) -> list[str]:
    """Return an ordered list of statuses ending at target_status."""
    if target_status == AssetStatus.ON_HOLD.value:
        return [AssetStatus.RECEIVED.value, AssetStatus.PROCESSING.value, AssetStatus.ON_HOLD.value]
    if target_status in {AssetStatus.SOLD.value, AssetStatus.READY_FOR_RESALE.value}:
        idx = STATUS_LIFECYCLE_ORDER.index(target_status)
        return STATUS_LIFECYCLE_ORDER[: idx + 1]
    if target_status in {AssetStatus.RECYCLED.value, AssetStatus.READY_FOR_RECYCLING.value}:
        idx = STATUS_LIFECYCLE_RECYCLE.index(target_status)
        return STATUS_LIFECYCLE_RECYCLE[: idx + 1]
    if target_status == AssetStatus.DISPOSED.value:
        return STATUS_LIFECYCLE_DISPOSE[:]
    # earlier stages
    if target_status in STATUS_LIFECYCLE_ORDER:
        idx = STATUS_LIFECYCLE_ORDER.index(target_status)
        return STATUS_LIFECYCLE_ORDER[: idx + 1]
    return [target_status]


def _seed_assets(
    db: Session,
    *,
    users: dict[str, User],
    customers: list[Customer],
    warehouses: list[Warehouse],
    categories: list[AssetCategory],
    lots: list[Lot],
    target: int,
) -> None:
    existing = db.execute(select(func.count(Asset.id))).scalar_one()
    if existing >= target:
        log.info("Assets already seeded (%s)", existing)
        return

    intake_user     = users["intake@example.com"]
    processing_user = users["processing@example.com"]
    sales_user      = users["sales@example.com"]
    admin_user      = users["admin@example.com"]

    intake_pool = [
        u for u in users.values() if u.role.name == RoleName.INTAKE.value
    ] or [intake_user]
    processing_pool = [
        u for u in users.values() if u.role.name == RoleName.PROCESSING.value
    ] or [processing_user]
    sales_pool = [
        u for u in users.values() if u.role.name == RoleName.SALES.value
    ] or [sales_user]

    warehouse_zones: dict[int, list[WarehouseZone]] = {
        w.id: db.execute(select(WarehouseZone).where(WarehouseZone.warehouse_id == w.id)).scalars().all()
        for w in warehouses
    }
    cats_by_name = {c.name: c for c in categories}

    to_create = target - existing
    log.info("Seeding %s new assets (existing=%s target=%s)", to_create, existing, target)

    tag_base = existing + 1
    for i in range(to_create):
        manufacturer, model, dtype, base_msrp = _RNG.choice(DEVICE_CATALOG)
        customer = _RNG.choice(customers)
        wh = _RNG.choice(warehouses)
        zones = warehouse_zones[wh.id]
        status = _weighted(STATUS_WEIGHTS)
        condition = _weighted(CONDITION_WEIGHTS)

        preferred_code = STATUS_TO_ZONE.get(status, "STORAGE_A")
        zone = next((z for z in zones if z.code == preferred_code), _RNG.choice(zones))

        prefix = TAG_PREFIX[dtype]
        seq = tag_base + i
        tag = f"{prefix}-{seq:06d}"
        serial = _random_serial(manufacturer)
        barcode = f"BC{seq:08d}"

        matching_lots = [l for l in lots if l.customer_id == customer.id]
        lot = _RNG.choice(matching_lots) if matching_lots else None
        cat = cats_by_name.get(CATEGORY_BY_DEVICE[dtype])

        received_days_ago = _RNG.randint(1, 180)
        received = date.today() - timedelta(days=received_days_ago)
        purchase_date = received - timedelta(days=_RNG.randint(365, 1500))
        age_days = (date.today() - purchase_date).days

        # Derived dates by status
        processed = None
        disposition = None
        if status in {
            AssetStatus.PROCESSING.value,
            AssetStatus.TESTING.value,
            AssetStatus.READY_FOR_RESALE.value,
            AssetStatus.SOLD.value,
            AssetStatus.READY_FOR_RECYCLING.value,
            AssetStatus.RECYCLED.value,
            AssetStatus.DISPOSED.value,
        }:
            processed = received + timedelta(days=_RNG.randint(1, min(14, received_days_ago)))
        if status in {AssetStatus.SOLD.value, AssetStatus.RECYCLED.value, AssetStatus.DISPOSED.value}:
            disposition = date.today() - timedelta(days=_RNG.randint(0, min(30, received_days_ago)))

        resale = _resale_value(base_msrp, condition, age_days, dtype)

        note_bits: list[str] = []
        if condition in CONDITION_NOTES and _RNG.random() < 0.55:
            note_bits.append(_RNG.choice(CONDITION_NOTES[condition]))
        if status in STATUS_NOTES and _RNG.random() < 0.4:
            note_bits.append(_RNG.choice(STATUS_NOTES[status]))
        notes = " · ".join(note_bits) if note_bits else None

        asset = Asset(
            asset_tag=tag,
            serial_number=serial,
            barcode=barcode,
            customer_id=customer.id,
            lot_id=lot.id if lot else None,
            category_id=cat.id if cat else None,
            manufacturer=manufacturer,
            model=model,
            device_type=dtype.value,
            condition=condition,
            status=status,
            warehouse_id=wh.id,
            zone_id=zone.id,
            purchase_date=purchase_date,
            received_date=received,
            processed_date=processed,
            disposition_date=disposition,
            resale_value=resale,
            notes=notes,
        )
        db.add(asset)
        db.flush()

        # Movement history following the lifecycle
        path = _lifecycle_path(status)
        prev_status: str | None = None
        prev_zone_id: int | None = None
        prev_wh_id: int | None = None
        base_ts = datetime.utcnow() - timedelta(days=received_days_ago)

        for step_idx, step_status in enumerate(path):
            step_zone_code = STATUS_TO_ZONE.get(step_status, "STORAGE_A")
            step_zone = next((z for z in zones if z.code == step_zone_code), zone)
            step_wh = wh

            if step_status == AssetStatus.SOLD.value:
                actor = _RNG.choice(sales_pool)
                mtype = MovementType.SALE.value
                note = "Shipped to buyer"
            elif step_status == AssetStatus.RECYCLED.value:
                actor = _RNG.choice(processing_pool)
                mtype = MovementType.RECYCLING.value
                note = "Handed to certified recycler"
            elif step_status == AssetStatus.DISPOSED.value:
                actor = _RNG.choice(processing_pool)
                mtype = MovementType.DISPOSAL.value
                note = "Destruction certificate #DC-" + str(_RNG.randint(10000, 99999))
            elif step_status == AssetStatus.RECEIVED.value and step_idx == 0:
                actor = _RNG.choice(intake_pool)
                mtype = MovementType.RECEIVED.value
                note = f"Received from {customer.name}"
            elif step_status in {AssetStatus.COLLECTED.value, AssetStatus.IN_TRANSIT.value}:
                actor = _RNG.choice(intake_pool)
                mtype = MovementType.RECEIVED.value if step_status == AssetStatus.COLLECTED.value else MovementType.TRANSFER.value
                note = "Collection scheduled" if step_status == AssetStatus.COLLECTED.value else "In transit to warehouse"
            elif step_status in {AssetStatus.PROCESSING.value, AssetStatus.TESTING.value}:
                actor = _RNG.choice(processing_pool)
                mtype = MovementType.PROCESSING.value
                note = "Moved for processing" if step_status == AssetStatus.PROCESSING.value else "Moved to test bay"
            elif step_status == AssetStatus.READY_FOR_RESALE.value:
                actor = _RNG.choice(processing_pool)
                mtype = MovementType.TRANSFER.value
                note = "Passed QC — staged for resale"
            elif step_status == AssetStatus.READY_FOR_RECYCLING.value:
                actor = _RNG.choice(processing_pool)
                mtype = MovementType.TRANSFER.value
                note = "Not economically repairable — recycling"
            else:
                actor = _RNG.choice(processing_pool)
                mtype = MovementType.OTHER.value
                note = f"Moved to {step_status}"

            # Timestamps monotonically increase within the asset's lifecycle
            offset_days = int(received_days_ago * step_idx / max(1, len(path) - 1))
            ts = base_ts + timedelta(days=offset_days, hours=_RNG.randint(0, 23), minutes=_RNG.randint(0, 59))

            db.add(
                AssetMovement(
                    asset_id=asset.id,
                    from_warehouse_id=prev_wh_id,
                    from_zone_id=prev_zone_id,
                    to_warehouse_id=step_wh.id,
                    to_zone_id=step_zone.id,
                    from_status=prev_status,
                    to_status=step_status,
                    movement_type=mtype,
                    reference_number=f"MV-{seq:06d}-{step_idx + 1}",
                    performed_by=actor.id,
                    notes=note,
                    timestamp=ts,
                )
            )

            prev_status = step_status
            prev_zone_id = step_zone.id
            prev_wh_id = step_wh.id

        # Audit entries
        db.add(
            AuditLog(
                user_id=intake_user.id,
                entity_type="ASSET",
                entity_id=str(asset.id),
                action="ASSET_CREATED",
                new_values={
                    "asset_tag": asset.asset_tag,
                    "customer": customer.name,
                    "device_type": dtype.value,
                    "condition": condition,
                    "warehouse": wh.code,
                },
                ip_address="10.0.0." + str(_RNG.randint(2, 250)),
                timestamp=base_ts,
            )
        )
        if status != AssetStatus.RECEIVED.value:
            db.add(
                AuditLog(
                    user_id=processing_user.id,
                    entity_type="ASSET",
                    entity_id=str(asset.id),
                    action="STATUS_CHANGED",
                    old_values={"status": AssetStatus.RECEIVED.value},
                    new_values={"status": status},
                    ip_address="10.0.0." + str(_RNG.randint(2, 250)),
                    timestamp=base_ts + timedelta(days=max(1, received_days_ago // 2)),
                )
            )
        if _RNG.random() < 0.1:
            db.add(
                AuditLog(
                    user_id=admin_user.id,
                    entity_type="ASSET",
                    entity_id=str(asset.id),
                    action="ASSET_UPDATED",
                    new_values={"notes": notes or "reviewed"},
                    ip_address="10.0.0." + str(_RNG.randint(2, 250)),
                    timestamp=datetime.utcnow() - timedelta(hours=_RNG.randint(1, 72)),
                )
            )

        if (i + 1) % 250 == 0:
            db.commit()
            log.info("... %s assets seeded", i + 1)

    db.commit()


# ---------------------------------------------------------------------------
# Login-history audit entries (a bit of extra realism)
# ---------------------------------------------------------------------------

def _seed_login_audit(db: Session, users: dict[str, User]) -> None:
    already = db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.action == "LOGIN")
    ).scalar_one()
    if already:
        return
    now = datetime.utcnow()
    for u in users.values():
        for _ in range(_RNG.randint(3, 8)):
            db.add(
                AuditLog(
                    user_id=u.id,
                    entity_type="USER",
                    entity_id=str(u.id),
                    action="LOGIN",
                    new_values={"email": u.email},
                    ip_address="10.0.0." + str(_RNG.randint(2, 250)),
                    timestamp=now - timedelta(days=_RNG.randint(0, 30), hours=_RNG.randint(0, 23)),
                )
            )
    db.commit()


def run_seed(target_assets: int = 500) -> None:
    db: Session = SessionLocal()
    try:
        roles = _ensure_roles(db)
        db.commit()
        users = _ensure_users(db, roles)
        customers = _ensure_customers(db)
        warehouses = _ensure_warehouses(db)
        categories = _ensure_categories(db)
        db.commit()
        lots = _ensure_lots(db, customers)
        db.commit()
        _seed_assets(
            db,
            users=users,
            customers=customers,
            warehouses=warehouses,
            categories=categories,
            lots=lots,
            target=target_assets,
        )
        _seed_login_audit(db, users)
        log.info("Seed complete")
    except Exception as e:
        db.rollback()
        log.exception("Seed failed: %s", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    run_seed()
