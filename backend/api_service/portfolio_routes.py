from pathlib import Path
from typing import List
import logging
import math

import pandas as pd
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
SECTORAL_INDICES_CATEGORY = "Sectoral Indices Performance"
SECTORAL_INDEX_SYMBOLS = [
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
]
SECTORAL_INDEX_NAMES = {
    "^CNXAUTO": "Nifty Auto",
    "^CNXFMCG": "Nifty FMCG",
    "^CNXIT": "Nifty IT",
    "^CNXMEDIA": "Nifty Media",
    "^CNXMETAL": "Nifty Metal",
    "^CNXPHARMA": "Nifty Pharma",
    "^CNXPSUBANK": "Nifty PSU Bank",
    "^CNXREALTY": "Nifty Realty",
    "^NSEBANK": "Nifty Bank",
    "^NSEI": "Nifty 50",
}
EXCLUDED_UNIVERSE_SYMBOLS = set(SECTORAL_INDEX_SYMBOLS)
DATE_LIKE_COLUMNS = {"DATE", "DATETIME", "TIME", "TIMESTAMP"}

DEFAULT_RETAIL_CAPITAL = 100000.0
TRADING_DAYS_PER_YEAR = 252


class WatchlistBacktestRequest(BaseModel):
    symbols: List[str]
    strategy_type: str = "equal_weight"


def normalize_symbol(value: str) -> str:
    return str(value or "").strip().upper()


def safe_round(value: float | None, digits: int = 2) -> float | None:
    if value is None:
        return None
    try:
        if not math.isfinite(float(value)):
            return None
        return round(float(value), digits)
    except Exception:
        return None


def pct_return(series: pd.Series, lookback: int) -> float | None:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if len(clean) <= lookback:
        return None

    latest = float(clean.iloc[-1])
    previous = float(clean.iloc[-lookback - 1])

    if previous <= 0:
        return None

    return ((latest / previous) - 1.0) * 100.0


def annualized_volatility(series: pd.Series, lookback: int = 126) -> float | None:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if len(clean) < lookback + 1:
        return None

    returns = clean.pct_change().dropna().tail(lookback)
    if returns.empty:
        return None

    return float(returns.std() * math.sqrt(TRADING_DAYS_PER_YEAR) * 100.0)


def volatility_bucket(volatility_6m: float | None) -> str | None:
    if volatility_6m is None:
        return None
    if volatility_6m < 20:
        return "Low"
    if volatility_6m < 35:
        return "Medium"
    return "High"


def read_close_prices_wide() -> pd.DataFrame:
    if not CLOSE_PRICES_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=f"close_prices_wide.csv not found at: {CLOSE_PRICES_PATH}",
        )

    close_df = pd.read_csv(CLOSE_PRICES_PATH, index_col=0)

    if close_df.empty:
        return close_df

    close_df.columns = [normalize_symbol(col) for col in close_df.columns]
    close_df = close_df.apply(pd.to_numeric, errors="coerce")
    return close_df


def build_performance_row(
    symbol: str,
    price_series: pd.Series,
    category: str,
    sector_label: str,
) -> dict:
    ret_1w = safe_round(pct_return(price_series, 5))
    ret_1m = safe_round(pct_return(price_series, 21))
    ret_3m = safe_round(pct_return(price_series, 63))
    ret_6m = safe_round(pct_return(price_series, 126))
    vol_6m = safe_round(annualized_volatility(price_series, 126))

    score = ret_6m
    if score is None:
        score = ret_3m
    if score is None:
        score = ret_1m
    if score is None:
        score = 0.0

    return {
        "rank": 0,
        "symbol": symbol,
        "sector": sector_label or category,
        "score": safe_round(score) or 0,
        "return_1w": ret_1w,
        "return_1m": ret_1m,
        "return_3m": ret_3m,
        "return_6m": ret_6m,
        "volatility_6m": vol_6m,
        "volatility_bucket": volatility_bucket(vol_6m),
    }


def rank_rows_by_score(rows: list[dict]) -> list[dict]:
    rows.sort(key=lambda row: float(row.get("score") or 0), reverse=True)

    for index, row in enumerate(rows, start=1):
        row["rank"] = index

    return rows


def load_nse_top_200_fo_universe() -> list[dict]:
    """
    Build the NSE TOP 200 F&O stock universe directly from close_prices_wide.csv.

    The close wide file contains both stocks and index/sector symbols. For this
    user-facing universe, we exclude the index/sector columns and calculate the
    same return/volatility analytics shown in other screener tables.
    """
    close_df = read_close_prices_wide()

    if close_df.empty:
        return []

    stocks: list[dict] = []
    seen: set[str] = set()

    for symbol in close_df.columns:
        symbol = normalize_symbol(symbol)

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
            build_performance_row(
                symbol=symbol,
                price_series=close_df[symbol],
                category=NSE_TOP_200_FO_CATEGORY,
                sector_label=NSE_TOP_200_FO_CATEGORY,
            )
        )

    return rank_rows_by_score(stocks)


def load_sectoral_indices_performance() -> list[dict]:
    close_df = read_close_prices_wide()

    if close_df.empty:
        return []

    rows: list[dict] = []

    for symbol in SECTORAL_INDEX_SYMBOLS:
        normalized_symbol = normalize_symbol(symbol)

        if normalized_symbol not in close_df.columns:
            logger.warning("Sectoral index column missing in close_prices_wide.csv: %s", normalized_symbol)
            continue

        rows.append(
            build_performance_row(
                symbol=normalized_symbol,
                price_series=close_df[normalized_symbol],
                category=SECTORAL_INDICES_CATEGORY,
                sector_label=SECTORAL_INDEX_NAMES.get(normalized_symbol, SECTORAL_INDICES_CATEGORY),
            )
        )

    return rank_rows_by_score(rows)


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


@router.get("/universe/sectoral-indices-performance")
def get_sectoral_indices_performance():
    stocks = load_sectoral_indices_performance()
    return {
        "category": SECTORAL_INDICES_CATEGORY,
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
