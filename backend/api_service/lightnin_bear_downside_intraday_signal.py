from __future__ import annotations

import time
import traceback
from dataclasses import asdict, dataclass
from typing import Optional

import pandas as pd
from kiteconnect import KiteTicker

from shared.intraday_spreads_state import spread_state
from api_service.lightnin_bull_upside_intraday_signal import (
    INDEX_NAME,
    SPREAD_TYPE,
    FAST_EMA_SPAN,
    SLOW_EMA_SPAN,
    INSTRUMENT_FILE_CANDIDATES,
    current_ist,
    market_status_ist,
    wait_until_market_open,
    load_creds,
    resolve_existing_file,
    log_and_print,
)

STRATEGY_NAME = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL"

REGIME_FILE_CANDIDATES = [
    "data/regime_downside_latest.csv",
    "backend/data/regime_downside_latest.csv",
]

DOWNSIDE_TARGET_PCT = 0.017      # target = entry * 0.983
DOWNSIDE_STOP_LOSS_PCT = 0.01    # stop loss = entry * 1.01


@dataclass
class StockSignalState:
    symbol: str
    instrument_token: int
    signal_status: str = "WAITING"  # WAITING / ENTERED / TARGET_HIT / STOP_LOSS_HIT
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    avg_price: Optional[float] = None
    entry_price: Optional[float] = None
    current_ltp: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    pnl_points: Optional[float] = None
    pnl_pct: Optional[float] = None
    fast_ema: Optional[float] = None
    slow_ema: Optional[float] = None


class EMAState:
    def __init__(self, fast_span: int, slow_span: int):
        self.fast_alpha = 2 / (fast_span + 1)
        self.slow_alpha = 2 / (slow_span + 1)
        self.fast_ema: Optional[float] = None
        self.slow_ema: Optional[float] = None
        self.prev_fast_ema: Optional[float] = None
        self.prev_slow_ema: Optional[float] = None

    def update(self, price: float) -> None:
        self.prev_fast_ema = self.fast_ema
        self.prev_slow_ema = self.slow_ema

        if self.fast_ema is None:
            self.fast_ema = price
        else:
            self.fast_ema = price * self.fast_alpha + self.fast_ema * (1 - self.fast_alpha)

        if self.slow_ema is None:
            self.slow_ema = price
        else:
            self.slow_ema = price * self.slow_alpha + self.slow_ema * (1 - self.slow_alpha)

    def bearish_crossover(self) -> bool:
        if None in (self.prev_fast_ema, self.prev_slow_ema, self.fast_ema, self.slow_ema):
            return False
        return self.prev_fast_ema >= self.prev_slow_ema and self.fast_ema < self.slow_ema


def load_downside_signal_tokens() -> pd.DataFrame:
    regime_file_path = resolve_existing_file(REGIME_FILE_CANDIDATES, "downside regime")
    instrument_file_path = resolve_existing_file(INSTRUMENT_FILE_CANDIDATES, "instrument")

    regime_df = pd.read_csv(regime_file_path)
    inst_df = pd.read_csv(instrument_file_path)

    possible_symbol_cols = [
        "symbol",
        "Symbol",
        "stock",
        "Stock",
        "tradingsymbol",
        "TradingSymbol",
        "ticker",
        "Ticker",
    ]
    symbol_col = next((col for col in possible_symbol_cols if col in regime_df.columns), None)
    if symbol_col is None:
        raise ValueError(f"Could not find downside regime symbol column. Available columns: {regime_df.columns.tolist()}")

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
        raise ValueError("No symbols found in downside regime file.")

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
        raise ValueError(f"Missing columns in instrument file: {missing_cols}")

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
        log_and_print("No strict NSE EQ rows found for downside. Falling back to all NSE rows.", "warning")
        equity_df = inst_df[inst_df["exchange"] == "NSE"].copy()

    matched_df = equity_df[equity_df["tradingsymbol"].isin(regime_symbols)].copy()
    if matched_df.empty:
        raise ValueError(
            "No matching downside regime symbols found in NSE equity instruments. "
            f"Sample regime={regime_symbols[:10]} sample instruments={equity_df['tradingsymbol'].head(10).tolist()}"
        )

    matched_df = matched_df[
        ["instrument_token", "exchange_token", "tradingsymbol", "name", "instrument_type", "segment", "exchange"]
    ].drop_duplicates(subset=["tradingsymbol"]).reset_index(drop=True)

    matched_df = matched_df.rename(columns={"tradingsymbol": "symbol"})
    log_and_print(f"Matched {len(matched_df)} downside regime stocks with NSE cash tokens.")
    return matched_df


