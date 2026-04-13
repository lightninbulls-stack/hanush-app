from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd


UNIVERSE_SHEET = "Yahoo_Ticker_Map"

TRADING_DAYS_1W = 5
TRADING_DAYS_1M = 21
TRADING_DAYS_2M = 42
TRADING_DAYS_3M = 63
TRADING_DAYS_6M = 126
ANNUALIZATION_FACTOR = 252

EMA_FAST = 3
EMA_SLOW = 8
CROSS_LOOKBACK = 5
ZSCORE_WINDOW = 252
DEFAULT_Z_THRESHOLD = 1.5


def load_universe_metadata(
    universe_path: Path,
    sheet_name: str = UNIVERSE_SHEET,
) -> pd.DataFrame:
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
    ret = close.pct_change(periods=window)
    return ret.iloc[-1].dropna()


def latest_vol_6m(
    close: pd.DataFrame,
    window: int = TRADING_DAYS_6M,
    annualize: bool = True,
) -> pd.Series:
    daily_ret = close.pct_change()
    rolling_std = daily_ret.rolling(window=window, min_periods=window).std()
    vol = rolling_std.iloc[-1].dropna()

    if annualize:
        vol = vol * np.sqrt(ANNUALIZATION_FACTOR)

    return vol


def latest_2m_return_zscore(
    close: pd.DataFrame,
    return_lookback: int = TRADING_DAYS_2M,
    zscore_window: int = ZSCORE_WINDOW,
) -> pd.DataFrame:
    ret_2m = close.pct_change(periods=return_lookback)

    rolling_mean = ret_2m.rolling(
        window=zscore_window,
        min_periods=zscore_window,
    ).mean()

    rolling_std = ret_2m.rolling(
        window=zscore_window,
        min_periods=zscore_window,
    ).std(ddof=0)

    zscore_2m = (ret_2m - rolling_mean) / rolling_std.replace(0, np.nan)

    out = pd.DataFrame(
        {
            "ret_2m": ret_2m.iloc[-1],
            "z_2m": zscore_2m.iloc[-1],
        }
    )
    out.index.name = "Ticker"
    return out


def latest_ema_confirmation(
    close: pd.DataFrame,
    ema_fast: int = EMA_FAST,
    ema_slow: int = EMA_SLOW,
    cross_lookback: int = CROSS_LOOKBACK,
) -> pd.DataFrame:
    ema_fast_df = close.ewm(span=ema_fast, adjust=False).mean()
    ema_slow_df = close.ewm(span=ema_slow, adjust=False).mean()

    bull_cross = (
        (ema_fast_df > ema_slow_df)
        & (ema_fast_df.shift(1) <= ema_slow_df.shift(1))
    )

    bear_cross = (
        (ema_fast_df < ema_slow_df)
        & (ema_fast_df.shift(1) >= ema_slow_df.shift(1))
    )

    recent_bull_cross = (
        bull_cross.rolling(window=cross_lookback, min_periods=1).max().iloc[-1].fillna(0).astype(bool)
    )
    recent_bear_cross = (
        bear_cross.rolling(window=cross_lookback, min_periods=1).max().iloc[-1].fillna(0).astype(bool)
    )

    ema_bullish = (ema_fast_df.iloc[-1] > ema_slow_df.iloc[-1]).fillna(False)
    ema_bearish = (ema_fast_df.iloc[-1] < ema_slow_df.iloc[-1]).fillna(False)

    out = pd.DataFrame(
        {
            "recent_bull_cross": recent_bull_cross,
            "recent_bear_cross": recent_bear_cross,
            "ema_bullish": ema_bullish,
            "ema_bearish": ema_bearish,
        }
    )
    out.index.name = "Ticker"
    return out


