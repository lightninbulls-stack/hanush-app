from __future__ import annotations

import time
from datetime import datetime

from kiteconnect import KiteConnect

from .config import IST, UPSIDE_CONFIG, STOCK_TARGET_PCT, STOCK_SL_PCT, PORTFOLIO_SL_PCT, MAX_STOCK_PRICE
from .data_loader import build_signal_universe
from .ema_engine import update_sma, is_bullish
from .publisher import publish_strategy_state
from .utils import load_creds, setup_logger


STRATEGY_NAME = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
FAST_SMA_SPAN = int(UPSIDE_CONFIG.get("fast_span", 50))
SLOW_SMA_SPAN = int(UPSIDE_CONFIG.get("slow_span", 150))


def run_upside_strategy(kite: KiteConnect, universe_df, logger) -> None:
    logger.info(
        "US RUN 1: Upside Strategy Started | ENGINE=SMA | fast=%s | slow=%s | target=+%.1f%% | sl=-%.1f%% | portfolio_sl=-%.1f%%",
        FAST_SMA_SPAN, SLOW_SMA_SPAN, STOCK_TARGET_PCT, STOCK_SL_PCT, PORTFOLIO_SL_PCT,
    )

    active_signals: dict[str, dict] = {}   # stocks currently in trade
    exited_signals: dict[str, dict] = {}   # stocks that hit target or SL
    max_ltp_tracker: dict[str, float] = {}
    portfolio_stopped = False              # portfolio circuit breaker

    while True:
        now = datetime.now(IST)

        if now.hour > 15 or (now.hour == 15 and now.minute >= 30):
            logger.info("US RUN STOP: Market closed — stopping upside strategy")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                ui_state="STOPPED",
                message="Market closed. Upside stock signal stopped.",
                progress_text="Stopped after 3:30 PM IST",
                is_loading=False,
                extra={
                    "signals": list(exited_signals.values()),
                    "entered_count": 0,
                    "total_count": int(len(universe_df)),
                    "engine": "SMA",
                    "portfolio_stopped": portfolio_stopped,
                    "updated_at_ist": now.isoformat(),
                },
            )
            break

        # ── Batch LTP fetch ────────────────────────────────────────────────
        all_quote_keys = [f"NSE:{str(r['symbol']).strip().upper()}" for _, r in universe_df.iterrows()]
        try:
            all_ltp_data = kite.ltp(all_quote_keys)
        except Exception as exc:
            logger.error("US BATCH LTP FAIL: %s", exc)
            time.sleep(1)
            continue

        signals_output = []

        for _, row in universe_df.iterrows():
            symbol = str(row["symbol"]).strip().upper()

            # Already exited — include in output with final status, skip live tracking
            if symbol in exited_signals:
                signals_output.append(exited_signals[symbol])
                continue

            try:
                quote_key = f"NSE:{symbol}"
                if quote_key not in all_ltp_data:
                    logger.error("US LTP FAIL: %s missing in batch ltp response", quote_key)
                    continue

                ltp = float(all_ltp_data[quote_key]["last_price"])

                # ── Price filter: skip stocks ≥ ₹5000 ─────────────────────
                if ltp >= MAX_STOCK_PRICE:
                    logger.info("US SKIP | %s | ltp=%.2f >= ₹%.0f price cap", symbol, ltp, MAX_STOCK_PRICE)
                    continue

                # ── SMA update (even if portfolio stopped, keep SMAs warm) ──
                sma_fast, sma_slow = update_sma(
                    symbol=symbol,
                    price=ltp,
                    fast_span=FAST_SMA_SPAN,
                    slow_span=SLOW_SMA_SPAN,
                )

                logger.info(
                    "US TICK | symbol=%s | ltp=%.2f | sma_fast=%s | sma_slow=%s | portfolio_stopped=%s",
                    symbol, ltp,
                    round(sma_fast, 4) if sma_fast is not None else None,
                    round(sma_slow, 4) if sma_slow is not None else None,
                    portfolio_stopped,
                )

                if sma_fast is None or sma_slow is None:
                    continue

                # ── Entry: only if portfolio circuit breaker not triggered ──
                if not portfolio_stopped and is_bullish(symbol) and symbol not in active_signals:
                    logger.info("US SIGNAL ENTERED | %s @ %.2f | time=%s", symbol, ltp, now.strftime("%H:%M:%S"))
                    active_signals[symbol] = {
                        "entry_price": ltp,
                        "entry_time": now.strftime("%H:%M:%S"),
                        "entry_time_ist": now.strftime("%H:%M:%S"),
                        "entry_datetime_ist": now.isoformat(),
                        "instrument_token": int(row["instrument_token"]),
                        "target_price": round(ltp * (1 + STOCK_TARGET_PCT / 100), 2),
                        "stop_loss_price": round(ltp * (1 - STOCK_SL_PCT / 100), 2),
                    }
                    max_ltp_tracker[symbol] = ltp

                if symbol not in active_signals:
                    continue

                # ── Live PnL tracking ──────────────────────────────────────
                entry_price = float(active_signals[symbol]["entry_price"])
                target_price = float(active_signals[symbol]["target_price"])
                stop_loss_price = float(active_signals[symbol]["stop_loss_price"])
                max_ltp_tracker[symbol] = max(max_ltp_tracker.get(symbol, ltp), ltp)
                max_ltp = max_ltp_tracker[symbol]

                pnl_points = ltp - entry_price
                pnl_pct = (pnl_points / entry_price * 100) if entry_price else 0.0
                points_captured = max_ltp - entry_price
                pct_captured = (points_captured / entry_price * 100) if entry_price else 0.0

                # ── Per-stock exit check ───────────────────────────────────
                if ltp >= target_price:
                    exit_reason = "TARGET_HIT"
                elif ltp <= stop_loss_price:
                    exit_reason = "STOP_LOSS_HIT"
                else:
                    exit_reason = None

                if exit_reason:
                    logger.info(
                        "US EXIT | %s | reason=%s | entry=%.2f | ltp=%.2f | pnl_pct=%.2f%%",
                        symbol, exit_reason, entry_price, ltp, pnl_pct,
                    )
                    exited_rec = {
                        "symbol": symbol,
                        "instrument_token": int(row["instrument_token"]),
                        "signal_status": exit_reason,
                        "paper_trade": True,
                        "side": "UPSIDE",
                        "entry_time": active_signals[symbol]["entry_time_ist"],
                        "entry_price": round(entry_price, 2),
                        "avg_price": round(entry_price, 2),
                        "current_ltp": round(ltp, 2),
                        "exit_price": round(ltp, 2),
                        "exit_time": now.strftime("%H:%M:%S"),
                        "exit_reason": exit_reason,
                        "target_price": round(target_price, 2),
                        "stop_loss_price": round(stop_loss_price, 2),
                        "pnl_points": round(pnl_points, 2),
                        "pnl_pct": round(pnl_pct, 2),
                        "points_captured": round(points_captured, 2),
                        "pct_captured": round(pct_captured, 2),
                    }
                    exited_signals[symbol] = exited_rec
                    signals_output.append(exited_rec)
                    del active_signals[symbol]
                    continue

                # Still active
                signals_output.append({
                    "symbol": symbol,
                    "instrument_token": int(row["instrument_token"]),
                    "signal_status": "ENTERED",
                    "paper_trade": True,
                    "side": "UPSIDE",
                    "engine": "SMA",
                    "entry_time": active_signals[symbol]["entry_time_ist"],
                    "entry_price": round(entry_price, 2),
                    "avg_price": round(entry_price, 2),
                    "current_ltp": round(ltp, 2),
                    "max_ltp": round(max_ltp, 2),
                    "target_price": round(target_price, 2),
                    "stop_loss_price": round(stop_loss_price, 2),
                    "pnl_points": round(pnl_points, 2),
                    "pnl_pct": round(pnl_pct, 2),
                    "points_captured": round(points_captured, 2),
                    "pct_captured": round(pct_captured, 2),
                    "fast_sma": round(sma_fast, 4),
                    "slow_sma": round(sma_slow, 4),
                })

            except Exception as exc:
                logger.exception("US STOCK ERROR | symbol=%s | error=%s", symbol, exc)

        # ── Portfolio-level circuit breaker check ──────────────────────────
        active_rows = [s for s in signals_output if s.get("signal_status") == "ENTERED"]
        if not portfolio_stopped and active_rows:
            avg_portfolio_pnl_pct = sum(s.get("pnl_pct", 0) for s in active_rows) / len(active_rows)

            if avg_portfolio_pnl_pct <= -PORTFOLIO_SL_PCT:
                portfolio_stopped = True
                logger.warning(
                    "US PORTFOLIO STOP HIT | avg_pnl_pct=%.2f%% | threshold=-%.1f%%",
                    avg_portfolio_pnl_pct, PORTFOLIO_SL_PCT,
                )
                # Mark all still-active stocks as PORTFOLIO_STOP_HIT and exit them
                for s in active_rows:
                    sym = s["symbol"]
                    s["signal_status"] = "PORTFOLIO_STOP_HIT"
                    s["exit_reason"] = "PORTFOLIO_STOP_HIT"
                    s["exit_time"] = now.strftime("%H:%M:%S")
                    exited_signals[sym] = s
                    if sym in active_signals:
                        del active_signals[sym]
        else:
            avg_portfolio_pnl_pct = (
                sum(s.get("pnl_pct", 0) for s in active_rows) / len(active_rows)
                if active_rows else 0.0
            )

        entered_count = len(active_rows)

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="PORTFOLIO_STOPPED" if portfolio_stopped else "RUNNING",
            message=(
                f"Portfolio stop hit at -{PORTFOLIO_SL_PCT}%. No new entries for today."
                if portfolio_stopped
                else "Live upside stock signal running on SMA crossover."
            ),
            progress_text=f"{entered_count} active | {len(exited_signals)} exited | {len(universe_df)} total",
            is_loading=False,
            extra={
                "signals": signals_output,
                "entered_count": entered_count,
                "total_count": int(len(universe_df)),
                "engine": "SMA",
                "fast_sma_span": FAST_SMA_SPAN,
                "slow_sma_span": SLOW_SMA_SPAN,
                "portfolio_pnl_pct": round(avg_portfolio_pnl_pct, 2),
                "portfolio_stop_pct": PORTFOLIO_SL_PCT,
                "portfolio_stopped": portfolio_stopped,
                "updated_at_ist": now.isoformat(),
            },
        )

        time.sleep(1)


