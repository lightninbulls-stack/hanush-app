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
    Reads the universe workbook and keeps the columns needed for:
    - Yahoo ticker matching
    - NSE symbol display
    - sector mapping
    - company name matching
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

    meta["company_key"] = meta["Company"].str.lower().str.strip()
    meta["symbol_key"] = meta["NSE Symbol"].str.lower().str.strip()
    meta["ticker_key"] = meta["Ticker"].str.lower().str.strip()

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


def load_quality_input(
    quality_input_path: Path,
    universe_meta: pd.DataFrame,
) -> pd.DataFrame:
    """
    Supports:
    - Company Name / Company / Underlying
    - Symbol / NSE Symbol
    - Ticker / Yahoo Finance Ticker

    Optional:
    - Rank
    - Score
    - Notes
    """
    if not quality_input_path.exists():
        raise FileNotFoundError(f"quality input file not found: {quality_input_path}")

    if quality_input_path.suffix.lower() == ".csv":
        df = pd.read_csv(quality_input_path)
    else:
        df = pd.read_excel(quality_input_path)

    if df.empty:
        raise RuntimeError("quality input file is empty.")

    df = df.copy().reset_index(drop=True)
    df["__input_order"] = range(len(df))

    cols = {c.lower().strip(): c for c in df.columns}

    company_col = next((cols[c] for c in ["company name", "company", "underlying"] if c in cols), None)
    symbol_col = next((cols[c] for c in ["symbol", "nse symbol"] if c in cols), None)
    ticker_col = next((cols[c] for c in ["ticker", "yahoo finance ticker"] if c in cols), None)

    rank_col = next((cols[c] for c in ["rank"] if c in cols), None)
    score_col = next((cols[c] for c in ["score"] if c in cols), None)
    notes_col = next((cols[c] for c in ["notes", "note"] if c in cols), None)

    if company_col is not None:
        df["company_key"] = df[company_col].astype(str).str.strip().str.lower()
        selected = df.merge(
            universe_meta[["Ticker", "NSE Symbol", "Sector", "Company", "company_key"]],
            on="company_key",
            how="left",
        )
    elif symbol_col is not None:
        df["symbol_key"] = df[symbol_col].astype(str).str.strip().str.lower()
        selected = df.merge(
            universe_meta[["Ticker", "NSE Symbol", "Sector", "Company", "symbol_key"]],
            on="symbol_key",
            how="left",
        )
    elif ticker_col is not None:
        df["ticker_key"] = df[ticker_col].astype(str).str.strip().str.lower()
        selected = df.merge(
            universe_meta[["Ticker", "NSE Symbol", "Sector", "Company", "ticker_key"]],
            on="ticker_key",
            how="left",
        )
    else:
        raise ValueError(
            "quality input must contain one of these columns: "
            "Company Name / Company / Underlying / Symbol / Ticker"
        )

    selected = selected.sort_values("__input_order").reset_index(drop=True)

    if rank_col is not None:
        selected["Rank"] = pd.to_numeric(selected[rank_col], errors="coerce")
    else:
        selected["Rank"] = selected["__input_order"] + 1

    if score_col is not None:
        selected["Score"] = pd.to_numeric(selected[score_col], errors="coerce")
    else:
        n = len(selected)
        if n == 1:
            selected["Score"] = 100
        else:
            selected["Score"] = (
                ((n - selected["Rank"]) / (n - 1)) * 100
            ).round(0)

    if notes_col is not None:
        selected["Notes"] = selected[notes_col].astype(str)
    else:
        selected["Notes"] = "Quality Factor"

    selected["Rank"] = selected["Rank"].fillna(selected["__input_order"] + 1).astype(int)
    selected["Score"] = selected["Score"].fillna(0).astype(int)

    missing = selected[selected["Ticker"].isna()]
    if not missing.empty:
        print("Warning: some quality names/symbols could not be matched:")
        display_col = company_col or symbol_col or ticker_col
        print(missing[[display_col]].to_string(index=False))

    selected = selected.dropna(subset=["Ticker"]).copy()

    if selected.empty:
        raise RuntimeError("No quality stocks could be matched to the universe file.")

    return selected


