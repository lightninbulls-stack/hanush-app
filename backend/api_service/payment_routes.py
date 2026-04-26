from __future__ import annotations

import csv
import hmac
import hashlib
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api_service.auth_routes import get_current_user
from db import SessionLocal
from models.user import User

router = APIRouter(tags=["payments"])

PLAN_AMOUNT_RUPEES = 399
PLAN_AMOUNT_PAISE = PLAN_AMOUNT_RUPEES * 100
PLAN_DAYS = 14
CURRENCY = "INR"

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
PAYMENTS_FILE = DATA_DIR / "paid_users.csv"

PAYMENT_FIELDS = [
    "user_id",
    "name",
    "email",
    "phone",
    "razorpay_order_id",
    "razorpay_payment_id",
    "amount_rupees",
    "currency",
    "status",
    "paid_at",
    "valid_from",
    "valid_until",
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def parse_dt(value: str | None) -> Optional[datetime]:
    if not value:
        return None

    raw = value.strip()
    if not raw:
        return None

    try:
        if raw.endswith("Z"):
            raw = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def get_razorpay_key_id() -> str:
    value = os.getenv("RAZORPAY_KEY_ID", "").strip()
    if not value:
        raise HTTPException(
            status_code=500,
            detail="RAZORPAY_KEY_ID not configured",
        )
    return value


def get_razorpay_key_secret() -> str:
    value = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    if not value:
        raise HTTPException(
            status_code=500,
            detail="RAZORPAY_KEY_SECRET not configured",
        )
    return value


def get_admin_secret() -> str:
    value = os.getenv("ADMIN_SECRET", "").strip()
    if not value:
        raise HTTPException(status_code=500, detail="ADMIN_SECRET not configured")
    return value


def verify_admin_secret(secret: str) -> None:
    if (secret or "").strip() != get_admin_secret():
        raise HTTPException(status_code=403, detail="Unauthorized")


def load_payment_rows() -> list[dict[str, str]]:
    if not PAYMENTS_FILE.exists():
        return []

    with PAYMENTS_FILE.open("r", newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def save_payment_rows(rows: list[dict[str, str]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with PAYMENTS_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=PAYMENT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def append_payment_row(row: dict[str, str]) -> None:
    rows = load_payment_rows()
    rows.append(row)
    save_payment_rows(rows)


def get_latest_active_payment_for_user(user_id: int) -> Optional[dict[str, str]]:
    now = utc_now()
    rows = load_payment_rows()

    user_rows = [
        row
        for row in rows
        if str(row.get("user_id", "")).strip() == str(user_id)
        and str(row.get("status", "")).strip().lower() == "paid"
    ]

    active_rows = []
    for row in user_rows:
        valid_until = parse_dt(row.get("valid_until"))
        if valid_until and valid_until >= now:
            active_rows.append(row)

    if not active_rows:
        return None

    active_rows.sort(key=lambda r: parse_dt(r.get("valid_until")) or now, reverse=True)
    return active_rows[0]


@router.get("/subscription/status")
def subscription_status(current_user: User = Depends(get_current_user)):
    active_payment = get_latest_active_payment_for_user(current_user.id)

    if not active_payment:
        return {
            "is_active": False,
            "plan_amount": PLAN_AMOUNT_RUPEES,
            "plan_days": PLAN_DAYS,
            "valid_until": None,
        }

    return {
        "is_active": True,
        "plan_amount": PLAN_AMOUNT_RUPEES,
        "plan_days": PLAN_DAYS,
        "valid_until": active_payment.get("valid_until"),
        "razorpay_payment_id": active_payment.get("razorpay_payment_id"),
    }


@router.post("/razorpay/order")
def create_razorpay_order(current_user: User = Depends(get_current_user)):
    key_id = get_razorpay_key_id()
    key_secret = get_razorpay_key_secret()

    receipt = f"lb_{current_user.id}_{int(utc_now().timestamp())}"

    payload = {
        "amount": PLAN_AMOUNT_PAISE,
        "currency": CURRENCY,
        "receipt": receipt,
        "notes": {
            "user_id": str(current_user.id),
            "email": current_user.email,
            "plan": "lightninbull_14_days",
        },
    }

    response = requests.post(
        "https://api.razorpay.com/v1/orders",
        auth=(key_id, key_secret),
        json=payload,
        timeout=20,
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail=f"Razorpay order creation failed: {response.text}",
        )

    order = response.json()

    return {
        "key_id": key_id,
        "order_id": order["id"],
        "amount": PLAN_AMOUNT_PAISE,
        "currency": CURRENCY,
        "plan_amount_rupees": PLAN_AMOUNT_RUPEES,
        "plan_days": PLAN_DAYS,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
    }


@router.post("/razorpay/verify")
def verify_razorpay_payment(
    body: dict,
    current_user: User = Depends(get_current_user),
):
    order_id = str(body.get("razorpay_order_id", "")).strip()
    payment_id = str(body.get("razorpay_payment_id", "")).strip()
    signature = str(body.get("razorpay_signature", "")).strip()

    if not order_id or not payment_id or not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Razorpay payment verification fields",
        )

    key_secret = get_razorpay_key_secret()

    message = f"{order_id}|{payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Razorpay signature",
        )

    now = utc_now()
    valid_until = now + timedelta(days=PLAN_DAYS)

    append_payment_row(
        {
            "user_id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "phone": current_user.phone,
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "amount_rupees": str(PLAN_AMOUNT_RUPEES),
            "currency": CURRENCY,
            "status": "paid",
            "paid_at": iso(now),
            "valid_from": iso(now),
            "valid_until": iso(valid_until),
        }
    )

    return {
        "message": "Payment verified successfully",
        "is_active": True,
        "valid_until": iso(valid_until),
    }


@router.get("/admin/paid-users")
def admin_paid_users(secret: str = Query(...)):
    verify_admin_secret(secret)

    rows = load_payment_rows()
    return {
        "total_paid_records": len(rows),
        "payments": rows,
    }
