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
