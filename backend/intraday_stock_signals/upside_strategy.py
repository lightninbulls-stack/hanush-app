from __future__ import annotations

import os
import traceback

import pandas as pd
from kiteconnect import KiteConnect

from .config import UPSIDE_CONFIG
from .data_loader import resolve_instrument_file
from .publisher import publish_strategy_state
from .strategy_runner import IntradayStockSignalRunner
from .utils import (
    build_log_and_print,
    is_after_market_close_ist,
    is_weekday_ist,
    load_creds,
    setup_logger,
    wait_until_market_open,
)


def _find_symbol_column(df: pd.DataFrame) -> str:
    candidates = [
        "symbol",
        "Symbol",
        "stock",
        "Stock",
        "tradingsymbol",
        "TradingSymbol",
        "ticker",
        "Ticker",
    ]

    for col in candidates:
        if col in df.columns:
            return col

    raise ValueError(
        f"Could not find symbol column in regime file. Available columns={df.columns.tolist()}"
    )


def build_signal_universe_with_debug(
    *,
    regime_file_path: str,
    instrument_file_path: str,
    log_and_print,
) -> pd.DataFrame:
    log_and_print(f"US 2: regime_file_path={regime_file_path}")
    log_and_print(f"US 3: instrument_file_path={instrument_file_path}")

    if not os.path.exists(regime_file_path):
        raise FileNotFoundError(f"Regime upside file not found: {regime_file_path}")

    if not os.path.exists(instrument_file_path):
        raise FileNotFoundError(f"Zerodha instrument file not found: {instrument_file_path}")

    regime_df = pd.read_csv(regime_file_path)
    log_and_print(f"US 4: regime file loaded rows={len(regime_df)} cols={regime_df.columns.tolist()}")

    symbol_col = _find_symbol_column(regime_df)
    log_and_print(f"US 5: regime symbol column detected={symbol_col}")

    regime_symbols = (
        regime_df[symbol_col]
        .dropna()
        .astype(str)
        .str.strip()
        .str.upper()
        .unique()
        .tolist()
    )

    log_and_print(f"US 6: regime symbols count={len(regime_symbols)}")
    log_and_print(f"US 6 SAMPLE: regime symbols first_10={regime_symbols[:10]}")

    if not regime_symbols:
        raise ValueError(f"No symbols found inside regime file: {regime_file_path}")

    inst_df = pd.read_csv(instrument_file_path)
    log_and_print(f"US 7: instrument file loaded rows={len(inst_df)} cols={inst_df.columns.tolist()}")

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

    log_and_print(f"US 8: NSE EQ filtered rows={len(equity_df)}")

    if equity_df.empty:
        raise ValueError(
            f"No NSE cash equity rows found in instrument file: {instrument_file_path}"
        )

    matched_df = equity_df[equity_df["tradingsymbol"].isin(regime_symbols)].copy()

    log_and_print(f"US 9: matched stocks count={len(matched_df)}")

    if matched_df.empty:
        available_sample = equity_df["tradingsymbol"].head(20).tolist()
        missing_sample = regime_symbols[:20]

        log_and_print(f"US 9 FAIL: sample regime symbols={missing_sample}", "error")
        log_and_print(f"US 9 FAIL: sample NSE EQ symbols={available_sample}", "error")

        raise ValueError(
            "No matching symbols found after filtering exchange='NSE', "
            "segment='NSE', instrument_type='EQ'."
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

    matched_sample = matched_df[["symbol", "instrument_token", "name"]].head(20).to_dict("records")
    log_and_print(f"US 10: matched sample={matched_sample}")

    return matched_df


def main() -> None:
    strategy_name = UPSIDE_CONFIG["strategy_name"]
    side = UPSIDE_CONFIG["side"]
    regime_file_path = UPSIDE_CONFIG["regime_file_path"]
    fast_span = UPSIDE_CONFIG["fast_span"]
    slow_span = UPSIDE_CONFIG["slow_span"]
    log_file_name = UPSIDE_CONFIG["log_file_name"]

    logger = setup_logger("lightnin_bull_upside_intraday_signal", log_file_name)
    log_and_print = build_log_and_print(logger)

    log_and_print("US 1: Upside strategy main() entered")

    publish_strategy_state(
        strategy_name=strategy_name,
        ui_state="BOOTING",
        message="Upside strategy process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    if not is_weekday_ist():
        log_and_print("US STOP: outside weekday")
        publish_strategy_state(
            strategy_name=strategy_name,
            ui_state="STOPPED",
            message="Upside strategy inactive outside working days.",
            is_loading=False,
        )
        return

    wait_until_market_open(
        lambda **kwargs: publish_strategy_state(strategy_name=strategy_name, **kwargs)
    )

    try:
        log_and_print("US 11: loading Kite credentials")
        cred = load_creds()
        log_and_print("US 12: credentials loaded")

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("US 13: Kite authenticated successfully")

        instrument_file_path = resolve_instrument_file()
        log_and_print(f"US 14: resolved instrument file={instrument_file_path}")

        regime_tokens_df = build_signal_universe_with_debug(
            regime_file_path=regime_file_path,
            instrument_file_path=instrument_file_path,
            log_and_print=log_and_print,
        )

        log_and_print(
            f"US 15: Matched {len(regime_tokens_df)} upside regime stocks with NSE cash tokens."
        )

        if regime_tokens_df.empty:
            raise ValueError("US 15 FAIL: regime_tokens_df is empty after matching")

        tokens = regime_tokens_df["instrument_token"].dropna().astype(int).tolist()
        log_and_print(f"US 16: token count={len(tokens)} token_sample={tokens[:20]}")

        if not tokens:
            raise ValueError("US 16 FAIL: No instrument tokens available for websocket subscription")

        publish_strategy_state(
            strategy_name=strategy_name,
            ui_state="RUNNING",
            message="Upside stock signal strategy running. Building live EMA signals.",
            progress_text=f"Matched {len(regime_tokens_df)} stocks",
            is_loading=True,
            extra={
                "total_count": int(len(regime_tokens_df)),
                "entered_count": 0,
                "signals": [],
            },
        )

        log_and_print("US 17: creating IntradayStockSignalRunner")

        engine = IntradayStockSignalRunner(
            kite=kite,
            cred=cred,
            regime_tokens_df=regime_tokens_df,
            strategy_name=strategy_name,
            side=side,
            fast_span=fast_span,
            slow_span=slow_span,
            log_and_print=log_and_print,
            is_after_market_close_fn=is_after_market_close_ist,
        )

        log_and_print("US 18: starting IntradayStockSignalRunner websocket")
        engine.start()
        log_and_print("US 19: Upside intraday stock signal engine started successfully")

    except SystemExit:
        log_and_print("US EXIT: Upside strategy exited after execution")
        publish_strategy_state(
            strategy_name=strategy_name,
            ui_state="STOPPED",
            message="Upside strategy stopped manually.",
            is_loading=False,
        )

    except Exception as exc:
        log_and_print(f"US ERROR: Upside strategy failed: {exc}", "error")
        log_and_print(traceback.format_exc(), "error")
        publish_strategy_state(
            strategy_name=strategy_name,
            ui_state="ERROR",
            message=f"Upside strategy failed: {str(exc)}",
            progress_text="Check logs",
            is_loading=False,
        )


if __name__ == "__main__":
    main()
