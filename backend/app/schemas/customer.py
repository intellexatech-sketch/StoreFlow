from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr


class CustomerBase(BaseModel):
    customer_code: str
    name: str
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None


class CustomerOut(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
