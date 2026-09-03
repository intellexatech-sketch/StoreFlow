from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_client_ip, get_current_user
from app.core.exceptions import UnauthorizedError
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services import audit_service

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError(code="INVALID_CREDENTIALS", message="Invalid email or password")

    token = create_access_token(subject=user.id, extra={"role": user.role.name})
    audit_service.record(
        db,
        user_id=user.id,
        entity_type="USER",
        entity_id=user.id,
        action="LOGIN",
        ip_address=get_client_ip(request),
    )
    db.commit()
    return TokenResponse(access_token=token, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role.name,
        is_active=current_user.is_active,
    )


@router.post("/logout")
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    audit_service.record(
        db,
        user_id=current_user.id,
        entity_type="USER",
        entity_id=current_user.id,
        action="LOGOUT",
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "Logged out"}
