from __future__ import annotations

import enum

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Boolean
from sqlalchemy.sql import func

from db import Base


class CommissionStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class ChannelPartner(Base):
    __tablename__ = "channel_partners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    referral_code = Column(String, unique=True, index=True, nullable=False)
    commission_pct = Column(Float, default=20.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PartnerCommission(Base):
    __tablename__ = "partner_commissions"

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("channel_partners.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    payment_id = Column(Integer, nullable=False, index=True)
    order_amount = Column(Float, nullable=False)
    commission_amt = Column(Float, nullable=False)
    status = Column(
        Enum(CommissionStatus),
        default=CommissionStatus.PENDING,
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
