from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timedelta
import requests, os, csv
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


def check_active(user_id):
    if not DATA_FILE.exists():
        return False

    now = datetime.utcnow()

    with open(DATA_FILE, "r") as f:
        reader = csv.DictReader(f)

        for row in reader:
            if str(row["user_id"]) == str(user_id):
                if datetime.fromisoformat(row["valid_till"]) > now:
                    return True

    return False


@router.get("/subscription/status")
def status(user: User = Depends(get_current_user)):
    return {"is_active": check_active(user.id)}


# 🔥 CREATE ORDER
@router.post("/create-order")
def create_order(user: User = Depends(get_current_user)):

    order_id = f"lb_{user.id}_{int(datetime.utcnow().timestamp())}"

    payload = {
        "order_id": order_id,
        "order_amount": PLAN_AMOUNT,
        "order_currency": "INR",
        "customer_details": {
            "customer_id": str(user.id),
            "customer_email": user.email,
            "customer_phone": user.phone
        }
    }

    headers = {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET,
        "Content-Type": "application/json"
    }

    res = requests.post(
        "https://api.cashfree.com/pg/orders",
        json=payload,
        headers=headers
    )

    if res.status_code != 200:
        raise HTTPException(500, "Cashfree order failed")

    data = res.json()

    return {
        "payment_session_id": data["payment_session_id"],
        "order_id": order_id
    }


# 🔥 WEBHOOK (MOST IMPORTANT)
@router.post("/webhook")
async def webhook(request: Request):

    body = await request.json()

    if body.get("order_status") == "PAID":

        user_id = body["customer_details"]["customer_id"]
        order_id = body["order_id"]

        # minimal user object simulation
        class Dummy:
            id = user_id
            name = "user"
            email = body["customer_details"]["customer_email"]

        save_payment(Dummy, order_id)

    return {"status": "ok"}
