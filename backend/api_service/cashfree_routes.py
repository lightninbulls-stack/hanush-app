from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timedelta
import requests
import os
import csv
from pathlib import Path

from api_service.auth_routes import get_current_user
from models.user import User

router = APIRouter(tags=["cashfree"])

CASHFREE_APP_ID = os.getenv("CASHFREE_APP_ID")
CASHFREE_SECRET = os.getenv("CASHFREE_SECRET")

DATA_FILE = Path("backend/data/paid_users.csv")

PLAN_AMOUNT = 399
PLAN_DAYS = 14


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
    if not CASHFREE_APP_ID or not CASHFREE_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Cashfree credentials are not configured",
        )

    order_id = f"lb_{user.id}_{int(datetime.utcnow().timestamp())}"

    payload = {
        "order_id": order_id,
        "order_amount": PLAN_AMOUNT,
        "order_currency": "INR",
        "customer_details": {
            "customer_id": str(user.id),
            "customer_name": user.name or "Lightnin Bull User",
            "customer_email": user.email,
            "customer_phone": user.phone or "9999999999",
        },
        "order_meta": {
            "return_url": "https://lightninbull.com/payment-success?order_id={order_id}"
        },
    }

    headers = {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
    }

    try:
        res = requests.post(
            "https://api.cashfree.com/pg/orders",
            json=payload,
            headers=headers,
            timeout=20,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Cashfree request failed: {str(exc)}",
        ) from exc

    if res.status_code not in (200, 201):
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Cashfree order failed",
                "status_code": res.status_code,
                "response": res.text,
            },
        )

    data = res.json()

    return {
        "payment_session_id": data.get("payment_session_id"),
        "order_id": order_id,
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

            save_payment(Dummy, order_id)

    return {"status": "ok"}
