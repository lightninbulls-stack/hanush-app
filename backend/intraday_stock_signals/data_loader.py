from __future__ import annotations

import os
from typing import Iterable
import pandas as pd

from .config import INSTRUMENT_FILE_CANDIDATES


# -------------------------------------------------------
# STEP 1 — Resolve Instrument File (FIXED PATH ISSUE)
# -------------------------------------------------------
def resolve_instrument_file(candidates: Iterable[str] = INSTRUMENT_FILE_CANDIDATES) -> str:
    checked_paths = []

    for path in candidates:
        abs_path = os.path.abspath(path)
        checked_paths.append(abs_path)

        if os.path.exists(abs_path):
            print(f"✅ USING INSTRUMENT FILE: {abs_path}")
            return abs_path

    raise FileNotFoundError(
        f"No kite instrument file found.\nChecked paths:\n{checked_paths}"
    )


# -------------------------------------------------------
# STEP 2 — Find Symbol Column
# -------------------------------------------------------
def _find_symbol_column(df: pd.DataFrame, candidates: list[str]) -> str:
    for col in candidates:
        if col in df.columns:
            return col

    raise ValueError(
        f"Could not find symbol column. Available columns: {df.columns.tolist()}"
    )


# -------------------------------------------------------
# STEP 3 — Load Regime Symbols
# -------------------------------------------------------
def load_regime_symbols(regime_file_path: str) -> list[str]:
    if not os.path.exists(regime_file_path):
        raise FileNotFoundError(f"Regime file not found: {regime_file_path}")

    regime_df = pd.read_csv(regime_file_path)

    symbol_col = _find_symbol_column(
        regime_df,
        [
            "symbol",
            "Symbol",
            "stock",
            "Stock",
            "tradingsymbol",
            "TradingSymbol",
            "ticker",
            "Ticker",
        ],
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

    print(f"✅ REGIME SYMBOLS COUNT: {len(regime_symbols)}")

    if not regime_symbols:
        raise ValueError(f"No symbols found in regime file: {regime_file_path}")

    return regime_symbols


# -------------------------------------------------------
# STEP 4 — Load Instruments (FIXED EQ FALLBACK)
# -------------------------------------------------------
def load_equity_instruments(instrument_file_path: str) -> pd.DataFrame:
    if not os.path.exists(instrument_file_path):
        raise FileNotFoundError(f"Instrument file not found: {instrument_file_path}")

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

    # Normalize
    inst_df["tradingsymbol"] = inst_df["tradingsymbol"].astype(str).str.strip().str.upper()
    inst_df["exchange"] = inst_df["exchange"].astype(str).str.strip().str.upper()
    inst_df["segment"] = inst_df["segment"].astype(str).str.strip().str.upper()
    inst_df["instrument_type"] = inst_df["instrument_type"].astype(str).str.strip().str.upper()

    # Try EQ first
    equity_df = inst_df[
        (inst_df["exchange"] == "NSE")
        & (inst_df["segment"] == "NSE")
        & (inst_df["instrument_type"] == "EQ")
    ].copy()

    # 🔥 FIX: fallback if EQ missing
    if equity_df.empty:
        print("⚠️ No EQ found — fallback to ALL NSE rows")
        equity_df = inst_df[inst_df["exchange"] == "NSE"].copy()

    print(f"✅ INSTRUMENT ROWS USED: {len(equity_df)}")

    return equity_df


# -------------------------------------------------------
# STEP 5 — Build Signal Universe (FIXED MATCHING)
# -------------------------------------------------------
def build_signal_universe(
    regime_file_path: str,
    instrument_file_path: str | None = None,
) -> pd.DataFrame:

    instrument_path = instrument_file_path or resolve_instrument_file()

    regime_symbols = load_regime_symbols(regime_file_path)
    equity_df = load_equity_instruments(instrument_path)

    # 🔥 CRITICAL FIX — normalize again
    equity_df["tradingsymbol"] = equity_df["tradingsymbol"].str.strip().str.upper()
    regime_symbols = [s.strip().upper() for s in regime_symbols]

    matched_df = equity_df[
        equity_df["tradingsymbol"].isin(regime_symbols)
    ].copy()

    print(f"✅ EXACT MATCH COUNT: {len(matched_df)}")

    # 🔥 FALLBACK MATCH (handles hidden mismatches)
    if matched_df.empty:
        print("❌ EXACT MATCH FAILED")
        print("Sample regime:", regime_symbols[:10])
        print("Sample instruments:", equity_df["tradingsymbol"].head(10).tolist())

        matched_df = equity_df[
            equity_df["tradingsymbol"].apply(
                lambda x: any(sym in x for sym in regime_symbols)
            )
        ].copy()

        print(f"⚠️ PARTIAL MATCH COUNT: {len(matched_df)}")

    if matched_df.empty:
        raise ValueError("No matching symbols found even after fallback.")

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

    print("✅ FINAL SIGNAL UNIVERSE READY")

    return matched_df
