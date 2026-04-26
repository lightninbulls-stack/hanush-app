from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timedelta
import requests
import os
import csv
import logging
from pathlib import Path

from api_service.auth_routes import get_current_user
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["cashfree"])

CASHFREE_APP_ID = os.getenv("CASHFREE_APP_ID")
CASHFREE_SECRET = os.getenv("CASHFREE_SECRET")
CASHFREE_ENV = os.getenv("CASHFREE_ENV", "sandbox").lower()

DATA_FILE = Path("backend/data/paid_users.csv")

PLAN_AMOUNT = 399
PLAN_DAYS = 14


def get_cashfree_base_url() -> str:
    if CASHFREE_ENV == "production":
        return "https://api.cashfree.com/pg"
    return "https://sandbox.cashfree.com/pg"


def save_payment(user, order_id):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    now = datetime.utcnow()
    valid_till = now + timedelta(days=PLAN_DAYS)

    row = [
        user.id,
        user.name,
        user.email,
        PLAN_AMOUNT,
        order_id,
        now.isoformat(),
        valid_till.isoformat(),
    ]

    write_header = not DATA_FILE.exists()

    with open(DATA_FILE, "a", newline="") as f:
        writer = csv.writer(f)

        if write_header:
            writer.writerow([
                "user_id", "name", "email",
                "amount", "order_id",
                "paid_at", "valid_till"
            ])

        writer.writerow(row)


def get_subscription(user_id):
    if not DATA_FILE.exists():
        return {
            "is_active": False,
            "valid_till": None,
            "days_left": 0,
        }

    now = datetime.utcnow()
    latest_valid_till = None

    with open(DATA_FILE, "r") as f:
        reader = csv.DictReader(f)

        for row in reader:
            if str(row["user_id"]) == str(user_id):
                valid_till = datetime.fromisoformat(row["valid_till"])

                if latest_valid_till is None or valid_till > latest_valid_till:
                    latest_valid_till = valid_till

    if latest_valid_till and latest_valid_till > now:
        days_left = max((latest_valid_till - now).days, 0)

        return {
            "is_active": True,
            "valid_till": latest_valid_till.isoformat(),
            "days_left": days_left,
        }

    return {
        "is_active": False,
        "valid_till": None,
        "days_left": 0,
    }


@router.get("/subscription/status")
def status(user: User = Depends(get_current_user)):
    return get_subscription(user.id)


@router.post("/create-order")
def create_order(user: User = Depends(get_current_user)):

    # ── Credential check ──────────────────────────────────────────────────────
    if not CASHFREE_APP_ID or not CASHFREE_SECRET:
        logger.error(
            "CASHFREE CREDENTIALS MISSING — APP_ID present=%s  SECRET present=%s",
            bool(CASHFREE_APP_ID), bool(CASHFREE_SECRET),
        )
        raise HTTPException(
            status_code=500,
            detail="Cashfree credentials are not configured",
        )

    logger.info(
        "CASHFREE_ENV=%s  base_url=%s  APP_ID_prefix=%s",
        CASHFREE_ENV,
        get_cashfree_base_url(),
        CASHFREE_APP_ID[:6],
    )

    order_id = f"lb_{user.id}_{int(datetime.utcnow().timestamp())}"

    # ── Phone sanitisation — Cashfree requires exactly 10 digits ─────────────
    raw_phone = getattr(user, "phone", None) or "9999999999"
    digits_only = "".join(c for c in str(raw_phone) if c.isdigit())
    if digits_only.startswith("91") and len(digits_only) == 12:
        digits_only = digits_only[2:]
    customer_phone = (digits_only[:10].ljust(10, "0")) if digits_only else "9999999999"

    return_url = f"https://lightninbull.com/payment-success?order_id={order_id}"

    payload = {
        "order_id": order_id,
        "order_amount": float(PLAN_AMOUNT),
        "order_currency": "INR",
        "customer_details": {
            "customer_id": str(user.id),
            "customer_name": (user.name or "LightninBull User")[:50],
            "customer_email": user.email,
            "customer_phone": customer_phone,
        },
        "order_meta": {
            "return_url": return_url,
        },
    }

    headers = {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    logger.info("Cashfree payload being sent: %s", payload)

    # ── Call Cashfree ─────────────────────────────────────────────────────────
    try:
        res = requests.post(
            f"{get_cashfree_base_url()}/orders",
            json=payload,
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as exc:
        logger.error("Cashfree network error: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Cashfree request failed: {str(exc)}",
        ) from exc

    # ── Always log Cashfree's full response ───────────────────────────────────
    logger.info(
        "Cashfree response — HTTP %s — body: %s",
        res.status_code,
        res.text,
    )

    if res.status_code not in (200, 201):
        try:
            cf_error = res.json()
        except Exception:
            cf_error = res.text

        logger.error("Cashfree order FAILED: %s", cf_error)

        # Surface Cashfree's actual error message to the frontend alert
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Cashfree order failed",
                "cashfree_env": CASHFREE_ENV,
                "cashfree_status": res.status_code,
                "cashfree_error": cf_error,   # ← you'll see this in the browser alert
            },
        )

    data = res.json()

    return {
        "payment_session_id": data.get("payment_session_id"),
        "order_id": order_id,
        "cashfree_env": CASHFREE_ENV,
    }


@router.post("/webhook")
async def webhook(request: Request):
    body = await request.json()

    data = body.get("data", {})
    order = data.get("order", {})
    payment = data.get("payment", {})
    customer_details = data.get("customer_details", {})

    order_id = order.get("order_id") or body.get("order_id")
    payment_status = payment.get("payment_status") or body.get("order_status")

    if payment_status in ("SUCCESS", "PAID") and order_id:
        user_id = customer_details.get("customer_id")
        email = customer_details.get("customer_email")

        if user_id:
            class Dummy:
                id = user_id
                name = "user"
                email = email or ""

            dummy_user = Dummy()
            save_payment(dummy_user, order_id)

    return {"status": "ok"}
