from __future__ import annotations

import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("SECRET_KEY", "test-secret-key")


@pytest.fixture(scope="session")
def sqlite_url() -> str:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    return f"sqlite:///{path}"


@pytest.fixture(scope="session")
def app(sqlite_url):
    os.environ["DATABASE_URL"] = sqlite_url
    os.environ["SEED_ON_STARTUP"] = "false"

    from app.core import database as db_module
    from app.core.database import Base

    engine = create_engine(
        sqlite_url, connect_args={"check_same_thread": False}, future=True
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    db_module.engine = engine
    db_module.SessionLocal = TestingSession

    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    from app.main import create_app

    return create_app()


@pytest.fixture(scope="session")
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session", autouse=True)
def seed(app):
    from app.core.database import SessionLocal
    from app.core.enums import RoleName
    from app.core.security import hash_password
    from app.models.customer import Customer
    from app.models.role import Role
    from app.models.user import User
    from app.models.warehouse import Warehouse, WarehouseZone

    db = SessionLocal()
    try:
        for name in RoleName:
            db.add(Role(name=name.value))
        db.commit()
        admin_role = db.query(Role).filter(Role.name == "ADMIN").one()
        intake_role = db.query(Role).filter(Role.name == "INTAKE").one()
        db.add(
            User(
                name="Admin",
                email="admin@test.com",
                password_hash=hash_password("secret1234"),
                role_id=admin_role.id,
            )
        )
        db.add(
            User(
                name="Intake",
                email="intake@test.com",
                password_hash=hash_password("secret1234"),
                role_id=intake_role.id,
            )
        )
        db.add(Customer(customer_code="C001", name="Acme Corp"))
        wh = Warehouse(code="WH01", name="Main")
        db.add(wh)
        db.flush()
        db.add(WarehouseZone(warehouse_id=wh.id, code="RECEIVING", name="Recv"))
        db.add(WarehouseZone(warehouse_id=wh.id, code="PROCESSING", name="Proc"))
        db.commit()
    finally:
        db.close()


@pytest.fixture
def admin_token(client) -> str:
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "secret1234"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
