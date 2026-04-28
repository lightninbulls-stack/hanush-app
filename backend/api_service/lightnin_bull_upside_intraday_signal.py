from __future__ import annotations

import logging
import os
import sys
import time
import traceback
import warnings
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import pytz
from kiteconnect import KiteConnect, KiteTicker

from shared.intraday_spreads_state import spread_state

warnings.simplefilter(action="ignore", category=FutureWarning)

STRATEGY_NAME = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
INDEX_NAME = "STOCKS"
SPREAD_TYPE = "intraday_stock_signal"

REGIME_FILE_CANDIDATES = ["data/regime_upside_latest.csv", "backend/data/regime_upside_latest.csv"]
INSTRUMENT_FILE_CANDIDATES = [
    "data/inst_zerodha_eq.csv",
    "data/inst_zerodha_nse.csv",
    "data/inst_zerodha.csv",
    "data/inst_zerodha_nfo.csv",
    "backend/data/inst_zerodha_eq.csv",
    "backend/data/inst_zerodha_nse.csv",
    "backend/data/inst_zerodha.csv",
    "backend/data/inst_zerodha_nfo.csv",
]

FAST_EMA_SPAN = 500
SLOW_EMA_SPAN = 3000
MIN_TICKS_FOR_SIGNAL = SLOW_EMA_SPAN

MARKET_OPEN_HOUR = 10
MARKET_OPEN_MINUTE = 0
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

UPSIDE_TARGET_PCT = 0.017
UPSIDE_STOP_LOSS_PCT = 0.01

LOG_FILE_NAME = "lightnin_bull_upside_intraday_signal.log"
IST = pytz.timezone("Asia/Kolkata")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.FileHandler(LOG_FILE_NAME, mode="a", encoding="utf-8"), logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("lightnin_bull_upside_intraday_signal")


def log_and_print(msg: str, level: str = "info") -> None:
    stamp = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp} IST] {msg}"
    print(line)
    getattr(logger, level if level in {"info", "warning", "error", "debug"} else "info")(line)


def current_ist() -> datetime:
    return datetime.now(IST)


def get_market_open_close_ist(ref: Optional[datetime] = None) -> tuple[datetime, datetime]:
    now_ist = ref or current_ist()
    return (
        now_ist.replace(hour=MARKET_OPEN_HOUR, minute=MARKET_OPEN_MINUTE, second=0, microsecond=0),
        now_ist.replace(hour=MARKET_CLOSE_HOUR, minute=MARKET_CLOSE_MINUTE, second=0, microsecond=0),
    )


def is_weekday_ist(ref: Optional[datetime] = None) -> bool:
    return (ref or current_ist()).weekday() < 5


def market_status_ist(ref: Optional[datetime] = None) -> str:
    now_ist = ref or current_ist()
    if not is_weekday_ist(now_ist):
        return "CLOSED_WEEKEND"
    market_open, market_close = get_market_open_close_ist(now_ist)
    if now_ist < market_open:
        return "WAITING_START_TIME"
    if now_ist >= market_close:
        return "CLOSED_DAY"
    return "OPEN"


def publish_strategy_state(
    *,
    strategy_name: str,
    index_name: str,
    spread_type: str,
    ui_state: str,
    message: str,
    progress_text: str | None = None,
    is_loading: bool = False,
    extra: dict | None = None,
) -> None:
    payload = {
        "index": index_name,
        "spread_type": spread_type,
        "strategy_name": strategy_name,
        "status": ui_state,
        "ui_state": ui_state,
        "message": message,
        "progress_text": progress_text,
        "is_loading": is_loading,
        "updated_at": current_ist().isoformat(),
        "updated_at_ist": current_ist().strftime("%Y-%m-%d %H:%M:%S"),
        "net_pnl": 0.0,
        "signals": [],
    }
    if extra:
        payload.update(extra)
    spread_state.update(strategy_name, payload)


def wait_until_market_open() -> bool:
    while True:
        now_ist = current_ist()
        status = market_status_ist(now_ist)
        market_open, _ = get_market_open_close_ist(now_ist)
        if status == "OPEN":
            log_and_print("Market window is open. Starting upside stock signal engine.")
            return True
        if status in {"CLOSED_WEEKEND", "CLOSED_DAY"}:
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="STOPPED",
                message="Trading window closed / inactive.",
                progress_text="Stopped",
                is_loading=False,
            )
            return False
        remaining = max(int((market_open - now_ist).total_seconds()), 1)
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_START_TIME",
            message="Upside stock signal will start at 10:00 AM IST.",
            progress_text=f"Start in {remaining} seconds",
            is_loading=True,
        )
        time.sleep(min(remaining, 30))


