from __future__ import annotations

import os
import random
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import SessionLocal
from models.partner import ChannelPartner, CommissionStatus, PartnerCommission

router = APIRouter(tags=["partners"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_admin_secret() -> str:
    secret = os.getenv("ADMIN_SECRET")
    if not secret:
        raise RuntimeError("ADMIN_SECRET not configured")
    return secret.strip()


def verify_admin(secret: str) -> None:
    if (secret or "").strip() != get_admin_secret():
        raise HTTPException(status_code=403, detail="Unauthorized")


def _generate_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return "CP-" + "".join(random.choices(chars, k=length))


class CreatePartnerRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    commission_pct: float = 20.0


class PartnerLoginRequest(BaseModel):
    email: str
    secret: str


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.post("/admin/partners")
def create_partner(
    body: CreatePartnerRequest,
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin(secret)
    email = body.email.strip().lower()

    existing = db.query(ChannelPartner).filter(ChannelPartner.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Partner with this email already exists")

    # Generate unique code
    for _ in range(10):
        code = _generate_code()
        if not db.query(ChannelPartner).filter(ChannelPartner.referral_code == code).first():
            break

    partner = ChannelPartner(
        name=body.name.strip(),
        email=email,
        phone=(body.phone or "").strip() or None,
        referral_code=code,
        commission_pct=body.commission_pct,
        is_active=True,
    )
    db.add(partner)
    db.commit()
    db.refresh(partner)

    return {
        "id": partner.id,
        "name": partner.name,
        "email": partner.email,
        "referral_code": partner.referral_code,
        "commission_pct": partner.commission_pct,
        "referral_link": f"https://lightninbull.com?ref={partner.referral_code}",
    }


@router.get("/admin/partners")
def list_partners(
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin(secret)
    partners = db.query(ChannelPartner).order_by(ChannelPartner.created_at.desc()).all()

    result = []
    for p in partners:
        total_commissions = (
            db.query(PartnerCommission)
            .filter(PartnerCommission.partner_id == p.id)
            .count()
        )
        paid_out = (
            db.query(PartnerCommission)
            .filter(
                PartnerCommission.partner_id == p.id,
                PartnerCommission.status == CommissionStatus.PAID,
            )
            .count()
        )
        pending_amt = sum(
            c.commission_amt
            for c in db.query(PartnerCommission)
            .filter(
                PartnerCommission.partner_id == p.id,
                PartnerCommission.status == CommissionStatus.PENDING,
            )
            .all()
        )
        total_earned = sum(
            c.commission_amt
            for c in db.query(PartnerCommission)
            .filter(PartnerCommission.partner_id == p.id)
            .all()
        )
        result.append(
            {
                "id": p.id,
                "name": p.name,
                "email": p.email,
                "phone": p.phone,
                "referral_code": p.referral_code,
                "referral_link": f"https://lightninbull.com?ref={p.referral_code}",
                "commission_pct": p.commission_pct,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat(),
                "total_referrals": total_commissions,
                "paid_conversions": paid_out,
                "pending_payout_inr": round(pending_amt, 2),
                "total_earned_inr": round(total_earned, 2),
            }
        )
    return result


@router.get("/admin/partners/{partner_id}/commissions")
def partner_commissions(
    partner_id: int,
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin(secret)
    partner = db.query(ChannelPartner).filter(ChannelPartner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    commissions = (
        db.query(PartnerCommission)
        .filter(PartnerCommission.partner_id == partner_id)
        .order_by(PartnerCommission.created_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "user_id": c.user_id,
            "payment_id": c.payment_id,
            "order_amount": c.order_amount,
            "commission_amt": c.commission_amt,
            "status": c.status,
            "created_at": c.created_at.isoformat(),
        }
        for c in commissions
    ]


@router.patch("/admin/commissions/{commission_id}/mark-paid")
def mark_commission_paid(
    commission_id: int,
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin(secret)
    commission = db.query(PartnerCommission).filter(PartnerCommission.id == commission_id).first()
    if not commission:
        raise HTTPException(status_code=404, detail="Commission not found")

    commission.status = CommissionStatus.PAID
    db.commit()
    return {"message": "Commission marked as paid", "id": commission_id}


@router.patch("/admin/partners/{partner_id}/deactivate")
def deactivate_partner(
    partner_id: int,
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin(secret)
    partner = db.query(ChannelPartner).filter(ChannelPartner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    partner.is_active = False
    db.commit()
    return {"message": "Partner deactivated"}


# ── Partner self-service endpoint ──────────────────────────────────────────────

@router.post("/partners/stats")
def partner_stats(
    body: PartnerLoginRequest,
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()
    partner = (
        db.query(ChannelPartner)
        .filter(ChannelPartner.email == email, ChannelPartner.is_active == True)
        .first()
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    # Simple secret check: partner uses their referral_code as password
    if body.secret != partner.referral_code:
        raise HTTPException(status_code=403, detail="Invalid credentials")

    commissions = (
        db.query(PartnerCommission)
        .filter(PartnerCommission.partner_id == partner.id)
        .order_by(PartnerCommission.created_at.desc())
        .all()
    )

    total_earned = sum(c.commission_amt for c in commissions)
    pending_payout = sum(
        c.commission_amt for c in commissions if c.status == CommissionStatus.PENDING
    )
    paid_conversions = sum(1 for c in commissions if c.status == CommissionStatus.PAID)

    return {
        "name": partner.name,
        "referral_code": partner.referral_code,
        "referral_link": f"https://lightninbull.com?ref={partner.referral_code}",
        "commission_pct": partner.commission_pct,
        "total_referrals": len(commissions),
        "paid_conversions": paid_conversions,
        "total_earned_inr": round(total_earned, 2),
        "pending_payout_inr": round(pending_payout, 2),
        "commissions": [
            {
                "id": c.id,
                "user_id": c.user_id,
                "order_amount": c.order_amount,
                "commission_amt": c.commission_amt,
                "status": c.status,
                "created_at": c.created_at.isoformat(),
            }
            for c in commissions
        ],
    }


# ── Public validation endpoint ─────────────────────────────────────────────────

@router.get("/referral/validate/{code}")
def validate_referral_code(code: str, db: Session = Depends(get_db)):
    partner = (
        db.query(ChannelPartner)
        .filter(ChannelPartner.referral_code == code, ChannelPartner.is_active == True)
        .first()
    )
    if not partner:
        return {"valid": False}
    return {"valid": True, "partner_name": partner.name}
