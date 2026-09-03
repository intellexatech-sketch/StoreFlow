def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_and_me(client, auth):
    r = client.get("/api/v1/auth/me", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "admin@test.com"
    assert data["role"] == "ADMIN"


def test_protected_requires_auth(client):
    r = client.get("/api/v1/assets")
    assert r.status_code == 401