def load_creds() -> dict:
    return {"z_api_key": os.environ["Z_API_KEY"].strip(), "z_access_token": os.environ["Z_ACCESS_TOKEN"].strip()}


def resolve_existing_file(candidates: list[str], label: str) -> str:
    checked: list[str] = []
    for candidate in candidates:
        path = Path(candidate)
        checked.append(str(path.resolve()))
        if path.exists():
            log_and_print(f"Using {label} file: {path.resolve()}")
            return str(path)
    raise FileNotFoundError(f"No {label} file found. Checked: {checked}")


def load_signal_tokens() -> pd.DataFrame:
    regime_file_path = resolve_existing_file(REGIME_FILE_CANDIDATES, "upside regime")
    instrument_file_path = resolve_existing_file(INSTRUMENT_FILE_CANDIDATES, "instrument")
    regime_df = pd.read_csv(regime_file_path)
    inst_df = pd.read_csv(instrument_file_path)

    symbol_col = next((c for c in ["symbol", "Symbol", "stock", "Stock", "tradingsymbol", "TradingSymbol", "ticker", "Ticker"] if c in regime_df.columns), None)
    if symbol_col is None:
        raise ValueError(f"Could not find regime symbol column. Available columns: {regime_df.columns.tolist()}")

    regime_symbols = regime_df[symbol_col].astype(str).str.strip().str.upper().dropna().unique().tolist()
    if not regime_symbols:
        raise ValueError("No symbols found in regime upside file.")

    required_cols = ["instrument_token", "exchange_token", "tradingsymbol", "name", "instrument_type", "segment", "exchange"]
    missing_cols = [col for col in required_cols if col not in inst_df.columns]
    if missing_cols:
        raise ValueError(f"Missing columns in instrument file: {missing_cols}")

    inst_df["tradingsymbol"] = inst_df["tradingsymbol"].astype(str).str.strip().str.upper()
    inst_df["exchange"] = inst_df["exchange"].astype(str).str.strip().str.upper()
    inst_df["segment"] = inst_df["segment"].astype(str).str.strip().str.upper()
    inst_df["instrument_type"] = inst_df["instrument_type"].astype(str).str.strip().str.upper()

    equity_df = inst_df[(inst_df["exchange"] == "NSE") & (inst_df["segment"] == "NSE") & (inst_df["instrument_type"] == "EQ")].copy()
    if equity_df.empty:
        equity_df = inst_df[inst_df["exchange"] == "NSE"].copy()

    matched_df = equity_df[equity_df["tradingsymbol"].isin(regime_symbols)].copy()
    if matched_df.empty:
        raise ValueError("No matching upside regime symbols found in NSE equity instruments.")

    matched_df = matched_df[required_cols].drop_duplicates(subset=["tradingsymbol"]).reset_index(drop=True)
    matched_df = matched_df.rename(columns={"tradingsymbol": "symbol"})
    log_and_print(f"Matched {len(matched_df)} upside regime stocks with NSE cash tokens.")
    return matched_df


@dataclass
class StockSignalState:
    symbol: str
    instrument_token: int
    name: Optional[str] = None
    signal_status: str = "WAITING"
    paper_trade: bool = False
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
    tick_count: int = 0


class EMAState:
    def __init__(self, fast_span: int, slow_span: int):
        self.fast_alpha = 2 / (fast_span + 1)
        self.slow_alpha = 2 / (slow_span + 1)
        self.fast_ema: Optional[float] = None
        self.slow_ema: Optional[float] = None
        self.prev_fast_ema: Optional[float] = None
        self.prev_slow_ema: Optional[float] = None
        self.tick_count: int = 0

    def update(self, price: float) -> None:
        self.tick_count += 1
        self.prev_fast_ema = self.fast_ema
        self.prev_slow_ema = self.slow_ema
        self.fast_ema = price if self.fast_ema is None else (price * self.fast_alpha) + (self.fast_ema * (1 - self.fast_alpha))
        self.slow_ema = price if self.slow_ema is None else (price * self.slow_alpha) + (self.slow_ema * (1 - self.slow_alpha))

    def is_ready(self) -> bool:
        return self.tick_count >= MIN_TICKS_FOR_SIGNAL

    def bullish_crossover(self) -> bool:
        if not self.is_ready():
            return False
        if None in (self.prev_fast_ema, self.prev_slow_ema, self.fast_ema, self.slow_ema):
            return False
        return self.prev_fast_ema <= self.prev_slow_ema and self.fast_ema > self.slow_ema


