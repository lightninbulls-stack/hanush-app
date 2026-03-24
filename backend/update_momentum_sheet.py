from __future__ import annotations

from pathlib import Path
from typing import List

import pandas as pd

from factors import (
    download_close_prices,
    build_snapshot,
    rank_snapshot,
    build_topn_ui_table,
)

BASE_DIR = Path(__file__).resolve().parents[1]

UNIVERSE_PATH = BASE_DIR / "data" / "momentum_universe.csv"
SECTOR_MAP_PATH = BASE_DIR / "data" / "sector_map.csv"
EXCEL_PATH = BASE_DIR / "data" / "trading_bull.xlsx"

OUTPUT_SHEET = "Momentum"
START_DATE = "2018-01-01"
TOP_N = 20


def load_universe(path: Path) -> List[str]:
    df = pd.read_csv(path)
    if "Ticker" not in df.columns:
        raise ValueError(f"'Ticker' column not found in {path}")

    tickers = (
        df["Ticker"]
        .dropna()
        .astype(str)
        .str.strip()
        .tolist()
    )

    tickers = [t if "." in t else f"{t}.NS" for t in tickers]
    tickers = sorted(set(tickers))

    if not tickers:
        raise ValueError("Universe is empty.")

    return tickers


def load_sector_map(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)

    required_cols = {"Ticker", "Sector"}
    if not required_cols.issubset(df.columns):
        raise ValueError(f"{path} must contain columns: {required_cols}")

    out = df.copy()
    out["Ticker"] = out["Ticker"].astype(str).str.strip()
    out["Ticker"] = out["Ticker"].apply(lambda x: x if "." in x else f"{x}.NS")
    out["Sector"] = out["Sector"].astype(str).str.strip()

    return out[["Ticker", "Sector"]].drop_duplicates()


def write_sheet(output_df: pd.DataFrame, excel_path: Path, sheet_name: str) -> None:
    excel_path.parent.mkdir(parents=True, exist_ok=True)

    if excel_path.exists():
        with pd.ExcelWriter(
            excel_path,
            engine="openpyxl",
            mode="a",
            if_sheet_exists="replace",
        ) as writer:
            output_df.to_excel(writer, sheet_name=sheet_name, index=False)
    else:
        with pd.ExcelWriter(excel_path, engine="openpyxl", mode="w") as writer:
            output_df.to_excel(writer, sheet_name=sheet_name, index=False)


def main() -> None:
    tickers = load_universe(UNIVERSE_PATH)
    sector_map = load_sector_map(SECTOR_MAP_PATH)

    close = download_close_prices(
        tickers=tickers,
        start=START_DATE,
        end=None,
    )

    monthly = close.resample("ME").last()

    snapshot = build_snapshot(monthly)
    ranked = rank_snapshot(snapshot, key="mom_6_1")

    asof_date = close.index.max().strftime("%Y-%m-%d")

    ui_table = build_topn_ui_table(
        ranked=ranked,
        sector_map=sector_map,
        asof_date=asof_date,
        top_n=TOP_N,
    )

    write_sheet(
        output_df=ui_table,
        excel_path=EXCEL_PATH,
        sheet_name=OUTPUT_SHEET,
    )

    print(f"Momentum sheet updated successfully for {asof_date}")
    print(ui_table.head(10).to_string(index=False))


if __name__ == "__main__":
    main()
