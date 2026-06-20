import enum
import uuid
from datetime import datetime, date

from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, ForeignKey, Enum, UniqueConstraint, String as SAString
)
from sqlalchemy.orm import relationship

from app.database import Base, is_sqlite


class UUIDString(SAString):
    """UUID type that works as string in both PostgreSQL and SQLite."""
    pass


def UUIDColumn(**kwargs):
    """UUID column that works with both PostgreSQL and SQLite."""
    return Column(UUIDString(36), **kwargs)


class RoleEnum(str, enum.Enum):
    student = "student"
    admin = "admin"
    developer = "developer"


class User(Base):
    __tablename__ = "users"

    id = UUIDColumn(primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(RoleEnum, name="role_enum"), nullable=False, default=RoleEnum.student)
    created_at = Column(DateTime, default=datetime.utcnow)

    attendances = relationship("Attendance", back_populates="user", cascade="all, delete-orphan")


class QRCode(Base):
    __tablename__ = "qr_codes"

    id = UUIDColumn(primary_key=True, default=lambda: str(uuid.uuid4()))
    secret = Column(String, unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUIDString(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    label = Column(String, nullable=True)  # optional friendly name, e.g. "Lab A - Morning"

    attendances = relationship("Attendance", back_populates="qr_code")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("user_id", "attendance_date", name="uq_user_attendance_per_day"),
    )

    id = UUIDColumn(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(UUIDString(36), ForeignKey("users.id"), nullable=False)
    qr_code_id = Column(UUIDString(36), ForeignKey("qr_codes.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    attendance_date = Column(Date, default=date.today, nullable=False)  # for fast "today/daily" grouping

    user = relationship("User", back_populates="attendances")
    qr_code = relationship("QRCode", back_populates="attendances")