def main() -> None:
    logger = setup_logger(
        "lightnin_bull_upside_intraday_signal",
        UPSIDE_CONFIG["log_file_name"],
    )
    logger.info("US MAIN 1: LIGHTNIN BULL UPSIDE main() started | ENGINE=SMA")

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
            "engine": "SMA",
            "fast_sma_span": FAST_SMA_SPAN,
            "slow_sma_span": SLOW_SMA_SPAN,
            "portfolio_stopped": False,
            "updated_at_ist": datetime.now(IST).isoformat(),
        },
    )

    try:
        logger.info("US MAIN 2: loading credentials")
        cred = load_creds()
        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        logger.info("US MAIN 4: Kite authenticated")

        universe_df = build_signal_universe(regime_file_path=UPSIDE_CONFIG["regime_file_path"])
        if universe_df.empty:
            raise ValueError("US MAIN FAIL: universe_df is empty")

        logger.info("US MAIN 6: Upside universe loaded: %s stocks", len(universe_df))

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
                "engine": "SMA",
                "fast_sma_span": FAST_SMA_SPAN,
                "slow_sma_span": SLOW_SMA_SPAN,
                "portfolio_stopped": False,
                "updated_at_ist": datetime.now(IST).isoformat(),
            },
        )

        run_upside_strategy(kite=kite, universe_df=universe_df, logger=logger)

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
                "portfolio_stopped": False,
                "updated_at_ist": datetime.now(IST).isoformat(),
            },
        )


if __name__ == "__main__":
    main()
