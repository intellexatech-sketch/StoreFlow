from fastapi import APIRouter

from app.api.v1 import (
    assets,
    audit,
    auth,
    customers,
    dashboard,
    import_,
    lots,
    meta,
    movements,
    reports,
    users,
    warehouses,
    websocket,
)

api_router = APIRouter()
api_router.include_router(meta.router, prefix="/meta", tags=["meta"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["warehouses"])
api_router.include_router(lots.router, prefix="/lots", tags=["lots"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(movements.router, prefix="/movements", tags=["movements"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["audit"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(import_.router, prefix="/import", tags=["import"])
api_router.include_router(websocket.router, prefix="/ws", tags=["ws"])
