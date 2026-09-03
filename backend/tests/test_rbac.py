import pytest


@pytest.fixture
def intake_token(client):
    r = client.post("/api/v1/auth/login", json={"email": "intake@test.com", "password": "secret1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_intake_can_create_asset(client, intake_token):
    payload = {
        "asset_tag": "RBAC-000001",
        "serial_number": "SER-RBAC-1",
        "barcode": "BC-RBAC-1",
        "customer_id": 1,
        "device_type": "Laptop",
        "condition": "Good",
        "status": "RECEIVED",
        "warehouse_id": 1,
        "zone_id": 1,
    }
    r = client.post("/api/v1/assets", json=payload, headers={"Authorization": f"Bearer {intake_token}"})
    assert r.status_code == 201


def test_intake_cannot_list_users(client, intake_token):
    r = client.get("/api/v1/users", headers={"Authorization": f"Bearer {intake_token}"})
    assert r.status_code == 403


def test_intake_cannot_view_audit(client, intake_token):
    r = client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {intake_token}"})
    assert r.status_code == 403
