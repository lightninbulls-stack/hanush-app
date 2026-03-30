from __future__ import annotations

import os
from pathlib import Path

from factors import (
    build_snapshot,
    build_topn_ui_table,
    load_close_prices_from_csv,
    load_universe_metadata,
    rank_snapshot,
)


def _pick_first_existing(*paths: Path) -> Path:
    for path in paths:
        if path.exists():
            return path
    raise FileNotFoundError(
        "None of the expected files were found:\n"
        + "\n".join(str(path) for path in paths)
    )


def main() -> None:
    print("=" * 80)
    print("STARTING MOMENTUM UPDATE FROM STORED CLOSE DATA")
    print("=" * 80)

    backend_dir = Path(__file__).resolve().parents[1]
    data_dir = backend_dir / "data"

    universe_path = Path(
        os.getenv(
            "MOMENTUM_UNIVERSE_PATH",
            str(
                _pick_first_existing(
                    data_dir / "yahoo_finance_ticker_universe_with_sector_business_model.xlsx",
                    data_dir / "ticker_universe.xlsx",
                    data_dir / "universe.xlsx",
                    data_dir / "Yahoo_Ticker_Map.xlsx",
                )
            ),
        )
    )

    close_prices_path = Path(
        os.getenv(
            "MOMENTUM_CLOSE_PATH",
            str(data_dir / "close_prices_wide.csv"),
        )
    )

    output_csv_path = Path(
        os.getenv(
            "MOMENTUM_OUTPUT_CSV",
            str(data_dir / "momentum_top_stocks.csv"),
        )
    )

    top_n = int(os.getenv("MOMENTUM_TOP_N", "20"))
    start_date = os.getenv("MOMENTUM_START_DATE", "2000-01-01")
    end_date = os.getenv("MOMENTUM_END_DATE")

    universe_meta = load_universe_metadata(universe_path)
    print(f"Universe rows loaded: {len(universe_meta)}")

    close = load_close_prices_from_csv(
        close_prices_path=close_prices_path,
        universe_meta=universe_meta,
        start=start_date,
        end=end_date,
    )
    print(f"Close matrix shape: {close.shape}")

    monthly = close.resample("ME").last()
    print(f"Monthly matrix shape: {monthly.shape}")

    # IMPORTANT:
    # pass DAILY close data, not monthly data
    snapshot = build_snapshot(close)
    print(f"Snapshot shape: {snapshot.shape}")

    ranked = rank_snapshot(snapshot, key="mom_6_1")
    print(f"Ranked matrix shape: {ranked.shape}")

    asof_date = close.index.max().strftime("%Y-%m-%d")

    ui_table = build_topn_ui_table(
        ranked=ranked,
        universe_meta=universe_meta,
        asof_date=asof_date,
        top_n=top_n,
    )

    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    ui_table.to_csv(output_csv_path, index=False)

    print("-" * 80)
    print(f"As-of date: {asof_date}")
    print(f"Top rows exported: {len(ui_table)}")
    print(f"Output written to: {output_csv_path}")
    print("-" * 80)
    print(ui_table.head(10).to_string(index=False))
    print("=" * 80)
    print("MOMENTUM UPDATE COMPLETED SUCCESSFULLY")
    print("=" * 80)


if __name__ == "__main__":
    main()
