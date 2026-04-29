from pathlib import Path
from typing import List
import csv
import logging
import math

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backtest.watchlist_portfolio import (
    run_watchlist_backtest,
    run_watchlist_mvo_backtest,
    run_watchlist_mvo_short_backtest,
)
from shared.backtest_models import (
    BenchmarkMetrics,
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

NSE_TOP_200_FO_CATEGORY = "NSE TOP 200 F&O Universe"
EXCLUDED_UNIVERSE_SYMBOLS = {
    "^CNXAUTO",
    "^CNXFMCG",
    "^CNXIT",
    "^CNXMEDIA",
    "^CNXMETAL",
    "^CNXPHARMA",
    "^CNXPSUBANK",
    "^CNXREALTY",
    "^NSEBANK",
    "^NSEI",
}
DATE_LIKE_COLUMNS = {"DATE", "DATETIME", "TIME", "TIMESTAMP"}

DEFAULT_RETAIL_CAPITAL = 100000.0


class WatchlistBacktestRequest(BaseModel):
    symbols: List[str]
    strategy_type: str = "equal_weight"


def normalize_symbol(value: str) -> str:
    return str(value or "").strip().upper()


def load_nse_top_200_fo_universe() -> list[dict]:
    """
    Build the NSE TOP 200 F&O stock universe directly from close_prices_wide.csv.

    The close wide file contains both stocks and index/sector symbols. For this
    user-facing universe, we exclude the index/sector columns and keep all stock
    ticker columns so users can add them to their watchlist and backtest them.
    """
    if not CLOSE_PRICES_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=f"close_prices_wide.csv not found at: {CLOSE_PRICES_PATH}",
        )

    with CLOSE_PRICES_PATH.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.reader(file)
        try:
            headers = next(reader)
        except StopIteration:
            headers = []

    stocks: list[dict] = []
    seen: set[str] = set()

    for raw_header in headers:
        symbol = normalize_symbol(raw_header)

        if not symbol:
            continue
        if symbol in DATE_LIKE_COLUMNS:
            continue
        if symbol in EXCLUDED_UNIVERSE_SYMBOLS:
            continue
        if symbol in seen:
            continue

        seen.add(symbol)
        stocks.append(
            {
                "rank": len(stocks) + 1,
                "symbol": symbol,
                "sector": NSE_TOP_200_FO_CATEGORY,
                "score": 0,
                "return_1w": None,
                "return_1m": None,
                "return_3m": None,
                "return_6m": None,
                "volatility_6m": None,
                "volatility_bucket": None,
            }
        )

    return stocks


def build_retail_allocation(
    weight: float,
    end_price: float,
    capital: float = DEFAULT_RETAIL_CAPITAL,
):
    allocation_amount = abs(float(weight)) * capital

    if end_price <= 0:
        return {
            "allocation_amount": round(allocation_amount, 2),
            "suggested_quantity": 0,
            "actual_invested_amount": 0.0,
            "remaining_cash": round(allocation_amount, 2),
        }

    suggested_quantity = int(math.floor(allocation_amount / end_price))
    actual_invested_amount = suggested_quantity * end_price
    remaining_cash = allocation_amount - actual_invested_amount

    return {
        "allocation_amount": round(allocation_amount, 2),
        "suggested_quantity": suggested_quantity,
        "actual_invested_amount": round(actual_invested_amount, 2),
        "remaining_cash": round(remaining_cash, 2),
    }


@router.get("/universe/nse-top-200-fo")
def get_nse_top_200_fo_universe():
    stocks = load_nse_top_200_fo_universe()
    return {
        "category": NSE_TOP_200_FO_CATEGORY,
        "count": len(stocks),
        "stocks": stocks,
    }


@router.post("/backtest/watchlist", response_model=PortfolioBacktestResponse)
def backtest_watchlist(body: WatchlistBacktestRequest):
    try:
        if not CLOSE_PRICES_PATH.exists():
            raise HTTPException(
                status_code=500,
                detail=f"close_prices_wide.csv not found at: {CLOSE_PRICES_PATH}",
            )

        requested_symbols = [
            normalize_symbol(s) for s in body.symbols if normalize_symbol(s)
        ]

        logger.info("Requested watchlist symbols: %s", requested_symbols)
        logger.info("Requested strategy type: %s", body.strategy_type)

        if body.strategy_type == "mvo":
            (
                metrics,
                curve_df,
                holdings_df,
                benchmark_name,
                benchmark_curve_df,
                benchmark_metrics,
            ) = run_watchlist_mvo_backtest(
                user_symbols=requested_symbols,
                close_prices_path=CLOSE_PRICES_PATH,
                lookback_days=252,
            )
        elif body.strategy_type == "mvo_short":
            (
                metrics,
                curve_df,
                holdings_df,
                benchmark_name,
                benchmark_curve_df,
                benchmark_metrics,
            ) = run_watchlist_mvo_short_backtest(
                user_symbols=requested_symbols,
                close_prices_path=CLOSE_PRICES_PATH,
                lookback_days=252,
            )
        else:
            (
                metrics,
                curve_df,
                holdings_df,
                benchmark_name,
                benchmark_curve_df,
                benchmark_metrics,
            ) = run_watchlist_backtest(
                user_symbols=requested_symbols,
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
                    **build_retail_allocation(
                        weight=float(row["weight"]),
                        end_price=float(row["end_price"]),
                    ),
                )
                for _, row in holdings_df.iterrows()
            ],
            benchmark_name=benchmark_name,
            benchmark_metrics=BenchmarkMetrics(**benchmark_metrics)
            if benchmark_metrics
            else None,
            benchmark_curve=[
                PortfolioPoint(date=row["date"], nav=float(row["nav"]))
                for _, row in benchmark_curve_df.iterrows()
            ]
            if benchmark_curve_df is not None
            else None,
        )

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning("Watchlist backtest validation failed: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Watchlist backtest failed")
        raise HTTPException(status_code=500, detail=str(e))
