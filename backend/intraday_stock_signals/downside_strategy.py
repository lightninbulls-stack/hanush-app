from __future__ import annotations

import time
from datetime import datetime

from kiteconnect import KiteConnect

from .config import IST, DOWNSIDE_CONFIG
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
            break

        signals_output = []

        for _, row in universe_df.iterrows():
            symbol = str(row["symbol"]).strip().upper()

            try:
                quote_key = f"NSE:{symbol}"
                ltp = float(kite.ltp(quote_key)[quote_key]["last_price"])

                sma_fast, sma_slow = update_sma(symbol, ltp)

                if sma_fast is None or sma_slow is None:
                    continue

                if is_bearish(symbol):
                    if symbol not in active_signals:
                        active_signals[symbol] = {
                            "entry_price": ltp,
                            "entry_time": now.strftime("%H:%M:%S"),
                        }
                        min_ltp_tracker[symbol] = ltp

                    min_ltp_tracker[symbol] = min(min_ltp_tracker[symbol], ltp)

                if symbol in active_signals:
                    entry_price = active_signals[symbol]["entry_price"]
                    min_ltp = min_ltp_tracker[symbol]

                    pnl_points = entry_price - ltp
                    pnl_pct = (pnl_points / entry_price) * 100

                    signals_output.append(
                        {
                            "symbol": symbol,
                            "signal_status": "ENTERED",
                            "entry_time": active_signals[symbol]["entry_time"],
                            "avg_price": entry_price,
                            "current_ltp": ltp,
                            "min_ltp": min_ltp,
                            "pnl_points": pnl_points,
                            "pnl_pct": pnl_pct,
                        }
                    )

            except Exception:
                continue

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="RUNNING",
            message="Downside SMA running",
            is_loading=False,
            extra={
                "signals": signals_output,
                "entered_count": len(signals_output),
                "total_count": len(universe_df),
            },
        )

        time.sleep(1)
