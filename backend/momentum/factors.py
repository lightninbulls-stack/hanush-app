from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd


UNIVERSE_SHEET = "Yahoo_Ticker_Map"

TRADING_DAYS_1W = 5
TRADING_DAYS_1M = 21
TRADING_DAYS_3M = 63
TRADING_DAYS_6M = 126
ANNUALIZATION_FACTOR = 252


def load_universe_metadata(
    universe_path: Path,
    sheet_name: str = UNIVERSE_SHEET,
) -> pd.DataFrame:
    """
    Reads the uploaded universe workbook and keeps the columns needed for:
    - Yahoo ticker matching
    - NSE symbol display
    - sector mapping
    - optional company name display
    """
    df = pd.read_excel(universe_path, sheet_name=sheet_name)

    required_cols = [
        "Underlying",
        "NSE Symbol",
        "Yahoo Finance Ticker",
        "Sector / Industry",
    ]
    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns in universe file: {missing}")

    meta = df[required_cols].copy()
    meta = meta.rename(
        columns={
            "Yahoo Finance Ticker": "Ticker",
            "Sector / Industry": "Sector",
            "Underlying": "Company",
        }
    )

    meta["Ticker"] = meta["Ticker"].astype(str).str.strip()
    meta["NSE Symbol"] = meta["NSE Symbol"].astype(str).str.strip()
    meta["Sector"] = meta["Sector"].fillna("Unknown").astype(str).str.strip()
    meta["Company"] = meta["Company"].fillna("").astype(str).str.strip()

    meta = meta.drop_duplicates(subset=["Ticker"], keep="last").reset_index(drop=True)
    return meta


def load_close_prices_from_csv(
    close_prices_path: Path,
    universe_meta: pd.DataFrame,
    start: str,
    end: Optional[str] = None,
) -> pd.DataFrame:
    """
    Reads backend/data/close_prices_wide.csv and filters columns using the
    Yahoo Finance ticker list from the universe workbook.
    """
    if not close_prices_path.exists():
        raise FileNotFoundError(f"close price file not found: {close_prices_path}")

    close = pd.read_csv(close_prices_path, index_col=0)
    close.index = pd.to_datetime(close.index, errors="coerce")
    close = close[~close.index.isna()].sort_index()

    close.columns = [str(col).strip() for col in close.columns]
    close = close.apply(pd.to_numeric, errors="coerce")

    allowed_tickers = universe_meta["Ticker"].tolist()
    available_tickers = [ticker for ticker in allowed_tickers if ticker in close.columns]

    if not available_tickers:
        raise RuntimeError(
            "No overlapping tickers found between close_prices_wide.csv "
            "and the universe workbook."
        )

    close = close.reindex(columns=available_tickers)

    start_ts = pd.to_datetime(start)
    close = close.loc[close.index >= start_ts]

    if end is not None:
        end_ts = pd.to_datetime(end)
        close = close.loc[close.index <= end_ts]

    close = close.dropna(axis=1, how="all")
    close = close.dropna(axis=0, how="all")

    if close.empty:
        raise RuntimeError("No valid close-price data found after date filtering.")

    return close


def latest_return(close: pd.DataFrame, window: int) -> pd.Series:
    """
    Point-to-point total return over the last `window` trading days.
    """
    ret = close.pct_change(periods=window)
    return ret.iloc[-1].dropna()


def latest_vol_6m(
    close: pd.DataFrame,
    window: int = TRADING_DAYS_6M,
    annualize: bool = True,
) -> pd.Series:
    """
    6-month realized volatility using daily close-to-close returns.
    """
    daily_ret = close.pct_change()
    rolling_std = daily_ret.rolling(window=window, min_periods=window).std()
    vol = rolling_std.iloc[-1].dropna()

    if annualize:
        vol = vol * np.sqrt(ANNUALIZATION_FACTOR)

    return vol


