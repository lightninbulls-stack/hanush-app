# 🚀 Production-Grade Payment System — Deployment Guide

## Files to deploy

| File | Destination in repo |
|------|-------------------|
| `payment.py` | `backend/models/payment.py` |
| `0002_create_payments.py` | `backend/alembic/versions/0002_create_payments.py` |
| `cashfree_routes.py` | `backend/api_service/cashfree_routes.py` |

---

## Step 1 — Set the Alembic `down_revision`

Open `0002_create_payments.py` and find this line:

```python
down_revision = None   # ← REPLACE with your actual current revision ID
```

Run this on your local machine or Render shell to find your current revision:

```bash
alembic history
```

Copy the latest revision hash (looks like `abc123def456`) and replace `None`:

```python
down_revision = "abc123def456"
```

---

## Step 2 — Import the Payment model in main.py

Add this import near the top of `backend/api_service/main.py`
(right after your other model imports):

```python
from models.payment import Payment  # noqa: F401  ← registers table with Base
```

This ensures `Base.metadata.create_all()` knows about the payments table.

---

## Step 3 — Run the migration

```bash
# In your backend directory:
alembic upgrade head
```

Or if you use Render shell:
- Render → hanush-backend-service1 → Shell
- `cd backend && alembic upgrade head`

---

## Step 4 — Add CASHFREE_WEBHOOK_KEY to Render env vars

In Render → Environment, add:

```
CASHFREE_WEBHOOK_KEY = <your Cashfree webhook secret>
```

To get it:
- Cashfree Dashboard → Production → Developers → Webhooks
- After adding your webhook URL, Cashfree shows a "Webhook Secret Key"
- Copy it → paste into Render

---

## Step 5 — Register webhook in Cashfree Dashboard

- Cashfree → Production → Developers → Webhooks → Add
- URL: `https://hanush-backend-service1.onrender.com/cashfree/webhook`
- Events: ✅ PAYMENT_SUCCESS  ✅ PAYMENT_FAILED
- Save → copy the Webhook Secret Key → put in Render (Step 4)

---

## Step 6 — Push & deploy

```bash
git add .
git commit -m "feat: production-grade payment system with PostgreSQL"
git push origin user_profile
```

Render auto-redeploys. Done. ✅

---

## What you now have

| Feature | Before | After |
|---------|--------|-------|
| Storage | CSV file ❌ | PostgreSQL ✅ |
| Race conditions | Yes ❌ | No (DB unique constraint) ✅ |
| Payment states | Only PAID ❌ | PENDING/PAID/FAILED/REFUNDED ✅ |
| Webhook security | None ❌ | HMAC-SHA256 signature ✅ |
| Retry logic | None ❌ | 3 retries with backoff ✅ |
| Audit trail | None ❌ | Full CF payment ID stored ✅ |
| Backend access guard | None ❌ | `require_premium` dependency ✅ |
| Idempotency | Duplicate risk ❌ | DB unique on order_id ✅ |
