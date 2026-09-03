from __future__ import annotations

from typing import Callable, Iterable

from fastapi import Depends, Header, Request
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import PermissionDeniedError, UnauthorizedError
from app.core.security import decode_token
from app.models.user import User


def _extract_token(authorization: str | None) -> str:
    if not authorization:
        raise UnauthorizedError()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError(code="INVALID_TOKEN", message="Invalid authorization header")
    return token


def get_current_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_token(authorization)
    try:
        payload = decode_token(token)
    except JWTError:
        raise UnauthorizedError(code="INVALID_TOKEN", message="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError(code="INVALID_TOKEN", message="Invalid token payload")

    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise UnauthorizedError(code="INACTIVE_USER", message="User inactive or not found")
    return user


def require_roles(*roles: str) -> Callable:
    role_set = {r.upper() for r in roles}

    def _dep(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name.upper() == "ADMIN" or current_user.role.name.upper() in role_set:
            return current_user
        raise PermissionDeniedError(
            code="ROLE_REQUIRED",
            message=f"Requires one of roles: {', '.join(sorted(role_set))}",
        )

    return _dep


def get_client_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None
