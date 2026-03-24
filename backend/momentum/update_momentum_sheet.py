from __future__ import annotations

from pathlib import Path

import pandas as pd

from factors import (
    load_universe_metadata,
    load_close_prices_from_csv,
    build_snapshot,
    rank_snapshot,
    build_topn_ui_table,
)


BASE_DIR = Path(__file__).resolve().parents[1]

CLOSE_PRICES_PATH = BASE_DIR / "data" / "close_prices_wide.csv"
UNIVERSE_PATH = BASE_DIR / "data" / "yahoo_finance_ticker_universe_with_sector_business_model.xlsx"
EXCEL_PATH = BASE_DIR / "data" / "trading_bull.xlsx"

OUTPUT_SHEET = "Momentum"
START_DATE = "2018-01-01"
TOP_N = 20


def write_sheet(excel_path: Path, sheet_name: str, df: pd.DataFrame) -> None:
    excel_path.parent.mkdir(parents=True, exist_ok=True)

    if excel_path.exists():
        with pd.ExcelWriter(
            excel_path,
            engine="openpyxl",
            mode="a",
            if_sheet_exists="replace",
        ) as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    else:
        with pd.ExcelWriter(excel_path, engine="openpyxl", mode="w") as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)


def main() -> None:
    print("=" * 80, flush=True)
    print("STARTING MOMENTUM UPDATE FROM STORED CLOSE DATA", flush=True)
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

    # Month-end prices
    monthly = close.resample("ME").last().dropna(how="all")
    print(f"Monthly matrix shape: {monthly.shape}", flush=True)

    if len(monthly) < 8:
        raise RuntimeError(
            "Not enough monthly history to compute 6_1 momentum. "
            "Need at least 8 monthly observations."
        )

    snapshot = build_snapshot(monthly)
    print(f"Snapshot rows: {len(snapshot)}", flush=True)

    ranked = rank_snapshot(snapshot, key="mom_6_1")
    asof_date = monthly.index[-1].strftime("%Y-%m-%d")

    topn_ui = build_topn_ui_table(
        ranked=ranked,
        universe_meta=universe_meta,
        asof_date=asof_date,
        top_n=TOP_N,
    )

    print(f"Top {TOP_N} rows prepared: {len(topn_ui)}", flush=True)

    write_sheet(EXCEL_PATH, OUTPUT_SHEET, topn_ui)
    print(f"Momentum sheet updated: {EXCEL_PATH} | Sheet: {OUTPUT_SHEET}", flush=True)

    print("=" * 80, flush=True)
    print("MOMENTUM UPDATE COMPLETE", flush=True)
    print("=" * 80, flush=True)


if __name__ == "__main__":
    main()