def latest_mom_6_1(monthly: pd.DataFrame) -> pd.Series:
    """
    Classic 6-1 momentum:
    previous month close / close 7 months ago - 1
    """
    mom = (monthly.shift(1) / monthly.shift(7)) - 1.0
    return mom.iloc[-1].dropna()


def build_snapshot(close: pd.DataFrame) -> pd.DataFrame:
    """
    Keep momentum strategy intact:
    - ranking is still done on mom_6_1

    But add extra columns so the final UI output matches low-vol format.
    """
    monthly = close.resample("M").last()

    snapshot = pd.concat(
        [
            latest_return(close, TRADING_DAYS_1W).rename("ret_1w"),
            latest_return(close, TRADING_DAYS_1M).rename("ret_1m"),
            latest_return(close, TRADING_DAYS_3M).rename("ret_3m"),
            latest_return(close, TRADING_DAYS_6M).rename("ret_6m"),
            latest_vol_6m(close).rename("vol_6m"),
            latest_mom_6_1(monthly).rename("mom_6_1"),
        ],
        axis=1,
    ).dropna(how="any")

    snapshot.index.name = "Ticker"
    return snapshot


def rank_snapshot(snapshot: pd.DataFrame, key: str = "mom_6_1") -> pd.DataFrame:
    """
    Higher momentum gets better rank.
    Strategy remains momentum-based.
    """
    if key not in snapshot.columns:
        raise ValueError(f"rank key must be one of {list(snapshot.columns)}. Got: {key}")

    out = snapshot.copy()
    out["rank"] = out[key].rank(ascending=False, method="dense").astype(int)
    out = out.sort_values(["rank", key], ascending=[True, False])
    return out


def minmax_score(series: pd.Series) -> pd.Series:
    """
    Higher momentum = higher score
    """
    s = series.astype(float)
    smin, smax = float(s.min()), float(s.max())

    if smax > smin:
        return ((s - smin) / (smax - smin) * 100.0).round(0).astype(int)

    return pd.Series([50] * len(s), index=s.index, dtype=int)


def vol_label(v: float) -> str:
    """
    v is annualized volatility in decimal form.
    Example: 0.18 = 18%
    """
    if v < 0.15:
        return "Low Vol"
    if v < 0.25:
        return "Medium Vol"
    if v < 0.35:
        return "High Vol"
    return "Very High Vol"


def build_topn_ui_table(
    ranked: pd.DataFrame,
    universe_meta: pd.DataFrame,
    asof_date: str,
    top_n: int,
) -> pd.DataFrame:
    """
    Momentum strategy stays the same.
    Only output columns are aligned to low-vol format.
    """
    merged = ranked.reset_index().merge(universe_meta, on="Ticker", how="left")

    merged["Sector"] = merged["Sector"].fillna("Unknown")
    merged["NSE Symbol"] = merged["NSE Symbol"].fillna(
        merged["Ticker"].astype(str).str.replace(".NS", "", regex=False)
    )
    merged["Company"] = merged["Company"].fillna("")

    # IMPORTANT:
    # Score is still based on momentum, not volatility
    merged["Score"] = minmax_score(merged["mom_6_1"])

    top = merged.head(top_n).copy()

    out = pd.DataFrame(
        {
            "Date": [asof_date] * len(top),
            "Rank": top["rank"].astype(int),
            "Symbol": top["NSE Symbol"].astype(str),
            "Sector": top["Sector"].astype(str),
            "Score": top["Score"].astype(int),
            "1W Return": (top["ret_1w"] * 100).round(2),
            "1M Return": (top["ret_1m"] * 100).round(2),
            "3M Return": (top["ret_3m"] * 100).round(2),
            "6M Return": (top["ret_6m"] * 100).round(2),
            "6M Volatility": (top["vol_6m"] * 100).round(2),
            "Volatility Bucket": top["vol_6m"].astype(float).map(vol_label),
            "Notes": ["—"] * len(top),
        }
    )

    return out
