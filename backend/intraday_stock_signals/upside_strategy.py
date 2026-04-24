from __future__ import annotations

import time
from datetime import datetime

from kiteconnect import KiteConnect

from .config import UPSIDE_CONFIG
from .data_loader import build_signal_universe
from .ema_engine import update_ema, is_bullish
from .publisher import publish_strategy_state
from .utils import load_creds, setup_logger


STRATEGY_NAME = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"


def run_upside_strategy(kite: KiteConnect, universe_df, logger) -> None:
    logger.info("US RUN 1: Upside Strategy Started")

    active_signals: dict[str, dict] = {}
    max_ltp_tracker: dict[str, float] = {}

    while True:
        now = datetime.now()

        if now.hour > 15 or (now.hour == 15 and now.minute >= 30):
            logger.info("US RUN STOP: Market closed — stopping upside strategy")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                ui_state="STOPPED",
                message="Market closed. Upside stock signal stopped.",
                progress_text="Stopped after 3:30 PM",
                is_loading=False,
                extra={
                    "signals": [],
                    "entered_count": len(active_signals),
                    "total_count": int(len(universe_df)),
                },
            )
            break

        signals_output = []

        for _, row in universe_df.iterrows():
            symbol = str(row["symbol"]).strip().upper()

            try:
                quote_key = f"NSE:{symbol}"
                ltp_data = kite.ltp(quote_key)

                if quote_key not in ltp_data:
                    logger.error("US LTP FAIL: %s missing in ltp response=%s", quote_key, ltp_data)
                    continue

                ltp = float(ltp_data[quote_key]["last_price"])

                ema_fast, ema_slow = update_ema(symbol, ltp)

                logger.info(
                    "US TICK | symbol=%s | ltp=%.2f | ema_fast=%s | ema_slow=%s",
                    symbol,
                    ltp,
                    round(ema_fast, 4) if ema_fast is not None else None,
                    round(ema_slow, 4) if ema_slow is not None else None,
                )

                if ema_fast is None or ema_slow is None:
                    continue

                if is_bullish(symbol):
                    if symbol not in active_signals:
                        logger.info("US SIGNAL ENTERED | %s @ %.2f", symbol, ltp)

                        active_signals[symbol] = {
                            "entry_price": ltp,
                            "entry_time": now.strftime("%H:%M:%S"),
                        }
                        max_ltp_tracker[symbol] = ltp

                    max_ltp_tracker[symbol] = max(max_ltp_tracker[symbol], ltp)

                if symbol in active_signals:
                    entry_price = float(active_signals[symbol]["entry_price"])
                    max_ltp = float(max_ltp_tracker[symbol])

                    signals_output.append(
                        {
                            "symbol": symbol,
                            "instrument_token": int(row["instrument_token"]),
                            "signal_status": "ENTERED",
                            "entry_time": active_signals[symbol]["entry_time"],
                            "avg_price": round(entry_price, 2),
                            "current_ltp": round(ltp, 2),
                            "max_ltp": round(max_ltp, 2),
                            "points_captured": round(max_ltp - entry_price, 2),
                            "pct_captured": round(
                                ((max_ltp - entry_price) / entry_price) * 100, 2
                            )
                            if entry_price
                            else 0.0,
                        }
                    )

            except Exception as exc:
                logger.exception("US STOCK ERROR | symbol=%s | error=%s", symbol, exc)

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="RUNNING",
            message="Live upside stock signal running.",
            progress_text=f"{len(signals_output)} entered out of {len(universe_df)} stocks",
            is_loading=False,
            extra={
                "signals": signals_output,
                "entered_count": len(signals_output),
                "total_count": int(len(universe_df)),
            },
        )

        time.sleep(1)


def main() -> None:
    logger = setup_logger(
        "lightnin_bull_upside_intraday_signal",
        UPSIDE_CONFIG["log_file_name"],
    )

    logger.info("US MAIN 1: LIGHTNIN BULL UPSIDE main() started")

    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        ui_state="BOOTING",
        message="Upside stock signal process started.",
        progress_text="Initializing",
        is_loading=True,
        extra={
            "signals": [],
            "entered_count": 0,
            "total_count": 0,
        },
    )

    try:
        logger.info("US MAIN 2: loading credentials")
        cred = load_creds()
        logger.info("US MAIN 3: credentials loaded")

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        logger.info("US MAIN 4: Kite authenticated")

        logger.info("US MAIN 5: building signal universe")
        universe_df = build_signal_universe(
            regime_file_path=UPSIDE_CONFIG["regime_file_path"],
        )

        logger.info("US MAIN 6: Upside universe loaded: %s stocks", len(universe_df))

        if universe_df.empty:
            raise ValueError("US MAIN FAIL: universe_df is empty")

        logger.info("US MAIN 7: universe columns=%s", universe_df.columns.tolist())
        logger.info(
            "US MAIN 8: universe sample=%s",
            universe_df.head(10).to_dict("records"),
        )

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="RUNNING",
            message="Upside stock signal universe loaded.",
            progress_text=f"Tracking {len(universe_df)} stocks",
            is_loading=False,
            extra={
                "signals": [],
                "entered_count": 0,
                "total_count": int(len(universe_df)),
            },
        )

        logger.info("US MAIN 9: entering run_upside_strategy loop")

        run_upside_strategy(
            kite=kite,
            universe_df=universe_df,
            logger=logger,
        )

    except Exception as exc:
        error_msg = f"Upside strategy failed: {exc}"
        logger.exception("US MAIN ERROR: %s", error_msg)

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="ERROR",
            message=error_msg,
            progress_text="Check Render logs",
            is_loading=False,
            extra={
                "signals": [],
                "entered_count": 0,
                "total_count": 0,
                "error": str(exc),
            },
        )


if __name__ == "__main__":
    main()
