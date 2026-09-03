from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services import dashboard_service

router = APIRouter()


@router.get("", response_model=DashboardResponse)
def dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return dashboard_service.build_dashboard(db)
