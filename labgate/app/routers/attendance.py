import secrets
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, QRCode, Attendance, RoleEnum
from app.schemas import (
    QRCodeCreate, QRCodeOut, ScanRequest, ScanResponse,
    AttendanceRecordOut, DailyStat, AttendancePercentage,
)
from app.dependencies import require_admin_or_dev, require_student, get_current_user

router = APIRouter(prefix="/api/v1/attendance", tags=["attendance"])


# ---------------- Student Check-in (Simple) ----------------

@router.post("/check-in")
def check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Simple check-in for the current user."""
    today = date.today()
    already_marked = (
        db.query(Attendance)
        .filter(Attendance.user_id == current_user.id, Attendance.attendance_date == today)
        .first()
    )
    if already_marked:
        raise HTTPException(status_code=400, detail="Already checked in today")

    record = Attendance(user_id=current_user.id, attendance_date=today)
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"message": "Check-in successful", "timestamp": record.timestamp}


@router.get("/records", response_model=list[AttendanceRecordOut])
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's attendance records."""
    records = (
        db.query(Attendance)
        .filter(Attendance.user_id == current_user.id)
        .order_by(Attendance.timestamp.desc())
        .all()
    )
    return [
        AttendanceRecordOut(user_id=r.user_id, username=current_user.username, timestamp=r.timestamp)
        for r in records
    ]


# ---------------- QR Code Management (Admin) ----------------

@router.post("/qr/generate", response_model=QRCodeOut, status_code=status.HTTP_201_CREATED)
def generate_qr_code(
    payload: QRCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    new_secret = secrets.token_urlsafe(24)
    qr = QRCode(secret=new_secret, label=payload.label, created_by=current_user.id, is_active=True)
    db.add(qr)
    db.commit()
    db.refresh(qr)
    return qr


@router.get("/qr/list", response_model=list[QRCodeOut])
def list_qr_codes(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_dev),
):
    return db.query(QRCode).order_by(QRCode.created_at.desc()).all()


@router.patch("/qr/{qr_id}/deactivate", response_model=QRCodeOut)
def deactivate_qr_code(
    qr_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_dev),
):
    qr = db.query(QRCode).filter(QRCode.id == qr_id).first()
    if not qr:
        raise HTTPException(status_code=404, detail="QR code not found")
    qr.is_active = False
    db.commit()
    db.refresh(qr)
    return qr


@router.patch("/qr/{qr_id}/activate", response_model=QRCodeOut)
def activate_qr_code(
    qr_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_dev),
):
    qr = db.query(QRCode).filter(QRCode.id == qr_id).first()
    if not qr:
        raise HTTPException(status_code=404, detail="QR code not found")
    qr.is_active = True
    db.commit()
    db.refresh(qr)
    return qr


@router.delete("/qr/{qr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_qr_code(
    qr_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_dev),
):
    qr = db.query(QRCode).filter(QRCode.id == qr_id).first()
    if not qr:
        raise HTTPException(status_code=404, detail="QR code not found")
    db.delete(qr)
    db.commit()
    return None


# ---------------- Student Scan ----------------

@router.post("/scan", response_model=ScanResponse)
def scan_qr_code(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    qr = db.query(QRCode).filter(QRCode.secret == payload.secret).first()
    if not qr:
        raise HTTPException(status_code=404, detail="QR code not recognized")
    if not qr.is_active:
        raise HTTPException(status_code=400, detail="This QR code has been deactivated")

    today = date.today()
    already_marked = (
        db.query(Attendance)
        .filter(Attendance.user_id == current_user.id, Attendance.attendance_date == today)
        .first()
    )
    if already_marked:
        raise HTTPException(status_code=400, detail="Attendance already recorded for today")

    record = Attendance(user_id=current_user.id, qr_code_id=qr.id, attendance_date=today)
    db.add(record)
    db.commit()
    db.refresh(record)

    return ScanResponse(message="Attendance recorded successfully", timestamp=record.timestamp, qr_label=qr.label)


# ---------------- Admin Analytics ----------------

@router.get("/today", response_model=list[AttendanceRecordOut])
def get_today_attendance(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_dev),
):
    today = date.today()
    rows = (
        db.query(Attendance, User)
        .join(User, Attendance.user_id == User.id)
        .filter(Attendance.attendance_date == today)
        .order_by(Attendance.timestamp.desc())
        .all()
    )
    return [
        AttendanceRecordOut(user_id=u.id, username=u.username, timestamp=a.timestamp)
        for a, u in rows
    ]


@router.get("/history", response_model=list[DailyStat])
def get_attendance_history(
    days: int = 30,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_dev),
):
    """Historical stats grouped by date, most recent first, for the last `days` days."""
    cutoff = date.today() - timedelta(days=days)
    rows = (
        db.query(Attendance.attendance_date, func.count(Attendance.id).label("count"))
        .filter(Attendance.attendance_date >= cutoff)
        .group_by(Attendance.attendance_date)
        .order_by(Attendance.attendance_date.desc())
        .all()
    )
    return [DailyStat(attendance_date=r[0], count=r[1]) for r in rows]


@router.get("/percentage", response_model=AttendancePercentage)
def get_attendance_percentage(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_dev),
):
    total_students = db.query(func.count(User.id)).filter(User.role == RoleEnum.student).scalar() or 0

    total_attended = (
        db.query(func.count(func.distinct(Attendance.user_id)))
        .join(User, Attendance.user_id == User.id)
        .filter(User.role == RoleEnum.student)
        .scalar() or 0
    )

    percentage = (total_attended / total_students * 100) if total_students > 0 else 0.0

    return AttendancePercentage(
        total_registered_students=total_students,
        total_attended_students=total_attended,
        attendance_percentage=round(percentage, 2),
    )
