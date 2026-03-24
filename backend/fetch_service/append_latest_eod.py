from __future__ import annotations

from pathlib import Path
from typing import List
import time

import pandas as pd
import yfinance as yf


# ============================================================
# CONFIG - RENDER / REPO RELATIVE PATHS
# ============================================================
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_DIR = BACKEND_DIR / "data"

CLOSE_WIDE_FILE = DATA_DIR / "close_prices_wide.csv"
UNIVERSE_FILE = DATA_DIR / "yahoo_finance_ticker_universe_with_sector_business_model.xlsx"
INPUT_SHEET = "Yahoo_Ticker_Map"

LOG_DIR = DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

FAILED_FILE = LOG_DIR / "daily_update_failed_tickers.csv"

BATCH_SIZE = 50
SLEEP_BETWEEN_BATCHES = 1.0
LOOKBACK_DAYS = 10


# ============================================================
# HELPERS
# ============================================================
def chunk_list(items: List[str], chunk_size: int) -> List[List[str]]:
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]


def load_existing_close_wide(file_path: Path) -> pd.DataFrame:
    if not file_path.exists():
        raise FileNotFoundError(
            f"{file_path} not found. Upload backend/data/close_prices_wide.csv first."
        )

    df = pd.read_csv(file_path, index_col=0)
    if df.empty:
        raise ValueError(f"{file_path} exists but is empty.")

    df.index = pd.to_datetime(df.index, errors="coerce").normalize()
    df = df[~df.index.isna()].copy()

    df.columns = [str(col).strip() for col in df.columns]
    df = df.sort_index()
    return df


def load_tickers_from_existing_wide(existing_df: pd.DataFrame) -> List[str]:
    tickers = [str(col).strip() for col in existing_df.columns if str(col).strip()]
    if not tickers:
        raise ValueError("No ticker columns found in close_prices_wide.csv")
    return tickers


def load_tickers_from_excel(file_path: Path, sheet_name: str) -> List[str]:
    df = pd.read_excel(file_path, sheet_name=sheet_name)

    required_col = "Yahoo Finance Ticker"
    if required_col not in df.columns:
        raise ValueError(f"Column 'Yahoo Finance Ticker' not found in {file_path}")

    tickers = (
        df[required_col]
        .dropna()
        .astype(str)
        .str.strip()
        .unique()
        .tolist()
    )

    if not tickers:
        raise ValueError("No tickers found in Excel file.")

    return tickers


def resolve_tickers(existing_df: pd.DataFrame) -> List[str]:
    # Preferred: use current close_prices_wide.csv columns
    tickers = load_tickers_from_existing_wide(existing_df)

    # Optional sanity fallback: if wide file is weird, try the universe file
    if not tickers and UNIVERSE_FILE.exists():
        tickers = load_tickers_from_excel(UNIVERSE_FILE, INPUT_SHEET)

    return tickers


def download_recent_close_batch(tickers: List[str], start_date: pd.Timestamp) -> pd.DataFrame:
    try:
        raw = yf.download(
            tickers=tickers,
            start=start_date.strftime("%Y-%m-%d"),
            interval="1d",
            auto_adjust=False,
            progress=False,
            group_by="column",
            threads=True,
        )

        if raw.empty:
            return pd.DataFrame()

        if isinstance(raw.columns, pd.MultiIndex):
            if "Close" not in raw.columns.get_level_values(0):
                return pd.DataFrame()

            close_df = raw["Close"].copy()

        else:
            # single ticker fallback
            if "Close" not in raw.columns:
                return pd.DataFrame()

            close_df = raw[["Close"]].copy()
            close_df.columns = [tickers[0]]

        close_df.index = pd.to_datetime(close_df.index, errors="coerce").normalize()
        close_df = close_df[~close_df.index.isna()].copy()

        close_df.columns = [str(col).strip() for col in close_df.columns]
        close_df = close_df.sort_index()

        return close_df

    except Exception as exc:
        print(f"Batch failed for {tickers[:3]} | Error: {exc}", flush=True)
        return pd.DataFrame()