def build_quality_output(
    selected: pd.DataFrame,
    close: pd.DataFrame,
    asof_date: str,
) -> pd.DataFrame:
    tickers = [ticker for ticker in selected["Ticker"].tolist() if ticker in close.columns]

    if not tickers:
        raise RuntimeError("No matched quality tickers found in close_prices_wide.csv.")

    close_subset = close[tickers].copy()

    metrics = pd.concat(
        [
            latest_return(close_subset, TRADING_DAYS_1W).rename("ret_1w"),
            latest_return(close_subset, TRADING_DAYS_1M).rename("ret_1m"),
            latest_return(close_subset, TRADING_DAYS_3M).rename("ret_3m"),
            latest_return(close_subset, TRADING_DAYS_6M).rename("ret_6m"),
            latest_vol_6m(close_subset).rename("vol_6m"),
        ],
        axis=1,
    ).dropna(how="any")

    metrics.index.name = "Ticker"
    metrics = metrics.reset_index()

    merged = selected.merge(metrics, on="Ticker", how="inner").copy()
    merged = merged.sort_values("Rank").reset_index(drop=True)

    if merged.empty:
        raise RuntimeError("No quality stocks had enough price history for return/volatility calculation.")

    out = pd.DataFrame(
        {
            "Date": [asof_date] * len(merged),
            "Rank": merged["Rank"].astype(int),
            "Symbol": merged["NSE Symbol"].astype(str),
            "Sector": merged["Sector"].fillna("Unknown").astype(str),
            "Score": merged["Score"].astype(int),
            "1W Return": (merged["ret_1w"] * 100).round(2),
            "1M Return": (merged["ret_1m"] * 100).round(2),
            "3M Return": (merged["ret_3m"] * 100).round(2),
            "6M Return": (merged["ret_6m"] * 100).round(2),
            "6M Volatility": (merged["vol_6m"] * 100).round(2),
            "Volatility Bucket": merged["vol_6m"].astype(float).map(vol_label),
            "Notes": merged["Notes"].fillna("Quality Factor").astype(str),
        }
    )

    return out


def main() -> None:
    print("=" * 80)
    print("STARTING QUALITY UPDATE FROM STORED CLOSE DATA")
    print("=" * 80)

    backend_dir = Path(__file__).resolve().parents[1]
    data_dir = backend_dir / "data"

    universe_path = data_dir / "yahoo_finance_ticker_universe_with_sector_business_model.xlsx"
    close_prices_path = data_dir / "close_prices_wide.csv"
    quality_input_path = data_dir / "quality_input.csv"
    output_csv_path = data_dir / "quality_latest.csv"

    start_date = "2000-01-01"
    end_date = None

    universe_meta = load_universe_metadata(universe_path)
    print(f"Universe rows loaded: {len(universe_meta)}")

    selected = load_quality_input(quality_input_path, universe_meta)
    print(f"Quality input rows matched: {len(selected)}")

    close = load_close_prices_from_csv(
        close_prices_path=close_prices_path,
        universe_meta=universe_meta,
        start=start_date,
        end=end_date,
    )
    print(f"Close matrix shape: {close.shape}")

    asof_date = close.index.max().strftime("%Y-%m-%d")

    quality_ui = build_quality_output(
        selected=selected,
        close=close,
        asof_date=asof_date,
    )

    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    quality_ui.to_csv(output_csv_path, index=False)

    print("-" * 80)
    print(f"As-of date: {asof_date}")
    print(f"Rows exported: {len(quality_ui)}")
    print(f"Output written to: {output_csv_path}")
    print("-" * 80)
    print(quality_ui.head(10).to_string(index=False))
    print("=" * 80)
    print("QUALITY UPDATE COMPLETED SUCCESSFULLY")
    print("=" * 80)


if __name__ == "__main__":
    main()
