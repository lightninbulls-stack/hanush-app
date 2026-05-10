"""
api_service/cashfree_routes.py
Production-grade Cashfree payment integration
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from api_service.auth_routes import get_current_user
from db import SessionLocal
from models.partner import ChannelPartner, PartnerCommission
from models.payment import Payment, PaymentStatus
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["cashfree"])

# ── Config ────────────────────────────────────────────────────────────────────
CASHFREE_APP_ID = os.getenv("CASHFREE_APP_ID")
CASHFREE_SECRET = os.getenv("CASHFREE_SECRET")
CASHFREE_ENV = os.getenv("CASHFREE_ENV", "sandbox").lower()
CASHFREE_WEBHOOK_KEY = os.getenv("CASHFREE_WEBHOOK_KEY", CASHFREE_SECRET)

PLAN_AMOUNT = 399.0
PLAN_DAYS = 14

CF_API_VERSION = "2023-08-01"
CF_TIMEOUT = 20
CF_MAX_RETRIES = 3


def normalise_phone(raw_phone: Optional[str]) -> str:
    digits = "".join(ch for ch in str(raw_phone or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


ADMIN_PHONES = {
    normalise_phone(phone)
    for phone in os.getenv("ADMIN_PHONES", "").split(",")
    if phone.strip()
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def is_admin_user(user: User) -> bool:
    if not user:
        return False

    user_phone = normalise_phone(getattr(user, "phone", None))
    return bool(user_phone and user_phone in ADMIN_PHONES)


def get_cashfree_base_url() -> str:
    if CASHFREE_ENV == "production":
        return "https://api.cashfree.com/pg"
    return "https://sandbox.cashfree.com/pg"


def cf_headers() -> dict:
    return {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
        "x-api-version": CF_API_VERSION,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def cf_request(method: str, path: str, **kwargs) -> requests.Response:
    url = f"{get_cashfree_base_url()}{path}"

    for attempt in range(1, CF_MAX_RETRIES + 1):
        try:
            return requests.request(
                method,
                url,
                headers=cf_headers(),
                timeout=CF_TIMEOUT,
                **kwargs,
            )
        except requests.RequestException as exc:
            logger.warning(
                "Cashfree %s %s attempt %d/%d failed: %s",
                method,
                path,
                attempt,
                CF_MAX_RETRIES,
                exc,
            )
            if attempt == CF_MAX_RETRIES:
                raise HTTPException(
                    status_code=502,
                    detail=f"Cashfree unreachable after {CF_MAX_RETRIES} attempts: {exc}",
                ) from exc
            time.sleep(attempt)


def sanitise_phone(raw: Optional[str]) -> str:
    digits = "".join(c for c in str(raw or "") if c.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return digits[:10].ljust(10, "0") if digits else "9999999999"


def get_subscription_response(user_id: int, db: Session) -> dict:
    now = datetime.utcnow()

    latest: Optional[Payment] = (
        db.query(Payment)
        .filter(
            Payment.user_id == user_id,
            Payment.status == PaymentStatus.PAID,
            Payment.valid_till > now,
        )
        .order_by(Payment.valid_till.desc())
        .first()
    )

    if latest:
        days_left = max((latest.valid_till - now).days, 0)
        return {
            "is_active": True,
            "valid_till": latest.valid_till.isoformat(),
            "days_left": days_left,
            "is_admin": False,
        }

    return {
        "is_active": False,
        "valid_till": None,
        "days_left": 0,
        "is_admin": False,
    }


def _maybe_create_commission(db: Session, *, payment: Payment, user_id: int) -> None:
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.referred_by_id:
            return

        already = (
            db.query(PartnerCommission)
            .filter(PartnerCommission.payment_id == payment.id)
            .first()
        )
        if already:
            return

        partner = db.query(ChannelPartner).filter(ChannelPartner.id == user.referred_by_id).first()
        if not partner or not partner.is_active:
            return

        commission_amt = round(payment.amount * partner.commission_pct / 100, 2)
        commission = PartnerCommission(
            partner_id=partner.id,
            user_id=user_id,
            payment_id=payment.id,
            order_amount=payment.amount,
            commission_amt=commission_amt,
        )
        db.add(commission)
        db.commit()
        logger.info(
            "commission: partner=%s user=%s payment=%s amt=%.2f",
            partner.id, user_id, payment.id, commission_amt,
        )
    except Exception as exc:
        logger.error("commission creation failed: %s", exc)


def record_payment_paid(
    db: Session,
    *,
    order_id: str,
    user_id: int,
    user_name: str,
    user_email: str,
    cf_payment_id: str = "",
    cf_order_status: str = "PAID",
) -> Payment:
    existing = db.query(Payment).filter(Payment.order_id == order_id).first()

    now = datetime.utcnow()
    valid_till = now + timedelta(days=PLAN_DAYS)

    if existing:
        if existing.status == PaymentStatus.PAID:
            logger.info("record_payment_paid: order %s already PAID, skip", order_id)
            return existing

        existing.status = PaymentStatus.PAID
        existing.paid_at = now
        existing.valid_till = valid_till
        existing.cf_payment_id = cf_payment_id or existing.cf_payment_id
        existing.cf_order_status = cf_order_status
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        _maybe_create_commission(db, payment=existing, user_id=user_id)
        logger.info("record_payment_paid: updated order %s to PAID", order_id)
        return existing

    payment = Payment(
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        order_id=order_id,
        amount=PLAN_AMOUNT,
        currency="INR",
        status=PaymentStatus.PAID,
        paid_at=now,
        valid_till=valid_till,
        cf_payment_id=cf_payment_id,
        cf_order_status=cf_order_status,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    _maybe_create_commission(db, payment=payment, user_id=user_id)
    logger.info("record_payment_paid: created PAID record for order %s user %s", order_id, user_id)
    return payment


def record_payment_pending(
    db: Session,
    *,
    order_id: str,
    user_id: int,
    user_name: str,
    user_email: str,
) -> Payment:
    existing = db.query(Payment).filter(Payment.order_id == order_id).first()
    if existing:
        return existing

    payment = Payment(
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        order_id=order_id,
        amount=PLAN_AMOUNT,
        currency="INR",
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    logger.info("record_payment_pending: created PENDING record for order %s", order_id)
    return payment


def verify_webhook_signature(raw_body: bytes, received_signature: str) -> bool:
    if not CASHFREE_WEBHOOK_KEY:
        logger.warning("CASHFREE_WEBHOOK_KEY not set — skipping signature check")
        return True

    expected = hmac.new(
        CASHFREE_WEBHOOK_KEY.encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, received_signature or "")


@router.get("/subscription/status")
def status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if is_admin_user(user):
        return {
            "is_active": True,
            "valid_till": None,
            "days_left": 9999,
            "is_admin": True,
        }

    return get_subscription_response(user.id, db)


@router.post("/create-order")
def create_order(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not CASHFREE_APP_ID or not CASHFREE_SECRET:
        logger.error("Cashfree credentials missing")
        raise HTTPException(status_code=500, detail="Cashfree credentials not configured")

    order_id = f"lb_{user.id}_{int(datetime.utcnow().timestamp())}"
    return_url = f"https://lightninbull.com/payment-success?order_id={order_id}"

    payload = {
        "order_id": order_id,
        "order_amount": PLAN_AMOUNT,
        "order_currency": "INR",
        "customer_details": {
            "customer_id": str(user.id),
            "customer_name": (user.name or "LightninBull User")[:50],
            "customer_email": user.email or f"user{user.id}@lightninbull.com",
            "customer_phone": sanitise_phone(getattr(user, "phone", None)),
        },
        "order_meta": {"return_url": return_url},
    }

    logger.info("create-order: user=%s order_id=%s env=%s", user.id, order_id, CASHFREE_ENV)

    res = cf_request("POST", "/orders", json=payload)

    logger.info("create-order: CF response %s %s", res.status_code, res.text)

    if res.status_code not in (200, 201):
        try:
            cf_err = res.json()
        except Exception:
            cf_err = res.text
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Cashfree order creation failed",
                "cashfree_env": CASHFREE_ENV,
                "cashfree_status": res.status_code,
                "cashfree_error": cf_err,
            },
        )

    data = res.json()

    record_payment_pending(
        db,
        order_id=order_id,
        user_id=user.id,
        user_name=user.name or "",
        user_email=user.email or "",
    )

    return {
        "payment_session_id": data.get("payment_session_id"),
        "order_id": order_id,
        "cashfree_env": CASHFREE_ENV,
    }


@router.post("/verify-payment")
def verify_payment(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order_id = body.get("order_id")
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id is required")

    existing = db.query(Payment).filter(Payment.order_id == order_id).first()
    if existing and existing.status == PaymentStatus.PAID:
        logger.info("verify-payment: order %s already PAID in DB", order_id)
        return get_subscription_response(user.id, db)

    res = cf_request("GET", f"/orders/{order_id}")

    logger.info("verify-payment: CF response %s %s", res.status_code, res.text)

    if res.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch order from Cashfree")

    data = res.json()
    order_status = data.get("order_status", "")

    logger.info("verify-payment: order_id=%s cf_status=%s", order_id, order_status)

    if order_status == "PAID":
        record_payment_paid(
            db,
            order_id=order_id,
            user_id=user.id,
            user_name=user.name or "",
            user_email=user.email or "",
            cf_order_status=order_status,
        )
    elif order_status == "FAILED" and existing:
        existing.status = PaymentStatus.FAILED
        existing.cf_order_status = order_status
        existing.updated_at = datetime.utcnow()
        db.commit()

    return get_subscription_response(user.id, db)


@router.post("/webhook")
async def webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_webhook_signature: Optional[str] = Header(None, alias="x-webhook-signature"),
):
    raw_body = await request.body()

    if x_webhook_signature:
        if not verify_webhook_signature(raw_body, x_webhook_signature):
            logger.warning("webhook: invalid signature — rejecting request")
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        logger.warning("webhook: no x-webhook-signature header — proceeding without validation")

    try:
        body = await request.json()
    except Exception:
        import json
        body = json.loads(raw_body)

    data = body.get("data", {})
    order_data = data.get("order", {})
    payment_data = data.get("payment", {})
    customer_details = data.get("customer_details", {})

    order_id = order_data.get("order_id") or body.get("order_id")
    payment_status = payment_data.get("payment_status") or body.get("order_status")
    cf_payment_id = payment_data.get("cf_payment_id") or payment_data.get("payment_id") or ""
    user_id_str = customer_details.get("customer_id") or ""
    email = customer_details.get("customer_email") or ""
    name = customer_details.get("customer_name") or "user"

    logger.info("webhook: order_id=%s status=%s user_id=%s", order_id, payment_status, user_id_str)

    if payment_status in ("SUCCESS", "PAID") and order_id and user_id_str:
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            logger.error("webhook: invalid customer_id=%s", user_id_str)
            return {"status": "ok"}

        record_payment_paid(
            db,
            order_id=order_id,
            user_id=user_id,
            user_name=name,
            user_email=email,
            cf_payment_id=cf_payment_id,
            cf_order_status=payment_status,
        )

    elif payment_status == "FAILED" and order_id:
        existing = db.query(Payment).filter(Payment.order_id == order_id).first()
        if existing and existing.status != PaymentStatus.PAID:
            existing.status = PaymentStatus.FAILED
            existing.cf_order_status = payment_status
            existing.updated_at = datetime.utcnow()
            db.commit()
            logger.info("webhook: marked order %s as FAILED", order_id)

    return {"status": "ok"}


def require_premium(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if is_admin_user(user):
        return user

    sub = get_subscription_response(user.id, db)
    if not sub["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Active subscription required",
        )
    return user
