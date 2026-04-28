from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api_service.auth_routes import get_current_user, get_db
from fetch_service.main import fetch_from_google_sheets
from models.user import User
from shared.intraday_spreads_state import spread_state

router = APIRouter(tags=["ai-agent"])


class AgentHistoryMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    message: str
    history: Optional[List[AgentHistoryMessage]] = None


class AgentChatResponse(BaseModel):
    answer: str


def _safe_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _safe_text(value: Any, fallback: str = "NA") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _get_screener_stocks(category: str, limit: int = 8) -> List[Dict[str, Any]]:
    try:
        stocks = fetch_from_google_sheets(category) or []
        return list(stocks)[:limit]
    except Exception:
        return []


def _format_screener_stocks(category: str) -> str:
    stocks = _get_screener_stocks(category)

    if not stocks:
        return f"I could not find live {category} stocks right now. Please check the dashboard once data refreshes."

    lines = [f"Current {category} stocks from Lightnin Bull:"]
    for idx, stock in enumerate(stocks, start=1):
        symbol = _safe_text(stock.get("symbol") or stock.get("ticker"), "UNKNOWN")
        sector = _safe_text(stock.get("sector"), "N/A")
        score = _safe_float(stock.get("score") or stock.get("strength"))
        score_text = f" | Score: {score:.2f}" if score is not None else ""
        lines.append(f"{idx}. {symbol} | Sector: {sector}{score_text}")

    lines.append("")
    lines.append(
        "Use this as a signal dashboard, not a guaranteed buy/sell call. Always apply position sizing and risk management."
    )
    return "\n".join(lines)


def _get_intraday_payload(strategy_key: str) -> Dict[str, Any] | None:
    try:
        payload = spread_state.get_one(strategy_key)
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def _format_intraday_signal(strategy_key: str, label: str) -> str:
    payload = _get_intraday_payload(strategy_key)

    if not payload:
        return f"No live {label} payload is available right now. The websocket strategy may still be booting or market data may not be active."

    signals = payload.get("signals") or []
    entered = [row for row in signals if str(row.get("signal_status", "")).upper() == "ENTERED"]
    rows = entered or signals[:8]

    lines = [
        f"{label} status: {_safe_text(payload.get('status'), 'WAITING')}",
        f"Message: {_safe_text(payload.get('message'), 'No message')}",
        f"Entered: {payload.get('entered_count', len(entered))} / Total: {payload.get('total_count', len(signals))}",
    ]

    if rows:
        lines.append("")
        lines.append("Latest signal rows:")
        for row in rows[:8]:
            symbol = _safe_text(row.get("symbol"), "UNKNOWN")
            status = _safe_text(row.get("signal_status"), "WAITING")
            ltp = _safe_float(row.get("current_ltp"))
            entry = _safe_float(row.get("entry_price") or row.get("avg_price"))
            max_ltp = _safe_float(row.get("max_ltp") or row.get("favorable_price"))
            ltp_text = f" | LTP: {ltp:.2f}" if ltp is not None else ""
            entry_text = f" | Entry: {entry:.2f}" if entry is not None else ""
            max_text = f" | Max: {max_ltp:.2f}" if max_ltp is not None else ""
            lines.append(f"- {symbol} | {status}{entry_text}{ltp_text}{max_text}")
    else:
        lines.append("No stock-level signals are available yet.")

    return "\n".join(lines)


def _explain_strategy(message: str) -> str | None:
    if "bull call" in message:
        return (
            "Bull Call Spread: Lightnin Bull uses this when the index has upside confirmation. "
            "The structure buys a lower-strike call and sells a higher-strike call, so risk is capped and reward is capped. "
            "It is better than naked buying when you want directional exposure with controlled premium outflow."
        )

    if "bear put" in message:
        return (
            "Bear Put Spread: this is a bearish debit spread. It buys a higher-strike put and sells a lower-strike put. "
            "It is useful when downside confirmation is present, but you still want limited and predefined risk."
        )

    if "short straddle" in message or "straddle" in message:
        return (
            "Short Straddle: this sells ATM CE and ATM PE together. It benefits from theta decay and range-bound movement, "
            "but risk increases sharply if the market trends strongly. Use strict stop-loss and avoid carrying unmanaged exposure."
        )

    if "covered call" in message:
        return (
            "Covered Call: this holds the underlying/index exposure and sells a call against it. "
            "It can generate option income in sideways or moderately bullish regimes, but upside becomes capped after the sold-call strike."
        )

    return None


def _build_agent_answer(user: User, message: str) -> str:
    normalized = message.lower().strip()

    if not normalized:
        return "Please ask me about Lightnin Bull stocks, signals, spreads, or dashboard usage."

    strategy_answer = _explain_strategy(normalized)
    if strategy_answer:
        return strategy_answer

    if "regime upside" in normalized or "upside stocks" in normalized or "momentum stocks" in normalized:
        return _format_screener_stocks("Regime Upside")

    if "regime downside" in normalized or "downside stocks" in normalized:
        return _format_screener_stocks("Regime Downside")

    if "consistent trending" in normalized or "trending stocks" in normalized:
        return _format_screener_stocks("Consistent Trending")

    if "slow movement" in normalized:
        return _format_screener_stocks("Slow Movement")

    if "cheap value" in normalized or "value stocks" in normalized:
        return _format_screener_stocks("Cheap Value")

    if "best quality" in normalized or "quality stocks" in normalized:
        return _format_screener_stocks("Best Quality")

    if "upside trend" in normalized or "live upside" in normalized:
        return _format_intraday_signal(
            "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL",
            "Upside Trend Stocks",
        )

    if "downside trend" in normalized or "live downside" in normalized:
        return _format_intraday_signal(
            "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL",
            "Downside Trend Stocks",
        )

    if "payment" in normalized or "subscription" in normalized or "premium" in normalized:
        return (
            f"{user.name}, premium features unlock the full stock list, intraday option spreads, and intraday stock signals. "
            "For exact payment status, open the Pricing/Profile section because payment validity is checked from your account subscription API."
        )

    if "how to use" in normalized or "dashboard" in normalized or "lightnin bull" in normalized:
        return (
            "Lightnin Bull is structured like a quant dashboard:\n"
            "1. Factors: Consistent Trending, Slow Movement, Cheap Value, Best Quality.\n"
            "2. Regime: Regime Upside and Regime Downside for market regime-based stocks.\n"
            "3. Range Bound: stocks suitable for sideways/range logic.\n"
            "4. Intraday Index Option Spreads: Bull Call and Bear Put spread engines.\n"
            "5. Intraday Stock Signals: live upside/downside paper-signal tracking.\n\n"
            "Use the AI Agent to understand why a category matters, but take trades only with your own risk rules."
        )

    return (
        "I can help with Lightnin Bull categories, regime signals, intraday stock signals, and option-spread explanations.\n\n"
        "Try asking one of these:\n"
        "- Show Regime Upside stocks\n"
        "- Show live Upside Trend Stocks\n"
        "- Explain Bull Call Spread\n"
        "- How to use the Lightnin Bull dashboard"
    )


@router.post("/chat", response_model=AgentChatResponse)
def chat_with_ai_agent(
    payload: AgentChatRequest,
    current_user: User = Depends(get_current_user),
    _: Session = Depends(get_db),
) -> AgentChatResponse:
    answer = _build_agent_answer(current_user, payload.message)
    return AgentChatResponse(answer=answer)
