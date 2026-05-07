from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy.orm import Session

from db import SessionLocal
from models.user import User
from shared.intraday_spreads_state import spread_state

router = APIRouter(tags=["signals"])
logger = logging.getLogger(__name__)

UPSIDE_KEY   = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
DOWNSIDE_KEY = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL"


def _validate_api_key(api_key: str) -> User:
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.api_key == api_key).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return user
    finally:
        db.close()


def _format_signals(strategy_data: dict, action: str) -> list[dict]:
    """Return only ENTERED signals formatted as clean trading signals."""
    signals = strategy_data.get("signals", [])
    out = []
    for s in signals:
        if s.get("signal_status") != "ENTERED":
            continue
        out.append({
            "symbol":          s.get("symbol"),
            "action":          action,
            "signal_status":   "ENTERED",
            "entry_time":      s.get("entry_time"),
            "entry_price":     s.get("entry_price"),
            "current_ltp":     s.get("current_ltp"),
            "target_price":    s.get("target_price"),
            "stop_loss_price": s.get("stop_loss_price"),
            "qty_suggested":   s.get("qty"),
            "buying_power":    s.get("buying_power"),
            "invested_amount": s.get("invested_amount"),
            "pnl_points":      s.get("pnl_points"),
            "pnl_pct":         s.get("pnl_pct"),
            "real_pnl":        s.get("real_pnl"),
        })
    return out


@router.get("/api/signals/live")
def get_live_signals(
    strategy: str = "all",
    x_lb_api_key: str = Header(..., alias="X-LB-API-Key"),
):
    """
    Returns all currently ENTERED signals.

    strategy: "upside" | "downside" | "all"  (default: all)

    Auth: pass your API key in the header   X-LB-API-Key: lb_live_xxxxx
    """
    _validate_api_key(x_lb_api_key)

    all_data   = spread_state.get_all()
    strategy   = (strategy or "all").lower().strip()
    result     = {}

    if strategy in ("upside", "all"):
        data = all_data.get(UPSIDE_KEY, {})
        result["upside"] = {
            "strategy":          "upside",
            "action":            "BUY",
            "ui_state":          data.get("ui_state"),
            "portfolio_stopped": data.get("portfolio_stopped", False),
            "portfolio_pnl_pct": data.get("portfolio_pnl_pct"),
            "total_real_pnl":    data.get("total_real_pnl"),
            "updated_at_ist":    data.get("updated_at_ist"),
            "signals":           _format_signals(data, action="BUY"),
        }

    if strategy in ("downside", "all"):
        data = all_data.get(DOWNSIDE_KEY, {})
        result["downside"] = {
            "strategy":          "downside",
            "action":            "SHORT",
            "ui_state":          data.get("ui_state"),
            "portfolio_stopped": data.get("portfolio_stopped", False),
            "portfolio_pnl_pct": data.get("portfolio_pnl_pct"),
            "total_real_pnl":    data.get("total_real_pnl"),
            "updated_at_ist":    data.get("updated_at_ist"),
            "signals":           _format_signals(data, action="SHORT"),
        }

    if not result:
        raise HTTPException(status_code=400, detail="strategy must be 'upside', 'downside', or 'all'")

    return {"status": "ok", "data": result}
