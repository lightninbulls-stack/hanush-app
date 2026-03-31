from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

import numpy as np
import pandas as pd


ANNUALIZATION_FACTOR = 252


def load_universe_metadata(universe_path: Path) -> pd.DataFrame:
    df = pd.read_excel(universe_path, sheet_name="Yahoo_Ticker_Map")

    meta = df[
        ["NSE Symbol", "Yahoo Finance Ticker", "Underlying", "Sector / Industry"]
    ].copy()

    meta = meta.rename(
        columns={
            "NSE Symbol": "Symbol",
            "Yahoo Finance Ticker": "Ticker",
            "Underlying": "Company",
            "Sector / Industry": "Sector",
        }
    )

    meta["Symbol"] = meta["Symbol"].astype(str).str.strip().str.upper()
    meta["Ticker"] = meta["Ticker"].astype(str).str.strip()

    return meta.drop_duplicates(subset=["Symbol"], keep="last").reset_index(drop=True)


def load_close_prices(close_prices_path: Path) -> pd.DataFrame:
    close = pd.read_csv(close_prices_path, index_col=0)
    close.index = pd.to_datetime(close.index, errors="coerce")
    close = close[~close.index.isna()].sort_index()
    close.columns = [str(c).strip() for c in close.columns]
    close = close.apply(pd.to_numeric, errors="coerce")
    return close.dropna(axis=0, how="all").dropna(axis=1, how="all")


def period_return(nav: pd.Series, window: int):
    if len(nav) <= window:
        return None
    return float((nav.iloc[-1] / nav.iloc[-window - 1] - 1.0) * 100.0)


def compute_metrics(portfolio_ret: pd.Series, nav: pd.Series) -> dict:
    cumulative_return = float((nav.iloc[-1] - 1.0) * 100.0)

    years = len(portfolio_ret) / ANNUALIZATION_FACTOR
    cagr = float(((nav.iloc[-1]) ** (1.0 / years) - 1.0) * 100.0) if years > 0 else 0.0

    vol = float(portfolio_ret.std() * np.sqrt(ANNUALIZATION_FACTOR) * 100.0)
    sharpe = (
        float((portfolio_ret.mean() / portfolio_ret.std()) * np.sqrt(ANNUALIZATION_FACTOR))
        if portfolio_ret.std() > 0
        else 0.0
    )

    running_max = nav.cummax()
    drawdown = nav / running_max - 1.0
    mdd = float(drawdown.min() * 100.0)

    r1m = period_return(nav, 21)
    r3m = period_return(nav, 63)
    r6m = period_return(nav, 126)

    return {
        "cumulative_return_pct": round(cumulative_return, 2),
        "cagr_pct": round(cagr, 2),
        "annualized_volatility_pct": round(vol, 2),
        "sharpe": round(sharpe, 2),
        "max_drawdown_pct": round(mdd, 2),
        "return_1m_pct": round(r1m, 2) if r1m is not None else None,
        "return_3m_pct": round(r3m, 2) if r3m is not None else None,
        "return_6m_pct": round(r6m, 2) if r6m is not None else None,
    }


def run_watchlist_backtest(
    user_symbols: List[str],
    universe_path: Path,
    close_prices_path: Path,
    lookback_days: int = 252,
) -> Tuple[dict, pd.DataFrame, pd.DataFrame]:
    if not user_symbols:
        raise ValueError("Watchlist is empty.")

    meta = load_universe_metadata(universe_path)
    close = load_close_prices(close_prices_path)

    requested = pd.DataFrame({"Symbol": [str(s).strip().upper() for s in user_symbols]})
    requested = requested.drop_duplicates().reset_index(drop=True)

    merged = requested.merge(meta, on="Symbol", how="left").dropna(subset=["Ticker"])

    if merged.empty:
        raise ValueError("None of the watchlist symbols matched the universe file.")

    tickers = [t for t in merged["Ticker"].tolist() if t in close.columns]
    if not tickers:
        raise ValueError("Matched symbols were not found in close_prices_wide.csv.")

    close_subset = close[tickers].copy().tail(lookback_days + 1)
    close_subset = close_subset.ffill().dropna(axis=1, how="any")

    if close_subset.shape[1] == 0:
        raise ValueError("No symbols had sufficient price history for backtest.")

    daily_ret = close_subset.pct_change().dropna()

    n = daily_ret.shape[1]
    weights = np.repeat(1.0 / n, n)

    portfolio_ret = daily_ret.dot(weights)
    nav = (1.0 + portfolio_ret).cumprod()

    metrics = compute_metrics(portfolio_ret, nav)

    curve = pd.DataFrame(
        {
            "date": nav.index.strftime("%Y-%m-%d"),
            "nav": nav.round(6).values,
        }
    )

    start_prices = close_subset.iloc[0]
    end_prices = close_subset.iloc[-1]

    holdings = pd.DataFrame(
        {
            "ticker": close_subset.columns,
            "weight": weights,
            "start_price": start_prices.values,
            "end_price": end_prices.values,
            "total_return_pct": ((end_prices / start_prices - 1.0) * 100.0).round(2).values,
        }
    )

    holdings = holdings.merge(
        merged[["Symbol", "Ticker"]].drop_duplicates(),
        left_on="ticker",
        right_on="Ticker",
        how="left",
    )

    return metrics, curve, holdings
