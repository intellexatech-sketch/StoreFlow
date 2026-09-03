from __future__ import annotations

from fastapi import HTTPException, status


class APIError(HTTPException):
    def __init__(self, code: str, message: str, http_status: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=http_status, detail={"code": code, "message": message})
        self.code = code
        self.message = message


class NotFoundError(APIError):
    def __init__(self, code: str = "NOT_FOUND", message: str = "Resource not found"):
        super().__init__(code, message, http_status=status.HTTP_404_NOT_FOUND)


class ConflictError(APIError):
    def __init__(self, code: str = "CONFLICT", message: str = "Conflict"):
        super().__init__(code, message, http_status=status.HTTP_409_CONFLICT)


class PermissionDeniedError(APIError):
    def __init__(self, code: str = "PERMISSION_DENIED", message: str = "Permission denied"):
        super().__init__(code, message, http_status=status.HTTP_403_FORBIDDEN)


class UnauthorizedError(APIError):
    def __init__(self, code: str = "UNAUTHORIZED", message: str = "Authentication required"):
        super().__init__(code, message, http_status=status.HTTP_401_UNAUTHORIZED)


class ValidationError(APIError):
    def __init__(self, code: str = "VALIDATION_ERROR", message: str = "Invalid input"):
        super().__init__(code, message, http_status=status.HTTP_422_UNPROCESSABLE_ENTITY)