def build_range_bound_snapshot(close: pd.DataFrame) -> pd.DataFrame:
    snapshot = pd.concat(
        [
            latest_return(close, TRADING_DAYS_1W).rename("ret_1w"),
            latest_return(close, TRADING_DAYS_1M).rename("ret_1m"),
            latest_return(close, TRADING_DAYS_2M).rename("ret_2m_display"),
            latest_return(close, TRADING_DAYS_3M).rename("ret_3m"),
            latest_return(close, TRADING_DAYS_6M).rename("ret_6m"),
            latest_vol_6m(close).rename("vol_6m"),
            latest_2m_return_zscore(close),
            latest_ema_confirmation(close),
        ],
        axis=1,
    )

    snapshot = snapshot.dropna(subset=["ret_2m", "z_2m"])
    snapshot.index.name = "Ticker"
    return snapshot


def minmax_score(series: pd.Series) -> pd.Series:
    if series.empty:
        return pd.Series(dtype=int)

    s = series.astype(float)
    smin, smax = float(s.min()), float(s.max())

    if smax > smin:
        return ((s - smin) / (smax - smin) * 100.0).round(0).astype(int)

    return pd.Series([50] * len(s), index=s.index, dtype=int)


def vol_label(v: float) -> str:
    if v < 0.15:
        return "Low Vol"
    if v < 0.25:
        return "Medium Vol"
    if v < 0.35:
        return "High Vol"
    return "Very High Vol"


def build_topn_ui_table(
    snapshot: pd.DataFrame,
    universe_meta: pd.DataFrame,
    signal_type: str,
    asof_date: str,
    top_n: int,
    z_threshold: float = DEFAULT_Z_THRESHOLD,
) -> pd.DataFrame:
    if signal_type == "Upside":
        filtered = snapshot[
            (snapshot["z_2m"] <= -z_threshold)
            & snapshot["recent_bull_cross"]
            & snapshot["ema_bullish"]
        ].copy()
        filtered = filtered.sort_values(["z_2m", "ret_2m"], ascending=[True, True])

    elif signal_type == "Downside":
        filtered = snapshot[
            (snapshot["z_2m"] >= z_threshold)
            & snapshot["recent_bear_cross"]
            & snapshot["ema_bearish"]
        ].copy()
        filtered = filtered.sort_values(["z_2m", "ret_2m"], ascending=[False, False])

    else:
        raise ValueError("signal_type must be 'Upside' or 'Downside'")

    if filtered.empty:
        return pd.DataFrame(
            columns=[
                "Date",
                "Rank",
                "Symbol",
                "Sector",
                "Score",
                "1W Return",
                "1M Return",
                "3M Return",
                "6M Return",
                "6M Volatility",
                "Volatility Bucket",
                "Notes",
            ]
        )

    filtered = filtered.head(top_n).copy()
    filtered["rank"] = np.arange(1, len(filtered) + 1)
    filtered["Score"] = minmax_score(filtered["z_2m"].abs())

    merged = filtered.reset_index().merge(universe_meta, on="Ticker", how="left")

    merged["Sector"] = merged["Sector"].fillna("Unknown")
    merged["NSE Symbol"] = merged["NSE Symbol"].fillna(
        merged["Ticker"].astype(str).str.replace(".NS", "", regex=False)
    )

    notes = (
        "2M z-score oversold + EMA(3/8) bullish"
        if signal_type == "Upside"
        else "2M z-score overbought + EMA(3/8) bearish"
    )

    out = pd.DataFrame(
        {
            "Date": [asof_date] * len(merged),
            "Rank": merged["rank"].astype(int),
            "Symbol": merged["NSE Symbol"].astype(str),
            "Sector": merged["Sector"].astype(str),
            "Score": merged["Score"].astype(int),
            "1W Return": (merged["ret_1w"] * 100).round(2),
            "1M Return": (merged["ret_1m"] * 100).round(2),
            "3M Return": (merged["ret_3m"] * 100).round(2),
            "6M Return": (merged["ret_6m"] * 100).round(2),
            "6M Volatility": (merged["vol_6m"] * 100).round(2),
            "Volatility Bucket": merged["vol_6m"].astype(float).map(vol_label),
            "Notes": [notes] * len(merged),
        }
    )

    return out
