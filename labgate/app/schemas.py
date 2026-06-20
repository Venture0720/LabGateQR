import uuid
from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict
from app.models import RoleEnum


# ---------- Auth ----------

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)
    role: RoleEnum


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    username: str
    role: RoleEnum
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum
    username: str


# ---------- QR Codes ----------

class QRCodeCreate(BaseModel):
    label: Optional[str] = None


class QRCodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    secret: str
    is_active: bool
    label: Optional[str]
    created_at: datetime


# ---------- Attendance ----------

class ScanRequest(BaseModel):
    secret: str


class ScanResponse(BaseModel):
    message: str
    timestamp: datetime
    qr_label: Optional[str] = None


class AttendanceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    user_id: str
    username: str
    timestamp: datetime


class DailyStat(BaseModel):
    attendance_date: date
    count: int


class AttendancePercentage(BaseModel):
    total_registered_students: int
    total_attended_students: int
    attendance_percentage: float
