from pathlib import Path
from typing import List, Set
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backtest.watchlist_portfolio import run_watchlist_backtest
from shared.backtest_models import (
    PortfolioBacktestResponse,
    PortfolioHolding,
    PortfolioMetrics,
    PortfolioPoint,
)

router = APIRouter()
logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
CLOSE_PRICES_PATH = DATA_DIR / "close_prices_wide.csv"


class WatchlistBacktestRequest(BaseModel):
    symbols: List[str]


def normalize_symbol(value: str) -> str:
    return str(value or "").strip().upper()


def canonical_symbol(value: str) -> str:
    s = normalize_symbol(value)

    if not s:
        return ""

    for prefix in ("NSE:", "BSE:"):
        if s.startswith(prefix):
            s = s[len(prefix):]

    for suffix in (".NS", ".BO", "-EQ"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]

    cleaned = "".join(ch for ch in s if ch.isalnum())
    return cleaned


def expand_request_symbols(symbols: List[str]) -> List[str]:
    expanded: List[str] = []
    seen: Set[str] = set()

    def add(value: str) -> None:
        normalized = normalize_symbol(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            expanded.append(normalized)

    for raw in symbols:
        original = normalize_symbol(raw)
        canon = canonical_symbol(raw)

        if original:
            add(original)

        if canon:
            add(canon)
            add(f"{canon}.NS")
            add(f"{canon}.BO")
            add(f"{canon}-EQ")
            add(f"NSE:{canon}")
            add(f"BSE:{canon}")
            add(f"NSE:{canon}-EQ")
            add(f"BSE:{canon}-EQ")

    return expanded


@router.post("/backtest/watchlist", response_model=PortfolioBacktestResponse)
def backtest_watchlist(body: WatchlistBacktestRequest):
    try:
        if not CLOSE_PRICES_PATH.exists():
            raise HTTPException(
                status_code=500,
                detail=f"close_prices_wide.csv not found at: {CLOSE_PRICES_PATH}",
            )

        requested_symbols = [str(s).strip().upper() for s in body.symbols if str(s).strip()]
        expanded_symbols = expand_request_symbols(requested_symbols)

        logger.info("Requested watchlist symbols: %s", requested_symbols)
        logger.info("Expanded watchlist symbols: %s", expanded_symbols[:100])

        metrics, curve_df, holdings_df = run_watchlist_backtest(
            user_symbols=expanded_symbols,
            close_prices_path=CLOSE_PRICES_PATH,
            lookback_days=252,
        )

        matched_symbols = (
            holdings_df["Symbol"].dropna().astype(str).drop_duplicates().tolist()
        )

        return PortfolioBacktestResponse(
            requested_symbols=requested_symbols,
            matched_symbols=matched_symbols,
            metrics=PortfolioMetrics(**metrics),
            curve=[
                PortfolioPoint(date=row["date"], nav=float(row["nav"]))
                for _, row in curve_df.iterrows()
            ],
            holdings=[
                PortfolioHolding(
                    symbol=str(row["Symbol"]),
                    weight=float(row["weight"]),
                    start_price=float(row["start_price"]),
                    end_price=float(row["end_price"]),
                    total_return_pct=float(row["total_return_pct"]),
                )
                for _, row in holdings_df.iterrows()
            ],
        )

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning("Watchlist backtest validation failed: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Watchlist backtest failed")
        raise HTTPException(status_code=500, detail=str(e))
