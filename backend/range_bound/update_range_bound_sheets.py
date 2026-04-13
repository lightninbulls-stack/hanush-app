from __future__ import annotations

import os
from pathlib import Path

from factors import (
    build_range_bound_snapshot,
    build_topn_ui_table,
    load_close_prices_from_csv,
    load_universe_metadata,
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
    print("STARTING RANGE BOUND UPDATE")
    print("=" * 80)

    backend_dir = Path(__file__).resolve().parents[1]
    data_dir = backend_dir / "data"

    universe_path = Path(
        os.getenv(
            "RANGE_BOUND_UNIVERSE_PATH",
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
            "RANGE_BOUND_CLOSE_PATH",
            str(data_dir / "close_prices_wide.csv"),
        )
    )

    output_snapshot_csv = Path(
        os.getenv(
            "RANGE_BOUND_SNAPSHOT_CSV",
            str(data_dir / "range_bound_snapshot.csv"),
        )
    )

    output_upside_csv = Path(
        os.getenv(
            "RANGE_BOUND_UPSIDE_OUTPUT_CSV",
            str(data_dir / "range_bound_upside_latest.csv"),
        )
    )

    output_downside_csv = Path(
        os.getenv(
            "RANGE_BOUND_DOWNSIDE_OUTPUT_CSV",
            str(data_dir / "range_bound_downside_latest.csv"),
        )
    )

    top_n = int(os.getenv("RANGE_BOUND_TOP_N", "20"))
    z_threshold = float(os.getenv("RANGE_BOUND_Z_THRESHOLD", "1.5"))
    start_date = os.getenv("RANGE_BOUND_START_DATE", "2000-01-01")
    end_date = os.getenv("RANGE_BOUND_END_DATE")

    universe_meta = load_universe_metadata(universe_path)
    print(f"Universe rows loaded: {len(universe_meta)}")

    close = load_close_prices_from_csv(
        close_prices_path=close_prices_path,
        universe_meta=universe_meta,
        start=start_date,
        end=end_date,
    )
    print(f"Close matrix shape: {close.shape}")

    snapshot = build_range_bound_snapshot(close)
    print(f"Snapshot shape: {snapshot.shape}")

    asof_date = close.index.max().strftime("%Y-%m-%d")

    upside_ui = build_topn_ui_table(
        snapshot=snapshot,
        universe_meta=universe_meta,
        signal_type="Upside",
        asof_date=asof_date,
        top_n=top_n,
        z_threshold=z_threshold,
    )

    downside_ui = build_topn_ui_table(
        snapshot=snapshot,
        universe_meta=universe_meta,
        signal_type="Downside",
        asof_date=asof_date,
        top_n=top_n,
        z_threshold=z_threshold,
    )

    output_snapshot_csv.parent.mkdir(parents=True, exist_ok=True)
    snapshot.reset_index().to_csv(output_snapshot_csv, index=False)
    upside_ui.to_csv(output_upside_csv, index=False)
    downside_ui.to_csv(output_downside_csv, index=False)

    print("-" * 80)
    print(f"As-of date: {asof_date}")
    print(f"Upside rows exported: {len(upside_ui)}")
    print(f"Downside rows exported: {len(downside_ui)}")
    print(f"Snapshot written to: {output_snapshot_csv}")
    print(f"Upside CSV written to: {output_upside_csv}")
    print(f"Downside CSV written to: {output_downside_csv}")
    print("-" * 80)

    print("=" * 80)
    print("RANGE BOUND UPDATE COMPLETED SUCCESSFULLY")
    print("=" * 80)


if __name__ == "__main__":
    main()
