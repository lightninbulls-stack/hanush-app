from pathlib import Path
from typing import List

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


class WatchlistBacktestRequest(BaseModel):
    symbols: List[str]


@router.post("/backtest/watchlist", response_model=PortfolioBacktestResponse)
def backtest_watchlist(body: WatchlistBacktestRequest):
    try:
        metrics, curve_df, holdings_df = run_watchlist_backtest(
            user_symbols=body.symbols,
            universe_path=Path("backend/data/yahoo_finance_ticker_universe_with_sector_business_model.xlsx"),
            close_prices_path=Path("backend/data/close_prices_wide.csv"),
            lookback_days=252,
        )

        matched_symbols = (
            holdings_df["Symbol"].dropna().astype(str).drop_duplicates().tolist()
        )

        return PortfolioBacktestResponse(
            requested_symbols=[str(s).strip().upper() for s in body.symbols],
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
