from pathlib import Path
from typing import List
import logging

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


class WatchlistBacktestRequest(BaseModel):
    symbols: List[str]
    strategy_type: str = "equal_weight"


def normalize_symbol(value: str) -> str:
    return str(value or "").strip().upper()


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
