from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from db import SessionLocal
from models.user import User
from models.payment import Payment, PaymentStatus
from shared.intraday_spreads_state import spread_state
from shared.signal_broadcaster import broadcaster

router = APIRouter(tags=["signals"])
logger = logging.getLogger(__name__)

UPSIDE_KEY   = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
DOWNSIDE_KEY = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL"


def _is_premium_active(user_id: int, db: Session) -> bool:
    now = datetime.now(timezone.utc)
    payment = (
        db.query(Payment)
        .filter(
            Payment.user_id == user_id,
            Payment.status == PaymentStatus.PAID,
            Payment.valid_till > now,
        )
        .first()
    )
    return payment is not None


def _validate_api_key(api_key: str) -> User:
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.api_key == api_key).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key.")
        if not _is_premium_active(user.id, db):
            raise HTTPException(
                status_code=403,
                detail="Subscription expired. Renew your premium plan at lightninbull.com to continue using the Signal API.",
            )
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


def _build_payload(strategy: str) -> dict:
    """Build the response payload from current spread_state."""
    all_data = spread_state.get_all()
    result: dict = {}

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

    return {"status": "ok", "data": result}


# ── REST endpoint ─────────────────────────────────────────────────────────────

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
    strategy = (strategy or "all").lower().strip()

    if strategy not in ("upside", "downside", "all"):
        raise HTTPException(status_code=400, detail="strategy must be 'upside', 'downside', or 'all'")

    return _build_payload(strategy)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/api/signals/ws")
async def ws_live_signals(
    websocket: WebSocket,
    api_key: str = Query(..., alias="api_key"),
    strategy: str = Query("all"),
):
    """
    WebSocket endpoint — server pushes updates whenever signals change.

    Connect: wss://api.lightninbull.com/api/signals/ws?api_key=lb_live_xxx&strategy=upside

    strategy: "upside" | "downside" | "all"  (default: all)

    Messages:
      {"type": "snapshot", "data": {...}}   — full state (on connect + every change)
      {"type": "heartbeat"}                 — keep-alive every 30s when no changes
    """
    strategy = (strategy or "all").lower().strip()
    if strategy not in ("upside", "downside", "all"):
        await websocket.close(code=4000, reason="strategy must be upside, downside, or all")
        return

    # Validate API key before accepting the WebSocket handshake
    try:
        _validate_api_key(api_key)
    except HTTPException as exc:
        await websocket.close(code=4001, reason=exc.detail)
        return

    await websocket.accept()
    logger.info("WebSocket client connected: strategy=%s", strategy)

    # Send initial snapshot immediately
    await websocket.send_text(json.dumps({
        "type": "snapshot",
        **_build_payload(strategy),
    }))

    q = broadcaster.subscribe()
    try:
        while True:
            try:
                # Wait for a change notification (30s timeout → heartbeat)
                await asyncio.wait_for(q.get(), timeout=30.0)

                # Drain any extra notifications that piled up (de-duplicate)
                while not q.empty():
                    q.get_nowait()

                # Push fresh state to client
                await websocket.send_text(json.dumps({
                    "type": "snapshot",
                    **_build_payload(strategy),
                }))

            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "heartbeat"}))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as exc:
        logger.warning("WebSocket error: %s", exc)
    finally:
        broadcaster.unsubscribe(q)
