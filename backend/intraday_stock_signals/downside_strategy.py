from __future__ import annotations

import time
from datetime import datetime

from kiteconnect import KiteConnect

from .config import DOWNSIDE_CONFIG, IST
from .data_loader import build_signal_universe
from .ema_engine import update_sma, is_bearish
from .publisher import publish_strategy_state
from .utils import load_creds, setup_logger


STRATEGY_NAME = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL"
FAST_SMA_SPAN = int(DOWNSIDE_CONFIG.get("fast_span", 500))
SLOW_SMA_SPAN = int(DOWNSIDE_CONFIG.get("slow_span", 1500))


def run_downside_strategy(kite: KiteConnect, universe_df, logger) -> None:
    logger.info("DS RUN 1: Downside Strategy Started | ENGINE=SMA")

    active_signals: dict[str, dict] = {}
    min_ltp_tracker: dict[str, float] = {}

    while True:
        now = datetime.now(IST)

        if now.hour > 15 or (now.hour == 15 and now.minute >= 30):
            logger.info("DS RUN STOP: Market closed — stopping downside strategy")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                ui_state="STOPPED",
                message="Market closed. Downside stock signal stopped.",
                progress_text="Stopped after 3:30 PM IST",
                is_loading=False,
                extra={"signals": [], "entered_count": len(active_signals), "total_count": int(len(universe_df)), "engine": "SMA", "updated_at_ist": now.isoformat()},
            )
            break

        signals_output = []

        for _, row in universe_df.iterrows():
            symbol = str(row["symbol"]).strip().upper()

            try:
                quote_key = f"NSE:{symbol}"
                ltp_data = kite.ltp(quote_key)

                if quote_key not in ltp_data:
                    logger.error("DS LTP FAIL: %s missing in ltp response=%s", quote_key, ltp_data)
                    continue

                ltp = float(ltp_data[quote_key]["last_price"])
                sma_fast, sma_slow = update_sma(symbol=symbol, price=ltp, fast_span=FAST_SMA_SPAN, slow_span=SLOW_SMA_SPAN)

                logger.info(
                    "DS TICK | symbol=%s | ltp=%.2f | sma_fast=%s | sma_slow=%s",
                    symbol,
                    ltp,
                    round(sma_fast, 4) if sma_fast is not None else None,
                    round(sma_slow, 4) if sma_slow is not None else None,
                )

                if sma_fast is None or sma_slow is None:
                    continue

                if is_bearish(symbol):
                    if symbol not in active_signals:
                        active_signals[symbol] = {
                            "entry_price": ltp,
                            "entry_time": now.strftime("%H:%M:%S"),
                            "entry_time_ist": now.strftime("%H:%M:%S"),
                            "entry_datetime_ist": now.isoformat(),
                        }
                        min_ltp_tracker[symbol] = ltp

                    min_ltp_tracker[symbol] = min(min_ltp_tracker[symbol], ltp)

                if symbol in active_signals:
                    entry_price = float(active_signals[symbol]["entry_price"])
                    min_ltp = float(min_ltp_tracker[symbol])
                    points_captured = entry_price - min_ltp
                    pct_captured = ((points_captured / entry_price) * 100) if entry_price else 0.0
                    pnl_points = entry_price - ltp
                    pnl_pct = ((pnl_points / entry_price) * 100) if entry_price else 0.0

                    signals_output.append(
                        {
                            "symbol": symbol,
                            "instrument_token": int(row["instrument_token"]),
                            "signal_status": "ENTERED",
                            "paper_trade": True,
                            "side": "DOWNSIDE",
                            "engine": "SMA",
                            "entry_time": active_signals[symbol]["entry_time_ist"],
                            "entry_time_ist": active_signals[symbol]["entry_time_ist"],
                            "entry_datetime_ist": active_signals[symbol]["entry_datetime_ist"],
                            "entry_price": round(entry_price, 2),
                            "avg_price": round(entry_price, 2),
                            "current_ltp": round(ltp, 2),
                            "min_ltp": round(min_ltp, 2),
                            "favorable_price": round(min_ltp, 2),
                            "points_captured": round(points_captured, 2),
                            "pct_captured": round(pct_captured, 2),
                            "pnl_points": round(pnl_points, 2),
                            "pnl_pct": round(pnl_pct, 2),
                            "fast_sma": round(sma_fast, 4),
                            "slow_sma": round(sma_slow, 4),
                        }
                    )

            except Exception as exc:
                logger.exception("DS STOCK ERROR | symbol=%s | error=%s", symbol, exc)

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="RUNNING",
            message="Live downside stock signal running on SMA crossover.",
            progress_text=f"{len(signals_output)} entered out of {len(universe_df)} stocks",
            is_loading=False,
            extra={"signals": signals_output, "entered_count": len(signals_output), "total_count": int(len(universe_df)), "engine": "SMA", "fast_sma_span": FAST_SMA_SPAN, "slow_sma_span": SLOW_SMA_SPAN, "updated_at_ist": now.isoformat()},
        )

        time.sleep(1)


def main() -> None:
    logger = setup_logger("lightnin_bear_downside_intraday_signal", DOWNSIDE_CONFIG["log_file_name"])
    logger.info("DS MAIN 1: LIGHTNIN BEAR DOWNSIDE main() started | ENGINE=SMA")

    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        ui_state="BOOTING",
        message="Downside stock signal process started.",
        progress_text="Initializing",
        is_loading=True,
        extra={"signals": [], "entered_count": 0, "total_count": 0, "engine": "SMA", "updated_at_ist": datetime.now(IST).isoformat()},
    )

    try:
        cred = load_creds()
        kite = KiteConnect(api_key=cred["z_api_key"])
        token_key = "z_" + "access_" + "token"
        kite.set_access_token(cred[token_key])

        universe_df = build_signal_universe(regime_file_path=DOWNSIDE_CONFIG["regime_file_path"])
        if universe_df.empty:
            raise ValueError("DS MAIN FAIL: universe_df is empty")

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="RUNNING",
            message="Downside stock signal universe loaded.",
            progress_text=f"Tracking {len(universe_df)} stocks",
            is_loading=False,
            extra={"signals": [], "entered_count": 0, "total_count": int(len(universe_df)), "engine": "SMA", "updated_at_ist": datetime.now(IST).isoformat()},
        )

        run_downside_strategy(kite=kite, universe_df=universe_df, logger=logger)

    except Exception as exc:
        error_msg = f"Downside strategy failed: {exc}"
        logger.exception("DS MAIN ERROR: %s", error_msg)
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="ERROR",
            message=error_msg,
            progress_text="Check Render logs",
            is_loading=False,
            extra={"signals": [], "entered_count": 0, "total_count": 0, "error": str(exc), "engine": "SMA", "updated_at_ist": datetime.now(IST).isoformat()},
        )


if __name__ == "__main__":
    main()