class LightninBullUpsideIntradaySignal:
    def __init__(self, cred: dict, regime_tokens_df: pd.DataFrame):
        self.cred = cred
        self.ws: Optional[KiteTicker] = None
        self.is_running = False
        self.last_publish_time = 0.0
        self.token_to_symbol: dict[int, str] = {}
        self.ema_states: dict[int, EMAState] = {}
        self.signal_states: dict[int, StockSignalState] = {}

        for _, row in regime_tokens_df.iterrows():
            token = int(row["instrument_token"])
            symbol = str(row["symbol"]).strip().upper()
            name = str(row["name"]).strip() if "name" in row and pd.notna(row["name"]) else None
            self.token_to_symbol[token] = symbol
            self.ema_states[token] = EMAState(FAST_EMA_SPAN, SLOW_EMA_SPAN)
            self.signal_states[token] = StockSignalState(symbol=symbol, instrument_token=token, name=name)
        log_and_print(f"Initialized {len(self.signal_states)} upside regime stocks with EMA{FAST_EMA_SPAN}/EMA{SLOW_EMA_SPAN}. Waiting {MIN_TICKS_FOR_SIGNAL} ticks before allowing entries.")

    def _build_frontend_payload(self, ui_state: str = "RUNNING", message: str = "Monitoring upside regime stocks.") -> dict:
        signals = [asdict(s) for s in self.signal_states.values() if s.signal_status != "WAITING"]
        active_count = sum(1 for s in signals if s["signal_status"] == "ENTERED")
        target_hit_count = sum(1 for s in signals if s["signal_status"] == "TARGET_HIT")
        stop_loss_hit_count = sum(1 for s in signals if s["signal_status"] == "STOP_LOSS_HIT")
        return {
            "index": INDEX_NAME,
            "spread_type": SPREAD_TYPE,
            "strategy_name": STRATEGY_NAME,
            "status": ui_state,
            "ui_state": ui_state,
            "message": message,
            "progress_text": f"{active_count} active, {target_hit_count} target hit, {stop_loss_hit_count} stop loss hit",
            "is_loading": False,
            "updated_at": current_ist().isoformat(),
            "updated_at_ist": current_ist().strftime("%Y-%m-%d %H:%M:%S"),
            "signals": sorted(signals, key=lambda x: x["symbol"]),
            "net_pnl": 0.0,
            "entered_count": len(signals),
            "active_count": active_count,
            "target_hit_count": target_hit_count,
            "stop_loss_hit_count": stop_loss_hit_count,
            "total_count": len(self.signal_states),
            "fast_ema_span": FAST_EMA_SPAN,
            "slow_ema_span": SLOW_EMA_SPAN,
            "min_ticks_for_signal": MIN_TICKS_FOR_SIGNAL,
            "target_pct": UPSIDE_TARGET_PCT * 100,
            "stop_loss_pct": UPSIDE_STOP_LOSS_PCT * 100,
        }

    def _publish(self, force: bool = False) -> None:
        now = time.time()
        if not force and now - self.last_publish_time < 1.0:
            return
        spread_state.update(STRATEGY_NAME, self._build_frontend_payload())
        self.last_publish_time = now

    def _enter_trade(self, state: StockSignalState, ltp: float) -> None:
        entry = round(float(ltp), 2)
        state.signal_status = "ENTERED"
        state.paper_trade = True
        state.entry_time = current_ist().strftime("%H:%M:%S")
        state.avg_price = entry
        state.entry_price = entry
        state.current_ltp = entry
        state.target_price = round(entry * (1 + UPSIDE_TARGET_PCT), 2)
        state.stop_loss_price = round(entry * (1 - UPSIDE_STOP_LOSS_PCT), 2)
        state.pnl_points = 0.0
        state.pnl_pct = 0.0
        log_and_print(f"UPSIDE TRUE CROSSOVER ENTRY | {state.symbol} | entry={entry:.2f} | target={state.target_price:.2f} | stop_loss={state.stop_loss_price:.2f} | ticks={state.tick_count}")

    def _exit_trade(self, state: StockSignalState, ltp: float, reason: str) -> None:
        if state.entry_price is None:
            return
        exit_price = round(float(ltp), 2)
        state.signal_status = "TARGET_HIT" if reason == "TARGET" else "STOP_LOSS_HIT"
        state.exit_reason = reason
        state.exit_time = current_ist().strftime("%H:%M:%S")
        state.exit_price = exit_price
        state.current_ltp = exit_price
        pnl_points = exit_price - float(state.entry_price)
        state.pnl_points = round(pnl_points, 2)
        state.pnl_pct = round((pnl_points / float(state.entry_price)) * 100, 2)
        log_and_print(f"UPSIDE EXIT | {state.symbol} | reason={reason} | exit={exit_price:.2f} | pnl_pct={state.pnl_pct:.2f}%")

    def _handle_tick(self, token: int, ltp: float) -> None:
        if token not in self.ema_states:
            return
        ema = self.ema_states[token]
        state = self.signal_states[token]
        ema.update(float(ltp))
        state.tick_count = ema.tick_count
        state.current_ltp = round(float(ltp), 2)
        state.fast_ema = round(float(ema.fast_ema), 4) if ema.fast_ema is not None else None
        state.slow_ema = round(float(ema.slow_ema), 4) if ema.slow_ema is not None else None

        log_and_print(
            f"UPSIDE TICK | {state.symbol} | LTP={state.current_ltp:.2f} | ticks={state.tick_count}/{MIN_TICKS_FOR_SIGNAL} | EMA{FAST_EMA_SPAN}={state.fast_ema} | EMA{SLOW_EMA_SPAN}={state.slow_ema} | status={state.signal_status}"
        )

        if state.signal_status == "ENTERED":
            if state.target_price is not None and float(ltp) >= float(state.target_price):
                self._exit_trade(state, float(ltp), "TARGET")
            elif state.stop_loss_price is not None and float(ltp) <= float(state.stop_loss_price):
                self._exit_trade(state, float(ltp), "STOP_LOSS")
            return
        if state.signal_status != "WAITING":
            return
        if ema.bullish_crossover():
            self._enter_trade(state, float(ltp))

    def start(self) -> None:
        tokens = list(self.token_to_symbol.keys())
        if not tokens:
            raise ValueError("No instrument tokens available for websocket subscription.")
        self.ws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.is_running = True
        spread_state.update(STRATEGY_NAME, self._build_frontend_payload("BOOTING", "Preparing upside signal engine."))

        def on_ticks(ws, ticks):
            if not self.is_running:
                return
            if market_status_ist() != "OPEN":
                self.stop()
                spread_state.update(STRATEGY_NAME, self._build_frontend_payload("STOPPED", "Trading window closed."))
                return
            for tick in ticks:
                token = tick.get("instrument_token")
                ltp = tick.get("last_price")
                if token is None or ltp is None or ltp <= 0:
                    continue
                try:
                    self._handle_tick(int(token), float(ltp))
                except Exception as exc:
                    log_and_print(f"Upside tick error for token={token}: {exc}", "error")
            self._publish()

        def on_connect(ws, response):
            log_and_print(f"Connected to upside websocket. Subscribing {len(tokens)} NSE cash tokens.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)
            spread_state.update(STRATEGY_NAME, self._build_frontend_payload("RUNNING", "Live feed connected. Waiting for true EMA crossover entries."))

        def on_close(ws, code, reason):
            log_and_print(f"Upside WebSocket closed: {code} - {reason}", "warning")
            self.is_running = False

        def on_error(ws, code, reason):
            log_and_print(f"Upside WebSocket error: {code} - {reason}", "error")
            self.stop()
            spread_state.update(STRATEGY_NAME, self._build_frontend_payload("ERROR", f"WebSocket error: {reason}"))

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
                tokens = list(self.token_to_symbol.keys())
                if tokens:
                    try:
                        self.ws.unsubscribe(tokens)
                    except Exception:
                        pass
                self.ws.close()
        except Exception as exc:
            log_and_print(f"Error while closing upside websocket: {exc}", "error")


def main() -> None:
    log_and_print("Upside stock signal main() entered")
    try:
        if not wait_until_market_open():
            return
        cred = load_creds()
        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("Kite authenticated successfully.")
        regime_tokens_df = load_signal_tokens()
        LightninBullUpsideIntradaySignal(cred=cred, regime_tokens_df=regime_tokens_df).start()
    except Exception as exc:
        log_and_print(f"Upside strategy failed: {exc}", "error")
        log_and_print(traceback.format_exc(), "error")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ERROR",
            message=f"Upside strategy failed: {exc}",
            progress_text="Check Render logs",
            is_loading=False,
        )


if __name__ == "__main__":
    main()
