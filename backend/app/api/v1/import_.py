from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.core.database import get_db
from app.core.deps import get_client_ip, require_roles
from app.core.exceptions import ValidationError
from app.models.user import User
from app.schemas.asset import ImportSummary
from app.services import import_service
from sqlalchemy.orm import Session

router = APIRouter()


@router.post("/assets", response_model=ImportSummary)
async def import_assets(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "INTAKE")),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise ValidationError("INVALID_FILE", "Please upload a CSV file")
    content = await file.read()
    summary = import_service.import_assets_csv(
        db, content, user=user, ip_address=get_client_ip(request)
    )
    return ImportSummary(**summary)
