"""
models/payment.py
─────────────────
SQLAlchemy model for payment records.
Replaces the old paid_users.csv — same data, but safe, indexed, and race-condition-free.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum
from sqlalchemy.sql import func
import enum

from db import Base


class PaymentStatus(str, enum.Enum):
    PENDING  = "PENDING"
    PAID     = "PAID"
    FAILED   = "FAILED"
    REFUNDED = "REFUNDED"


class Payment(Base):
    __tablename__ = "payments"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, index=True, nullable=False)
    user_name   = Column(String, nullable=True)
    user_email  = Column(String, nullable=True)
    order_id    = Column(String, unique=True, index=True, nullable=False)
    amount      = Column(Float, nullable=False)
    currency    = Column(String, default="INR")
    status      = Column(
        Enum(PaymentStatus),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True,
    )
    paid_at     = Column(DateTime, nullable=True)          # set when status → PAID
    valid_till  = Column(DateTime, nullable=True)          # paid_at + 14 days
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Raw Cashfree response stored for audit trail
    cf_payment_id   = Column(String, nullable=True)        # Cashfree's own payment ID
    cf_order_status = Column(String, nullable=True)        # raw status string from CF