class LightninBearDownsideIntradaySignal:
    def __init__(self, cred: dict, regime_tokens_df: pd.DataFrame):
        self.cred = cred
        self.ws: Optional[KiteTicker] = None
        self.is_running = False
        self.last_publish_time = 0.0
        self.ema_states: dict[int, EMAState] = {}
        self.signal_states: dict[int, StockSignalState] = {}

        for _, row in regime_tokens_df.iterrows():
            token = int(row["instrument_token"])
            symbol = str(row["symbol"]).strip().upper()
            self.ema_states[token] = EMAState(FAST_EMA_SPAN, SLOW_EMA_SPAN)
            self.signal_states[token] = StockSignalState(symbol=symbol, instrument_token=token)

        log_and_print(f"Initialized {len(self.signal_states)} downside regime stocks.")

    def _build_payload(self, ui_state: str = "RUNNING", message: str = "Monitoring downside regime stocks for bearish EMA crossover.") -> dict:
        # IMPORTANT: frontend receives only actual signal rows.
        # WAITING stocks are hidden. ENTERED/TARGET_HIT/STOP_LOSS_HIT are shown.
        signals = [asdict(state) for state in self.signal_states.values() if state.signal_status != "WAITING"]
        signals = sorted(signals, key=lambda item: item["symbol"])

        active_count = sum(1 for row in signals if row["signal_status"] == "ENTERED")
        target_hit_count = sum(1 for row in signals if row["signal_status"] == "TARGET_HIT")
        stop_loss_hit_count = sum(1 for row in signals if row["signal_status"] == "STOP_LOSS_HIT")

        return {
            "index": INDEX_NAME,
            "spread_type": SPREAD_TYPE,
            "strategy_name": STRATEGY_NAME,
            "status": ui_state,
            "ui_state": ui_state,
            "message": message,
            "progress_text": f"{active_count} active, {target_hit_count} target hit, {stop_loss_hit_count} stop loss hit",
            "signals": signals,
            "entered_count": len(signals),
            "active_count": active_count,
            "target_hit_count": target_hit_count,
            "stop_loss_hit_count": stop_loss_hit_count,
            "total_count": len(self.signal_states),
            "updated_at": current_ist().isoformat(),
            "updated_at_ist": current_ist().strftime("%Y-%m-%d %H:%M:%S"),
            "net_pnl": 0.0,
            "fast_ema_span": FAST_EMA_SPAN,
            "slow_ema_span": SLOW_EMA_SPAN,
            "target_pct": DOWNSIDE_TARGET_PCT * 100,
            "stop_loss_pct": DOWNSIDE_STOP_LOSS_PCT * 100,
        }

    def _publish(self, force: bool = False) -> None:
        now = time.time()
        if not force and (now - self.last_publish_time < 1.0):
            return
        spread_state.update(STRATEGY_NAME, self._build_payload())
        self.last_publish_time = now

    def _enter_trade(self, signal_state: StockSignalState, ltp: float) -> None:
        entry = round(float(ltp), 2)
        signal_state.signal_status = "ENTERED"
        signal_state.entry_time = current_ist().strftime("%H:%M:%S")
        signal_state.avg_price = entry
        signal_state.entry_price = entry
        signal_state.current_ltp = entry
        signal_state.target_price = round(entry * (1 - DOWNSIDE_TARGET_PCT), 2)
        signal_state.stop_loss_price = round(entry * (1 + DOWNSIDE_STOP_LOSS_PCT), 2)
        signal_state.pnl_points = 0.0
        signal_state.pnl_pct = 0.0
        log_and_print(
            f"DOWNSIDE ENTRY | {signal_state.symbol} | entry={entry:.2f} | "
            f"target={signal_state.target_price:.2f} | stop_loss={signal_state.stop_loss_price:.2f}"
        )

    def _exit_trade(self, signal_state: StockSignalState, ltp: float, reason: str) -> None:
        if signal_state.entry_price is None:
            return

        exit_price = round(float(ltp), 2)
        signal_state.signal_status = "TARGET_HIT" if reason == "TARGET" else "STOP_LOSS_HIT"
        signal_state.exit_reason = reason
        signal_state.exit_time = current_ist().strftime("%H:%M:%S")
        signal_state.exit_price = exit_price
        signal_state.current_ltp = exit_price

        # Downside paper trade earns when price falls below entry.
        pnl_points = float(signal_state.entry_price) - exit_price
        signal_state.pnl_points = round(pnl_points, 2)
        signal_state.pnl_pct = round((pnl_points / float(signal_state.entry_price)) * 100, 2) if signal_state.entry_price else 0.0
        log_and_print(
            f"DOWNSIDE EXIT | {signal_state.symbol} | reason={reason} | "
            f"exit={exit_price:.2f} | pnl_pct={signal_state.pnl_pct:.2f}%"
        )

    def _handle_tick(self, token: int, ltp: float) -> None:
        if token not in self.ema_states:
            return

        ema_state = self.ema_states[token]
        signal_state = self.signal_states[token]
        ema_state.update(ltp)

        signal_state.current_ltp = round(float(ltp), 2)
        signal_state.fast_ema = round(float(ema_state.fast_ema), 4) if ema_state.fast_ema is not None else None
        signal_state.slow_ema = round(float(ema_state.slow_ema), 4) if ema_state.slow_ema is not None else None

        if signal_state.signal_status == "ENTERED":
            if signal_state.target_price is not None and float(ltp) <= float(signal_state.target_price):
                self._exit_trade(signal_state, float(ltp), "TARGET")
            elif signal_state.stop_loss_price is not None and float(ltp) >= float(signal_state.stop_loss_price):
                self._exit_trade(signal_state, float(ltp), "STOP_LOSS")
            return

        # After target/SL exit, do not re-enter same stock again today.
        if signal_state.signal_status != "WAITING":
            return

        # This is the only entry condition. Stock appears in frontend only after this bearish crossover.
        if ema_state.bearish_crossover():
            self._enter_trade(signal_state, float(ltp))

    def start(self) -> None:
        tokens = list(self.signal_states.keys())
        if not tokens:
            raise ValueError("No instrument tokens available for downside websocket subscription.")

        self.ws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.is_running = True

        spread_state.update(STRATEGY_NAME, self._build_payload("BOOTING", f"Preparing {len(tokens)} downside regime stocks."))

        def on_ticks(ws, ticks):
            if not self.is_running:
                return

            status = market_status_ist()
            if status != "OPEN":
                log_and_print(f"Market status={status}. Stopping downside stock signal engine.")
                self.stop()
                spread_state.update(STRATEGY_NAME, self._build_payload("STOPPED", "Trading window closed for the day."))
                return

            for tick in ticks:
                token = tick.get("instrument_token")
                ltp = tick.get("last_price")
                if token is None or ltp is None or ltp <= 0:
                    continue
                try:
                    self._handle_tick(int(token), float(ltp))
                except Exception as exc:
                    log_and_print(f"Downside tick error for token={token}: {exc}", "error")

            self._publish()

        def on_connect(ws, response):
            log_and_print(f"Connected to downside websocket. Subscribing {len(tokens)} NSE cash tokens.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)
            spread_state.update(STRATEGY_NAME, self._build_payload("RUNNING", "Live feed connected. Monitoring downside crossover signals."))

        def on_close(ws, code, reason):
            log_and_print(f"Downside WebSocket closed: {code} - {reason}", "warning")
            self.is_running = False

        def on_error(ws, code, reason):
            log_and_print(f"Downside WebSocket error: {code} - {reason}", "error")
            self.stop()
            spread_state.update(STRATEGY_NAME, self._build_payload("ERROR", f"WebSocket error: {reason}"))

        self.ws.on_ticks = on_ticks
        self.ws.on_connect = on_connect
        self.ws.on_close = on_close
        self.ws.on_error = on_error

        self._publish(force=True)
        self.ws.connect(threaded=True)

        while self.is_running:
            time.sleep(1)

    def stop(self) -> None:
        self.is_running = False
        try:
            if self.ws is not None:
                tokens = list(self.signal_states.keys())
                if tokens:
                    try:
                        self.ws.unsubscribe(tokens)
                    except Exception:
                        pass
                self.ws.close()
        except Exception as exc:
            log_and_print(f"Error while closing downside websocket: {exc}", "error")


def main() -> None:
    log_and_print("Downside stock signal main() entered")

    try:
        if not wait_until_market_open():
            return

        cred = load_creds()
        regime_tokens_df = load_downside_signal_tokens()
        engine = LightninBearDownsideIntradaySignal(cred=cred, regime_tokens_df=regime_tokens_df)
        engine.start()
        log_and_print("Downside intraday stock signal engine stopped.")

    except Exception as exc:
        log_and_print(f"Downside strategy failed: {exc}", "error")
        log_and_print(traceback.format_exc(), "error")
        spread_state.update(
            STRATEGY_NAME,
            {
                "index": INDEX_NAME,
                "spread_type": SPREAD_TYPE,
                "strategy_name": STRATEGY_NAME,
                "status": "ERROR",
                "ui_state": "ERROR",
                "message": f"Downside strategy failed: {exc}",
                "signals": [],
                "entered_count": 0,
                "total_count": 0,
                "updated_at": current_ist().isoformat(),
            },
        )


if __name__ == "__main__":
    main()
