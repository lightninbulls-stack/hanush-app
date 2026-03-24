from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd


UNIVERSE_SHEET = "Yahoo_Ticker_Map"


def load_universe_metadata(universe_path: Path, sheet_name: str = UNIVERSE_SHEET) -> pd.DataFrame:
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

    close = close.dropna(how="all")
    if close.empty:
        raise RuntimeError("No close-price data available after date filtering.")

    return close


def latest_ret_3m(monthly: pd.DataFrame) -> pd.Series:
    ret = (monthly / monthly.shift(3)) - 1.0
    return ret.iloc[-1].dropna()


def latest_mom_6_1(monthly: pd.DataFrame) -> pd.Series:
    mom = (monthly.shift(1) / monthly.shift(7)) - 1.0
    return mom.iloc[-1].dropna()


def build_snapshot(monthly: pd.DataFrame) -> pd.DataFrame:
    snap = pd.concat(
        [
            latest_ret_3m(monthly).rename("ret_3m"),
            latest_mom_6_1(monthly).rename("mom_6_1"),
        ],
        axis=1,
    ).dropna(how="any")

    snap.index.name = "Ticker"
    return snap


def rank_snapshot(snapshot: pd.DataFrame, key: str) -> pd.DataFrame:
    if key not in snapshot.columns:
        raise ValueError(f"rank key must be one of {list(snapshot.columns)}. Got: {key}")

    out = snapshot.copy()
    out["rank"] = out[key].rank(ascending=False, method="dense").astype(int)
    out = out.sort_values(["rank", key], ascending=[True, False])
    return out


def trend_arrow(m: float) -> str:
    if m >= 0.30:
        return "↑↑"
    if m >= 0.15:
        return "↑"
    if m >= 0.05:
        return "→↑"
    if m >= -0.05:
        return "→"
    if m >= -0.15:
        return "↓→"
    return "↓"


def minmax_score(series: pd.Series) -> pd.Series:
    s = series.astype(float)
    smin, smax = float(s.min()), float(s.max())

    if smax > smin:
        return ((s - smin) / (smax - smin) * 100.0).round(0).astype(int)

    return pd.Series([50] * len(s), index=s.index, dtype=int)


def build_topn_ui_table(
    ranked: pd.DataFrame,
    universe_meta: pd.DataFrame,
    asof_date: str,
    top_n: int,
) -> pd.DataFrame:
    """
    Merge ranked momentum output with the universe workbook metadata.

    Output:
    - Symbol comes from 'NSE Symbol'
    - Sector comes from 'Sector / Industry' -> renamed to 'Sector'
    """
    merged = ranked.reset_index().merge(universe_meta, on="Ticker", how="left")

    merged["Sector"] = merged["Sector"].fillna("Unknown")
    merged["NSE Symbol"] = merged["NSE Symbol"].fillna(
        merged["Ticker"].astype(str).str.replace(".NS", "", regex=False)
    )
    merged["Company"] = merged["Company"].fillna("")

    # score across full ranked universe
    merged["Score"] = minmax_score(merged["mom_6_1"])

    top = merged.head(top_n).copy()

    out = pd.DataFrame(
        {
            "Date": [asof_date] * len(top),
            "Rank": top["rank"].astype(int),
            "Symbol": top["NSE Symbol"].astype(str),
            "Sector": top["Sector"].astype(str),
            "Score": top["Score"].astype(int),
            "3M Return": (top["ret_3m"] * 100).round(2),
            "6M Return": (top["mom_6_1"] * 100).round(2),
            "Trend": top["mom_6_1"].astype(float).map(trend_arrow),
            "Notes": ["—"] * len(top),
        }
    )

    return out
