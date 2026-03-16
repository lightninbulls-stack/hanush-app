from __future__ import annotations

from typing import List, Optional
import asyncio

import numpy as np
import pandas as pd
import yfinance as yf


async def download_close_prices(tickers: List[str], start: str, end: Optional[str]) -> pd.DataFrame:
    def _download():
        df = yf.download(
            tickers=tickers,
            start=start,
            end=end,
            auto_adjust=True,
            progress=False,
            group_by="column",
            threads=True,
        )
        if df.empty:
            raise RuntimeError("No data returned from Yahoo. Check internet / tickers.")
        if isinstance(df.columns, pd.MultiIndex):
            if "Close" not in df.columns.get_level_values(0):
                raise RuntimeError("Unexpected yfinance output: 'Close' not found.")
            close = df["Close"].copy()
        else:
            close = df[["Close"]].rename(columns={"Close": tickers[0]})
        return close.dropna(how="all")

    return await asyncio.to_thread(_download)


async def latest_ret_3m(monthly: pd.DataFrame) -> pd.Series:
    return await asyncio.to_thread(lambda: (monthly / monthly.shift(3) - 1.0).iloc[-1].dropna())


async def latest_mom_6_1(monthly: pd.DataFrame) -> pd.Series:
    return await asyncio.to_thread(lambda: (monthly.shift(1) / monthly.shift(7) - 1.0).iloc[-1].dropna())


async def build_snapshot(monthly: pd.DataFrame) -> pd.DataFrame:
    ret3m = await latest_ret_3m(monthly)
    mom61 = await latest_mom_6_1(monthly)
    snap = pd.concat([ret3m.rename("ret_3m"), mom61.rename("mom_6_1")], axis=1).dropna(how="any")
    snap.index.name = "Ticker"
    return snap


async def rank_snapshot(snapshot: pd.DataFrame, key: str) -> pd.DataFrame:
    def _rank():
        if key not in snapshot.columns:
            raise ValueError(f"rank_by must be one of {list(snapshot.columns)}. Got: {key}")
        out = snapshot.copy()
        out["rank"] = out[key].rank(ascending=False, method="dense").astype(int)
        return out.sort_values(["rank", key], ascending=[True, False])
    return await asyncio.to_thread(_rank)


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


async def build_topn_ui_table(
    ranked: pd.DataFrame,
    sector_map: pd.DataFrame,
    asof_date: str,
    top_n: int,
) -> pd.DataFrame:
    def _build():
        df = ranked.reset_index().merge(sector_map, on="Ticker", how="left")
        df["Sector"] = df["Sector"].fillna("Unknown")
        df["Score"] = minmax_score(df["mom_6_1"])
        top = df.head(top_n).copy()
        return pd.DataFrame({
            "Date": [asof_date] * len(top),
            "Rank": top["rank"].astype(int),
            "Symbol": top["Ticker"].astype(str).str.replace(".NS", "", regex=False),
            "Sector": top["Sector"].astype(str),
            "Score": top["Score"].astype(int),
            "3M Return": (top["ret_3m"] * 100).round(2),
            "6M Return": (top["mom_6_1"] * 100).round(2),
            "Trend": top["mom_6_1"].astype(float).map(trend_arrow),
            "Notes": ["—"] * len(top),
        })
    return await asyncio.to_thread(_build)
