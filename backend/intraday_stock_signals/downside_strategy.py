from __future__ import annotations

import time
from datetime import datetime, timedelta

from kiteconnect import KiteConnect

from .config import (
    DOWNSIDE_CONFIG, IST,
    STOCK_TARGET_PCT, STOCK_SL_PCT, PORTFOLIO_SL_PCT, PORTFOLIO_TARGET_PCT,
    MAX_STOCK_PRICE, CAPITAL_PER_STOCK, INTRADAY_LEVERAGE, MAX_STOCKS_PER_STRATEGY,
)
from .data_loader import build_signal_universe
from .ema_engine import update_sma, is_bearish, reset_sma_for_symbols
from .publisher import publish_strategy_state
from .utils import load_creds, setup_logger


STRATEGY_NAME = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL"
FAST_SMA_SPAN = int(DOWNSIDE_CONFIG.get("fast_span", 50))
SLOW_SMA_SPAN = int(DOWNSIDE_CONFIG.get("slow_span", 150))


def run_downside_strategy(kite: KiteConnect, universe_df, logger) -> None:
    logger.info(
        "DS RUN 1: Downside Strategy Started | ENGINE=SMA | fast=%s | slow=%s | target=-%.1f%% | sl=+%.1f%% | portfolio_sl=-%.1f%%",
        FAST_SMA_SPAN, SLOW_SMA_SPAN, STOCK_TARGET_PCT, STOCK_SL_PCT, PORTFOLIO_SL_PCT,
    )

    active_signals: dict[str, dict] = {}   # stocks currently in trade
    exited_signals: dict[str, dict] = {}   # stocks that hit target or SL
    min_ltp_tracker: dict[str, float] = {}
    portfolio_stopped = False              # portfolio circuit breaker

    while True:
        now = datetime.now(IST)

        if now.hour > 15 or (now.hour == 15 and now.minute >= 30):
            logger.info("DS RUN STOP: Market closed — session complete.")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                ui_state="STOPPED",
                message="Market closed. Downside stock signal stopped.",
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
            return  # returns to outer daily-restart loop in main()

        # ── Batch LTP fetch ────────────────────────────────────────────────
        all_quote_keys = [f"NSE:{str(r['symbol']).strip().upper()}" for _, r in universe_df.iterrows()]
        try:
            all_ltp_data = kite.ltp(all_quote_keys)
        except Exception as exc:
            logger.error("DS BATCH LTP FAIL: %s", exc)
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
                    logger.error("DS LTP FAIL: %s missing in batch ltp response", quote_key)
                    continue

                ltp = float(all_ltp_data[quote_key]["last_price"])

                # ── Price filter: skip stocks ≥ ₹5000 ─────────────────────
                if ltp >= MAX_STOCK_PRICE:
                    logger.info("DS SKIP | %s | ltp=%.2f >= ₹%.0f price cap", symbol, ltp, MAX_STOCK_PRICE)
                    continue

                # ── SMA update ────────────────────────────────────────────
                sma_fast, sma_slow = update_sma(
                    symbol=symbol,
                    price=ltp,
                    fast_span=FAST_SMA_SPAN,
                    slow_span=SLOW_SMA_SPAN,
                )

                logger.info(
                    "DS TICK | symbol=%s | ltp=%.2f | sma_fast=%s | sma_slow=%s | portfolio_stopped=%s",
                    symbol, ltp,
                    round(sma_fast, 4) if sma_fast is not None else None,
                    round(sma_slow, 4) if sma_slow is not None else None,
                    portfolio_stopped,
                )

                if sma_fast is None or sma_slow is None:
                    continue

                # ── Entry: only if portfolio circuit breaker not triggered,
                #          stock never entered before, and total slots not full ─
                if (
                    not portfolio_stopped
                    and is_bearish(symbol)
                    and symbol not in active_signals
                    and symbol not in exited_signals
                    and (len(active_signals) + len(exited_signals)) < MAX_STOCKS_PER_STRATEGY
                ):
                    buying_power = CAPITAL_PER_STOCK * INTRADAY_LEVERAGE
                    qty = int(buying_power // ltp)
                    logger.info(
                        "DS SIGNAL ENTERED | %s @ %.2f | qty=%d | buying_power=%.0f | time=%s",
                        symbol, ltp, qty, buying_power, now.strftime("%H:%M:%S"),
                    )
                    active_signals[symbol] = {
                        "entry_price": ltp,
                        "entry_time": now.strftime("%H:%M:%S"),
                        "entry_time_ist": now.strftime("%H:%M:%S"),
                        "entry_datetime_ist": now.isoformat(),
                        "instrument_token": int(row["instrument_token"]),
                        # Downside: target is below entry, stop loss is above entry
                        "target_price": round(ltp * (1 - STOCK_TARGET_PCT / 100), 2),
                        "stop_loss_price": round(ltp * (1 + STOCK_SL_PCT / 100), 2),
                        "qty": qty,
                        "buying_power": round(buying_power, 2),
                        "invested_amount": round(qty * ltp, 2),
                    }
                    min_ltp_tracker[symbol] = ltp

                if symbol not in active_signals:
                    continue

                # ── Live PnL tracking ──────────────────────────────────────
                entry_price = float(active_signals[symbol]["entry_price"])
                target_price = float(active_signals[symbol]["target_price"])
                stop_loss_price = float(active_signals[symbol]["stop_loss_price"])
                min_ltp_tracker[symbol] = min(min_ltp_tracker.get(symbol, ltp), ltp)
                min_ltp = min_ltp_tracker[symbol]

                qty           = int(active_signals[symbol].get("qty", 0))
                buying_power  = float(active_signals[symbol].get("buying_power", 0))
                invested_amt  = float(active_signals[symbol].get("invested_amount", qty * entry_price))

                # Downside PnL: profit when price falls
                pnl_points    = entry_price - ltp
                pnl_pct       = (pnl_points / entry_price * 100) if entry_price else 0.0
                real_pnl      = round(pnl_points * qty, 2)
                points_captured = entry_price - min_ltp
                pct_captured  = (points_captured / entry_price * 100) if entry_price else 0.0

                # ── Per-stock exit check ───────────────────────────────────
                if ltp <= target_price:
                    exit_reason = "TARGET_HIT"
                elif ltp >= stop_loss_price:
                    exit_reason = "STOP_LOSS_HIT"
                else:
                    exit_reason = None

                if exit_reason:
                    logger.info(
                        "DS EXIT | %s | reason=%s | entry=%.2f | ltp=%.2f | qty=%d | real_pnl=%.2f | pnl_pct=%.2f%%",
                        symbol, exit_reason, entry_price, ltp, qty, real_pnl, pnl_pct,
                    )
                    exited_rec = {
                        "symbol": symbol,
                        "instrument_token": int(row["instrument_token"]),
                        "signal_status": exit_reason,
                        "paper_trade": True,
                        "side": "DOWNSIDE",
                        "entry_time": active_signals[symbol]["entry_time_ist"],
                        "entry_price": round(entry_price, 2),
                        "avg_price": round(entry_price, 2),
                        "current_ltp": round(ltp, 2),
                        "exit_price": round(ltp, 2),
                        "exit_time": now.strftime("%H:%M:%S"),
                        "exit_reason": exit_reason,
                        "target_price": round(target_price, 2),
                        "stop_loss_price": round(stop_loss_price, 2),
                        "qty": qty,
                        "buying_power": round(buying_power, 2),
                        "invested_amount": round(invested_amt, 2),
                        "pnl_points": round(pnl_points, 2),
                        "pnl_pct": round(pnl_pct, 2),
                        "real_pnl": real_pnl,
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
                    "side": "DOWNSIDE",
                    "engine": "SMA",
                    "entry_time": active_signals[symbol]["entry_time_ist"],
                    "entry_price": round(entry_price, 2),
                    "avg_price": round(entry_price, 2),
                    "current_ltp": round(ltp, 2),
                    "min_ltp": round(min_ltp, 2),
                    "target_price": round(target_price, 2),
                    "stop_loss_price": round(stop_loss_price, 2),
                    "qty": qty,
                    "buying_power": round(buying_power, 2),
                    "invested_amount": round(invested_amt, 2),
                    "pnl_points": round(pnl_points, 2),
                    "pnl_pct": round(pnl_pct, 2),
                    "real_pnl": real_pnl,
                    "points_captured": round(points_captured, 2),
                    "pct_captured": round(pct_captured, 2),
                    "fast_sma": round(sma_fast, 4),
                    "slow_sma": round(sma_slow, 4),
                })

            except Exception as exc:
                logger.exception("DS STOCK ERROR | symbol=%s | error=%s", symbol, exc)

        # ── Portfolio-level circuit breaker check ──────────────────────────
        active_rows = [s for s in signals_output if s.get("signal_status") == "ENTERED"]
        if not portfolio_stopped and active_rows:
            avg_portfolio_pnl_pct = sum(s.get("pnl_pct", 0) for s in active_rows) / len(active_rows)

            if avg_portfolio_pnl_pct <= -PORTFOLIO_SL_PCT:
                portfolio_stopped = True
                logger.warning(
                    "DS PORTFOLIO STOP HIT | avg_pnl_pct=%.2f%% | threshold=-%.1f%%",
                    avg_portfolio_pnl_pct, PORTFOLIO_SL_PCT,
                )
                for s in active_rows:
                    sym = s["symbol"]
                    s["signal_status"] = "PORTFOLIO_STOP_HIT"
                    s["exit_reason"] = "PORTFOLIO_STOP_HIT"
                    s["exit_time"] = now.strftime("%H:%M:%S")
                    exited_signals[sym] = s
                    if sym in active_signals:
                        del active_signals[sym]

            elif avg_portfolio_pnl_pct >= PORTFOLIO_TARGET_PCT:
                portfolio_stopped = True
                logger.info(
                    "DS PORTFOLIO TARGET HIT | avg_pnl_pct=%.2f%% | threshold=+%.1f%%",
                    avg_portfolio_pnl_pct, PORTFOLIO_TARGET_PCT,
                )
                for s in active_rows:
                    sym = s["symbol"]
                    s["signal_status"] = "PORTFOLIO_TARGET_HIT"
                    s["exit_reason"] = "PORTFOLIO_TARGET_HIT"
                    s["exit_time"] = now.strftime("%H:%M:%S")
                    exited_signals[sym] = s
                    if sym in active_signals:
                        del active_signals[sym]
        else:
            avg_portfolio_pnl_pct = (
                sum(s.get("pnl_pct", 0) for s in active_rows) / len(active_rows)
                if active_rows else 0.0
            )

        entered_count  = len(active_rows)
        total_real_pnl = round(sum(s.get("real_pnl", 0) for s in signals_output), 2)
        total_invested = round(sum(s.get("invested_amount", 0) for s in active_rows), 2)

        portfolio_message = "Live downside stock signal running on SMA crossover."
        if portfolio_stopped:
            if avg_portfolio_pnl_pct >= PORTFOLIO_TARGET_PCT:
                portfolio_message = f"Portfolio target hit at +{PORTFOLIO_TARGET_PCT}%. No new entries for today."
            else:
                portfolio_message = f"Portfolio stop hit at -{PORTFOLIO_SL_PCT}%. No new entries for today."

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="PORTFOLIO_STOPPED" if portfolio_stopped else "RUNNING",
            message=portfolio_message,
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
                "total_real_pnl": total_real_pnl,
                "total_invested": total_invested,
                "capital_per_stock": CAPITAL_PER_STOCK,
                "leverage": INTRADAY_LEVERAGE,
                "max_stocks": MAX_STOCKS_PER_STRATEGY,
                "updated_at_ist": now.isoformat(),
            },
        )

        time.sleep(0.5)  # 0.5s + ~0.2s API latency = ~1.4x faster tick rate vs 1s sleep


