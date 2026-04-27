from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import SessionLocal
from models.payment import Payment, PaymentStatus

router = APIRouter(tags=["admin_payments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_admin_secret() -> str:
    import os

    secret = os.getenv("ADMIN_SECRET")
    if not secret:
        raise RuntimeError("ADMIN_SECRET not configured")
    return secret.strip()


def verify_admin_secret(secret: str) -> None:
    if (secret or "").strip() != get_admin_secret():
        raise HTTPException(status_code=403, detail="Unauthorized")


@router.get("/payments/summary")
def payments_summary(
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin_secret(secret)

    total_orders = db.query(func.count(Payment.id)).scalar() or 0

    paid_orders = (
        db.query(func.count(Payment.id))
        .filter(Payment.status == PaymentStatus.PAID)
        .scalar()
        or 0
    )

    pending_orders = (
        db.query(func.count(Payment.id))
        .filter(Payment.status == PaymentStatus.PENDING)
        .scalar()
        or 0
    )

    failed_orders = (
        db.query(func.count(Payment.id))
        .filter(Payment.status == PaymentStatus.FAILED)
        .scalar()
        or 0
    )

    refunded_orders = (
        db.query(func.count(Payment.id))
        .filter(Payment.status == PaymentStatus.REFUNDED)
        .scalar()
        or 0
    )

    total_revenue = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == PaymentStatus.PAID)
        .scalar()
        or 0
    )

    active_subscriptions = (
        db.query(func.count(Payment.id))
        .filter(
            Payment.status == PaymentStatus.PAID,
            Payment.valid_till > datetime.utcnow(),
        )
        .scalar()
        or 0
    )

    unique_paid_users = (
        db.query(func.count(func.distinct(Payment.user_id)))
        .filter(Payment.status == PaymentStatus.PAID)
        .scalar()
        or 0
    )

    return {
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "pending_orders": pending_orders,
        "failed_orders": failed_orders,
        "refunded_orders": refunded_orders,
        "active_subscriptions": active_subscriptions,
        "unique_paid_users": unique_paid_users,
        "total_revenue": float(total_revenue),
        "currency": "INR",
    }


@router.get("/payments")
def list_payments(
    secret: str = Query(...),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    verify_admin_secret(secret)

    query = db.query(Payment)

    if status:
        try:
            status_enum = PaymentStatus(status.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payment status")

        query = query.filter(Payment.status == status_enum)

    total = query.count()

    payments = (
        query.order_by(Payment.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "payments": [
            {
                "id": p.id,
                "user_id": p.user_id,
                "user_name": p.user_name,
                "user_email": p.user_email,
                "order_id": p.order_id,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "valid_till": p.valid_till.isoformat() if p.valid_till else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                "cf_payment_id": p.cf_payment_id,
                "cf_order_status": p.cf_order_status,
            }
            for p in payments
        ],
    }