# ============================================================
# MAIN
# ============================================================
def main() -> None:
    total_start = time.time()

    print("=" * 80, flush=True)
    print("STARTING DAILY CLOSE APPEND UPDATE", flush=True)
    print("=" * 80, flush=True)

    existing_df = load_existing_close_wide(CLOSE_WIDE_FILE)
    tickers = resolve_tickers(existing_df)

    last_saved_date = existing_df.index.max()

    print(f"Close file path: {CLOSE_WIDE_FILE}", flush=True)
    print(f"Existing shape: {existing_df.shape}", flush=True)
    print(f"Ticker count: {len(tickers)}", flush=True)
    print(f"Last saved date: {last_saved_date.date()}", flush=True)

    fetch_start = last_saved_date - pd.Timedelta(days=LOOKBACK_DAYS)
    print(f"Fetching Yahoo data from: {fetch_start.date()}", flush=True)

    batches = chunk_list(tickers, BATCH_SIZE)
    total_batches = len(batches)

    batch_frames = []
    failed_tickers = []

    for idx, batch in enumerate(batches, start=1):
        batch_start = time.time()

        print(f"\n[Batch {idx}/{total_batches}] Starting | Size: {len(batch)}", flush=True)
        print(f"[Batch {idx}/{total_batches}] First few tickers: {batch[:5]}", flush=True)

        close_batch = download_recent_close_batch(batch, fetch_start)

        if close_batch.empty:
            failed_tickers.extend(batch)
            print(f"[Batch {idx}/{total_batches}] No data returned.", flush=True)
        else:
            returned_tickers = set(close_batch.columns.tolist())
            missing = [t for t in batch if t not in returned_tickers]
            failed_tickers.extend(missing)

            print(f"[Batch {idx}/{total_batches}] Returned tickers: {len(returned_tickers)}", flush=True)
            print(f"[Batch {idx}/{total_batches}] Batch shape: {close_batch.shape}", flush=True)

            batch_frames.append(close_batch)

        print(
            f"[Batch {idx}/{total_batches}] Time taken: {time.time() - batch_start:.2f} sec",
            flush=True,
        )

        if idx < total_batches:
            time.sleep(SLEEP_BETWEEN_BATCHES)

    if not batch_frames:
        raise RuntimeError("No batch data received from Yahoo.")

    print("\nCombining all batch close data...", flush=True)

    recent_close = pd.concat(batch_frames, axis=1)
    recent_close = recent_close.loc[:, ~recent_close.columns.duplicated()].copy()
    recent_close = recent_close.sort_index()

    # keep only the existing universe/order
    recent_close = recent_close.reindex(columns=tickers)

    # keep only new dates
    new_rows = recent_close[recent_close.index > last_saved_date].copy()

    if new_rows.empty:
        print("\nNo new trading date available yet. Nothing appended.", flush=True)
        print("=" * 80, flush=True)

        failed_df = pd.DataFrame({"Ticker": sorted(set(failed_tickers))})
        failed_df.to_csv(FAILED_FILE, index=False)
        return

    print(f"New rows found: {len(new_rows)}", flush=True)
    print(f"New dates: {[d.date() for d in new_rows.index]}", flush=True)

    combined = pd.concat([existing_df, new_rows], axis=0)
    combined = combined[~combined.index.duplicated(keep="last")].copy()
    combined = combined.sort_index()
    combined = combined.reindex(columns=tickers)

    combined.to_csv(CLOSE_WIDE_FILE, index_label="Date")

    failed_df = pd.DataFrame({"Ticker": sorted(set(failed_tickers))})
    failed_df.to_csv(FAILED_FILE, index=False)

    print(f"Updated close file saved to: {CLOSE_WIDE_FILE}", flush=True)
    print(f"Updated shape: {combined.shape}", flush=True)
    print(f"Failed ticker log saved to: {FAILED_FILE}", flush=True)
    print(f"Total runtime: {time.time() - total_start:.2f} sec", flush=True)
    print("=" * 80, flush=True)


if __name__ == "__main__":
    main()