def _next_market_open_ist(now: datetime) -> datetime:
    """Return the next 9:14 AM IST on a weekday from now."""
    candidate = now.replace(hour=9, minute=14, second=0, microsecond=0)
    if now >= candidate:
        candidate += timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate


def main() -> None:
    logger = setup_logger("lightnin_bear_downside_intraday_signal", DOWNSIDE_CONFIG["log_file_name"])
    logger.info("DS MAIN: LIGHTNIN BEAR DOWNSIDE thread started — daily restart loop active.")

    while True:
        now = datetime.now(IST)

        # ── Weekend check ────────────────────────────────────────────────────
        if now.weekday() >= 5:
            next_open = _next_market_open_ist(now)
            wait = min((next_open - now).total_seconds(), 3600)
            logger.info("DS: Weekend. Next open %s IST. Sleeping %ds.", next_open.strftime("%a %d-%b %H:%M"), int(wait))
            time.sleep(max(wait, 60))
            continue

        market_open  = now.replace(hour=9,  minute=14, second=0, microsecond=0)
        market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)

        # ── Pre-market ───────────────────────────────────────────────────────
        if now < market_open:
            wait = min((market_open - now).total_seconds(), 60)
            logger.info("DS: Pre-market. Opens at 9:15 IST. Sleeping %ds.", int(wait))
            time.sleep(max(wait, 5))
            continue

        # ── Post-market ──────────────────────────────────────────────────────
        if now >= market_close:
            next_open = _next_market_open_ist(now)
            wait = min((next_open - now).total_seconds(), 3600)
            logger.info("DS: Market closed. Next session %s IST. Sleeping %ds.", next_open.strftime("%a %d-%b %H:%M"), int(wait))
            time.sleep(max(wait, 60))
            continue

        # ── Market is open: run today's trading session ───────────────────────
        logger.info("DS SESSION: Starting downside session for %s.", now.strftime("%Y-%m-%d"))
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            ui_state="BOOTING",
            message="Downside stock signal process started.",
            progress_text="Initializing",
            is_loading=True,
            extra={
                "signals": [], "entered_count": 0, "total_count": 0, "engine": "SMA",
                "portfolio_stopped": False, "updated_at_ist": now.isoformat(),
            },
        )

        try:
            cred = load_creds()
            kite = KiteConnect(api_key=cred["z_api_key"])
            token_key = "z_" + "access_" + "token"
            kite.set_access_token(cred[token_key])
            logger.info("DS SESSION: Kite authenticated.")

            universe_df = build_signal_universe(regime_file_path=DOWNSIDE_CONFIG["regime_file_path"])
            if universe_df.empty:
                raise ValueError("universe_df is empty — check regime file.")

            # Clear stale SMA state from any previous session
            symbols = [str(r["symbol"]).strip().upper() for _, r in universe_df.iterrows()]
            reset_sma_for_symbols(symbols)
            logger.info("DS SESSION: SMA state cleared for %d symbols. Warmup begins (fast=%d ticks ~%.0fm, slow=%d ticks ~%.0fm).",
                        len(symbols), FAST_SMA_SPAN, FAST_SMA_SPAN / 70, SLOW_SMA_SPAN, SLOW_SMA_SPAN / 70)

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                ui_state="RUNNING",
                message="Downside stock signal universe loaded.",
                progress_text=f"Tracking {len(universe_df)} stocks",
                is_loading=False,
                extra={
                    "signals": [], "entered_count": 0, "total_count": int(len(universe_df)),
                    "engine": "SMA", "portfolio_stopped": False,
                    "updated_at_ist": now.isoformat(),
                },
            )

            run_downside_strategy(kite=kite, universe_df=universe_df, logger=logger)
            logger.info("DS SESSION: Trading session ended normally.")

        except Exception as exc:
            logger.exception("DS SESSION ERROR: %s", exc)
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                ui_state="ERROR",
                message=f"Downside strategy session error: {exc}",
                progress_text="Retrying in 30s — check Render logs",
                is_loading=False,
                extra={
                    "signals": [], "entered_count": 0, "total_count": 0,
                    "error": str(exc), "portfolio_stopped": False,
                    "updated_at_ist": datetime.now(IST).isoformat(),
                },
            )
            time.sleep(30)


if __name__ == "__main__":
    main()
