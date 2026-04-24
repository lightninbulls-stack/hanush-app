import time
from datetime import datetime

from .ema_engine import update_ema
from .publisher import publish_strategy_state


def run_upside_strategy(kite, universe_df, logger):

    logger.info("🚀 Upside Strategy Started")

    active_signals = {}
    max_ltp_tracker = {}

    while True:

        now = datetime.now()

        # Stop after 3:30 PM
        if now.hour >= 15 and now.minute >= 30:
            logger.info("🛑 Market closed — stopping")
            break

        signals_output = []

        for _, row in universe_df.iterrows():
            symbol = row["symbol"]

            try:
                # 🔹 GET LTP
                ltp_data = kite.ltp(f"NSE:{symbol}")
                ltp = ltp_data[f"NSE:{symbol}"]["last_price"]

                # 🔹 EMA UPDATE
                ema_fast, ema_slow = update_ema(symbol, ltp)

                if ema_fast is None or ema_slow is None:
                    continue

                # 🔥 SIGNAL CONDITION
                if ema_fast > ema_slow:

                    # ENTRY ONCE
                    if symbol not in active_signals:
                        logger.info(f"✅ SIGNAL: {symbol} @ {ltp}")

                        active_signals[symbol] = {
                            "entry_price": ltp,
                            "entry_time": now.strftime("%H:%M:%S"),
                        }

                        max_ltp_tracker[symbol] = ltp

                    # TRACK MAX LTP
                    max_ltp_tracker[symbol] = max(max_ltp_tracker[symbol], ltp)

                    entry_price = active_signals[symbol]["entry_price"]
                    max_ltp = max_ltp_tracker[symbol]

                    signals_output.append({
                        "symbol": symbol,
                        "entry_price": entry_price,
                        "ltp": ltp,
                        "max_ltp": max_ltp,
                        "points": round(max_ltp - entry_price, 2),
                    })

            except Exception as e:
                logger.error(f"{symbol} error: {e}")

        # 🔥 PUSH TO FRONTEND
        publish_strategy_state(
            strategy_name="LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL",
            ui_state="RUNNING",
            message="Live signals running",
            progress_text=f"{len(signals_output)} signals",
            is_loading=False,
            extra={
                "signals": signals_output,
                "entered_count": len(signals_output),
                "total_count": len(universe_df),
            },
        )

        time.sleep(1)

def main() -> None:
    from kiteconnect import KiteConnect

    from .config import UPSIDE_CONFIG
    from .data_loader import build_signal_universe
    from .utils import load_creds, setup_logger

    logger = setup_logger(
        "lightnin_bull_upside_intraday_signal",
        UPSIDE_CONFIG["log_file_name"],
    )

    logger.info("🚀 LIGHTNIN BULL UPSIDE main() started")

    cred = load_creds()

    kite = KiteConnect(api_key=cred["z_api_key"])
    kite.set_access_token(cred["z_access_token"])

    universe_df = build_signal_universe(
        regime_file_path=UPSIDE_CONFIG["regime_file_path"],
    )

    logger.info("✅ Upside universe loaded: %s stocks", len(universe_df))

    run_upside_strategy(
        kite=kite,
        universe_df=universe_df,
        logger=logger,
    )


if __name__ == "__main__":
    main()
