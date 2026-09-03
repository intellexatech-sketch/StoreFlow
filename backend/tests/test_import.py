import io


CSV_GOOD = b"""asset_tag,serial_number,barcode,customer_code,device_type,condition,status,warehouse_code,zone_code,manufacturer,model
IMP-0001,IMPSER-1,IMPBC-1,C001,Laptop,Good,RECEIVED,WH01,RECEIVING,Dell,Latitude
IMP-0002,IMPSER-2,IMPBC-2,C001,Desktop,Fair,RECEIVED,WH01,RECEIVING,HP,EliteDesk
"""

CSV_BAD_HEADER = b"""asset_tag,serial_number
IMP-9999,SER-9999
"""


def test_csv_import_success(client, auth):
    r = client.post(
        "/api/v1/import/assets",
        files={"file": ("assets.csv", io.BytesIO(CSV_GOOD), "text/csv")},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["successful"] == 2
    assert data["failed"] == 0


def test_csv_import_bad_header(client, auth):
    r = client.post(
        "/api/v1/import/assets",
        files={"file": ("assets.csv", io.BytesIO(CSV_BAD_HEADER), "text/csv")},
        headers=auth,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["successful"] == 0
    assert data["errors"]
