from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd


UNIVERSE_SHEET = "Yahoo_Ticker_Map"

TRADING_DAYS_1W = 5
TRADING_DAYS_1M = 21
TRADING_DAYS_3M = 63
TRADING_DAYS_6M = 126
ANNUALIZATION_FACTOR = 252

EMA_PAIRS: List[Tuple[int, int]] = [
    (3, 8),
    (5, 15),
    (5, 20),
    (8, 21),
    (10, 30),
]

MIN_SIGNAL_RATIO = 0.60  # 3 out of 5


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


def compute_latest_emas(close: pd.DataFrame, spans: List[int]) -> pd.DataFrame:
    ema_frames = []

    for span in sorted(set(spans)):
        ema_last = close.ewm(span=span, adjust=False, min_periods=span).mean().iloc[-1]
        ema_last.name = f"ema_{span}"
        ema_frames.append(ema_last)

    ema_df = pd.concat(ema_frames, axis=1)
    ema_df.index.name = "Ticker"
    return ema_df


def classify_signal(bullish_ratio: float, bearish_ratio: float) -> str:
    if bullish_ratio >= MIN_SIGNAL_RATIO:
        return "Upside"
    if bearish_ratio >= MIN_SIGNAL_RATIO:
        return "Downside"
    return "No Signal"


def build_regime_snapshot(close: pd.DataFrame) -> pd.DataFrame:
    max_required_history = max(
        TRADING_DAYS_6M + 1,
        max(slow for _, slow in EMA_PAIRS),
    )

    if len(close) < max_required_history:
        raise RuntimeError(
            f"Not enough daily history. Need at least {max_required_history} rows, got {len(close)}."
        )

    latest_close = close.iloc[-1].rename("close")
    ret_1w = latest_return(close, TRADING_DAYS_1W).rename("ret_1w")
    ret_1m = latest_return(close, TRADING_DAYS_1M).rename("ret_1m")
    ret_3m = latest_return(close, TRADING_DAYS_3M).rename("ret_3m")
    ret_6m = latest_return(close, TRADING_DAYS_6M).rename("ret_6m")
    vol_6m = latest_vol_6m(close).rename("vol_6m")

    required_spans = []
    for fast, slow in EMA_PAIRS:
        required_spans.extend([fast, slow])

    ema_df = compute_latest_emas(close, required_spans)

    snapshot = pd.concat(
        [
            latest_close,
            ret_1w,
            ret_1m,
            ret_3m,
            ret_6m,
            vol_6m,
            ema_df,
        ],
        axis=1,
    )

    signal_cols: List[str] = []
    spread_cols: List[str] = []

    for fast, slow in EMA_PAIRS:
        fast_col = f"ema_{fast}"
        slow_col = f"ema_{slow}"

        signal_col = f"signal_{fast}_{slow}"
        spread_col = f"spread_{fast}_{slow}_pct"

        snapshot[signal_col] = np.where(
            snapshot[fast_col] > snapshot[slow_col],
            1,
            np.where(snapshot[fast_col] < snapshot[slow_col], -1, 0),
        )

        snapshot[spread_col] = ((snapshot[fast_col] / snapshot[slow_col]) - 1.0) * 100.0

        signal_cols.append(signal_col)
        spread_cols.append(spread_col)

    snapshot["bullish_count"] = (snapshot[signal_cols] == 1).sum(axis=1)
    snapshot["bearish_count"] = (snapshot[signal_cols] == -1).sum(axis=1)
    snapshot["neutral_count"] = (snapshot[signal_cols] == 0).sum(axis=1)

    pair_count = len(EMA_PAIRS)
    snapshot["bullish_ratio"] = snapshot["bullish_count"] / pair_count
    snapshot["bearish_ratio"] = snapshot["bearish_count"] / pair_count
    snapshot["neutral_ratio"] = snapshot["neutral_count"] / pair_count

    snapshot["ensemble_score"] = np.where(
        snapshot["bearish_ratio"] > snapshot["bullish_ratio"],
        -snapshot["bearish_ratio"],
        snapshot["bullish_ratio"],
    )

    snapshot["avg_ema_spread_pct"] = snapshot[spread_cols].mean(axis=1)

    positive_spreads = snapshot[spread_cols].clip(lower=0.0)
    negative_spreads = snapshot[spread_cols].clip(upper=0.0)

    snapshot["upside_strength_pct"] = positive_spreads.mean(axis=1)
    snapshot["downside_strength_pct"] = negative_spreads.abs().mean(axis=1)

    snapshot["Signal"] = snapshot.apply(
        lambda row: classify_signal(
            bullish_ratio=row["bullish_ratio"],
            bearish_ratio=row["bearish_ratio"],
        ),
        axis=1,
    )

    snapshot = snapshot.dropna(
        subset=[
            "close",
            "ret_1w",
            "ret_1m",
            "ret_3m",
            "ret_6m",
            "vol_6m",
        ]
    )

    snapshot.index.name = "Ticker"
    return snapshot


def score_from_ratio(series: pd.Series) -> pd.Series:
    return (series.astype(float) * 100.0).round(0).astype(int)


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
) -> pd.DataFrame:
    if signal_type not in {"Upside", "Downside"}:
        raise ValueError("signal_type must be either 'Upside' or 'Downside'")

    df = snapshot.loc[snapshot["Signal"] == signal_type].copy()

    if df.empty:
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

    if signal_type == "Upside":
        df = df.sort_values(
            by=[
                "bullish_ratio",
                "avg_ema_spread_pct",
                "ret_1m",
                "ret_1w",
            ],
            ascending=[False, False, False, False],
        )
        df["Score"] = score_from_ratio(df["bullish_ratio"])
    else:
        df = df.sort_values(
            by=[
                "bearish_ratio",
                "avg_ema_spread_pct",
                "ret_1m",
                "ret_1w",
            ],
            ascending=[False, True, True, True],
        )
        df["Score"] = score_from_ratio(df["bearish_ratio"])

    top = df.head(top_n).copy()
    top["Rank"] = range(1, len(top) + 1)

    merged = top.reset_index().merge(universe_meta, on="Ticker", how="left")

    merged["Sector"] = merged["Sector"].fillna("Unknown")
    merged["NSE Symbol"] = merged["NSE Symbol"].fillna(
        merged["Ticker"].astype(str).str.replace(".NS", "", regex=False)
    )

    out = pd.DataFrame(
        {
            "Date": [asof_date] * len(merged),
            "Rank": merged["Rank"].astype(int),
            "Symbol": merged["NSE Symbol"].astype(str),
            "Sector": merged["Sector"].astype(str),
            "Score": merged["Score"].astype(int),
            "1W Return": (merged["ret_1w"] * 100).round(2),
            "1M Return": (merged["ret_1m"] * 100).round(2),
            "3M Return": (merged["ret_3m"] * 100).round(2),
            "6M Return": (merged["ret_6m"] * 100).round(2),
            "6M Volatility": (merged["vol_6m"] * 100).round(2),
            "Volatility Bucket": merged["vol_6m"].astype(float).map(vol_label),
            "Notes": [f"EMA Ensemble {signal_type}"] * len(merged),
        }
    )

    return out
