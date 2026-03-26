from __future__ import annotations

from pathlib import Path

try:
    from .factors import (
        load_universe_metadata,
        load_close_prices_from_csv,
        build_snapshot,
        rank_snapshot,
        build_topn_ui_table,
        TRADING_DAYS_6M,
    )
except ImportError:
    from factors import (
        load_universe_metadata,
        load_close_prices_from_csv,
        build_snapshot,
        rank_snapshot,
        build_topn_ui_table,
        TRADING_DAYS_6M,
    )

BASE_DIR = Path(__file__).resolve().parents[1]

CLOSE_PRICES_PATH = BASE_DIR / "data" / "close_prices_wide.csv"
UNIVERSE_PATH = BASE_DIR / "data" / "yahoo_finance_ticker_universe_with_sector_business_model.xlsx"
LOW_VOL_CSV_PATH = BASE_DIR / "data" / "low_vol_latest.csv"

START_DATE = "2018-01-01"
TOP_N = 20


def main() -> None:
    print("=" * 80, flush=True)
    print("STARTING LOW VOL UPDATE FROM STORED CLOSE DATA", flush=True)
    print("=" * 80, flush=True)

    universe_meta = load_universe_metadata(UNIVERSE_PATH)
    print(f"Universe rows loaded: {len(universe_meta)}", flush=True)

    close = load_close_prices_from_csv(
        close_prices_path=CLOSE_PRICES_PATH,
        universe_meta=universe_meta,
        start=START_DATE,
        end=None,
    )
    print(f"Close matrix shape: {close.shape}", flush=True)

    if len(close) < TRADING_DAYS_6M:
        raise RuntimeError(
            f"Not enough daily history to compute 6M realized volatility. "
            f"Need at least {TRADING_DAYS_6M} daily observations."
        )

    snapshot = build_snapshot(close)
    print(f"Snapshot rows: {len(snapshot)}", flush=True)

    ranked = rank_snapshot(snapshot, rank_key="vol_6m", ascending=True)
    asof_date = close.index[-1].strftime("%Y-%m-%d")

    topn_ui = build_topn_ui_table(
        ranked=ranked,
        universe_meta=universe_meta,
        asof_date=asof_date,
        top_n=TOP_N,
    )

    print(f"Top {TOP_N} rows prepared: {len(topn_ui)}", flush=True)

    LOW_VOL_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    topn_ui.to_csv(LOW_VOL_CSV_PATH, index=False)
    print(f"Low Vol CSV updated: {LOW_VOL_CSV_PATH}", flush=True)

    print("=" * 80, flush=True)
    print("LOW VOL UPDATE COMPLETE", flush=True)
    print("=" * 80, flush=True)


if __name__ == "__main__":
    main()
