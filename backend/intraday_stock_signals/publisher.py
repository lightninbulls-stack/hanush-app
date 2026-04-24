from __future__ import annotations

from dataclasses import asdict
from datetime import datetime

from shared.intraday_spreads_state import spread_state
from .config import INDEX_NAME, IST, SPREAD_TYPE


def publish_strategy_state(
    *,
    strategy_name: str,
    ui_state: str,
    message: str,
    progress_text: str | None = None,
    is_loading: bool = False,
    extra: dict | None = None,
) -> None:
    payload = {
        "index": INDEX_NAME,
        "spread_type": SPREAD_TYPE,
        "strategy_name": strategy_name,
        "status": ui_state,
        "ui_state": ui_state,
        "message": message,
        "progress_text": progress_text,
        "is_loading": is_loading,
        "updated_at": datetime.now(IST).isoformat(),
        "net_pnl": 0.0,
        "signals": [],
    }

    if extra:
        payload.update(extra)

    spread_state.update(strategy_name, payload)


def build_payload(
    *,
    strategy_name: str,
    side: str,
    signal_states: dict,
    fast_span: int,
    slow_span: int,
) -> dict:
    signals = [asdict(state) for state in signal_states.values()]

    signals = sorted(
        signals,
        key=lambda x: (
            0 if x["signal_status"] == "ENTERED" else 1,
            x["symbol"],
        ),
    )

    entered_count = sum(1 for x in signals if x["signal_status"] == "ENTERED")

    message = (
        "Monitoring upside regime stocks for bullish EMA Crossover."
        if side == "UPSIDE"
        else "Monitoring downside regime stocks for bearish EMA Crossover."
    )

    return {
        "index": INDEX_NAME,
        "spread_type": SPREAD_TYPE,
        "strategy_name": strategy_name,
        "status": "RUNNING",
        "ui_state": "RUNNING",
        "message": message,
        "progress_text": f"{entered_count} entered out of {len(signals)} stocks",
        "is_loading": False,
        "updated_at": datetime.now(IST).isoformat(),
        "signals": signals,
        "net_pnl": 0.0,
        "entered_count": entered_count,
        "total_count": len(signals),
        "fast_ema_span": fast_span,
        "slow_ema_span": slow_span,
    }
