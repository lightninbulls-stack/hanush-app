from __future__ import annotations

import os
from typing import Iterable

import pandas as pd

from .config import INSTRUMENT_FILE_CANDIDATES


def resolve_instrument_file(candidates: Iterable[str] = INSTRUMENT_FILE_CANDIDATES) -> str:
    for path in candidates:
        if os.path.exists(path):
            return path

    raise FileNotFoundError(
        f"No Zerodha instrument file found. Checked: {list(candidates)}"
    )


def _find_symbol_column(df: pd.DataFrame, candidates: list[str]) -> str:
    col = next((c for c in candidates if c in df.columns), None)
    if col is None:
        raise ValueError(f"Could not find symbol column. Available columns: {df.columns.tolist()}")
    return col


def load_regime_symbols(regime_file_path: str) -> list[str]:
    regime_df = pd.read_csv(regime_file_path)

    symbol_col = _find_symbol_column(
        regime_df,
        ["symbol", "Symbol", "stock", "Stock", "tradingsymbol", "TradingSymbol", "ticker", "Ticker"],
    )

    regime_symbols = (
        regime_df[symbol_col]
        .astype(str)
        .str.strip()
        .str.upper()
        .dropna()
        .unique()
        .tolist()
    )

    if not regime_symbols:
        raise ValueError(f"No symbols found in regime file: {regime_file_path}")

    return regime_symbols


def load_equity_instruments(instrument_file_path: str) -> pd.DataFrame:
    inst_df = pd.read_csv(instrument_file_path)

    required_cols = [
        "instrument_token",
        "exchange_token",
        "tradingsymbol",
        "name",
        "instrument_type",
        "segment",
        "exchange",
    ]
    missing_cols = [col for col in required_cols if col not in inst_df.columns]
    if missing_cols:
        raise ValueError(
            f"Missing columns in Zerodha instrument file {instrument_file_path}: {missing_cols}"
        )

    inst_df["tradingsymbol"] = inst_df["tradingsymbol"].astype(str).str.strip().str.upper()
    inst_df["exchange"] = inst_df["exchange"].astype(str).str.strip().str.upper()
    inst_df["segment"] = inst_df["segment"].astype(str).str.strip().str.upper()
    inst_df["instrument_type"] = inst_df["instrument_type"].astype(str).str.strip().str.upper()

    equity_df = inst_df[
        (inst_df["exchange"] == "NSE")
        & (inst_df["segment"] == "NSE")
        & (inst_df["instrument_type"] == "EQ")
    ].copy()

    if equity_df.empty:
        raise ValueError(
            f"No NSE cash equity rows found in instrument file: {instrument_file_path}"
        )

    return equity_df


def build_signal_universe(regime_file_path: str, instrument_file_path: str | None = None) -> pd.DataFrame:
    instrument_path = instrument_file_path or resolve_instrument_file()

    regime_symbols = load_regime_symbols(regime_file_path)
    equity_df = load_equity_instruments(instrument_path)

    matched_df = equity_df[equity_df["tradingsymbol"].isin(regime_symbols)].copy()

    if matched_df.empty:
        raise ValueError(
            "No matching symbols found after filtering exchange='NSE', segment='NSE', instrument_type='EQ'."
        )

    matched_df = matched_df[
        [
            "instrument_token",
            "exchange_token",
            "tradingsymbol",
            "name",
            "instrument_type",
            "segment",
            "exchange",
        ]
    ].drop_duplicates(subset=["tradingsymbol"]).reset_index(drop=True)

    matched_df = matched_df.rename(columns={"tradingsymbol": "symbol"})
    return matched_df
