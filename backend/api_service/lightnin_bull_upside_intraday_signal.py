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


# =========================================================
# ===================== CONFIG ============================
# =========================================================
STRATEGY_NAME = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
INDEX_NAME = "STOCKS"
SPREAD_TYPE = "intraday_stock_signal"

REGIME_FILE_CANDIDATES = [
    "data/regime_upside_latest.csv",
    "backend/data/regime_upside_latest.csv",
]

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
SLOW_EMA_SPAN = 1500

# IMPORTANT: stock signal evaluation starts only from 10:00 AM IST.
MARKET_OPEN_HOUR = 10
MARKET_OPEN_MINUTE = 0
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

LOG_FILE_NAME = "lightnin_bull_upside_intraday_signal.log"
IST = pytz.timezone("Asia/Kolkata")


# =========================================================
# ===================== LOGGING ===========================
# =========================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_NAME, mode="a", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("lightnin_bull_upside_intraday_signal")


def log_and_print(msg: str, level: str = "info") -> None:
    stamp = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp} IST] {msg}"
    print(line)
    getattr(logger, level if level in {"info", "warning", "error", "debug"} else "info")(line)


# =========================================================
# ===================== FRONTEND STATE ====================
# =========================================================
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
        "updated_at": datetime.now(IST).isoformat(),
        "updated_at_ist": datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S"),
        "net_pnl": 0.0,
        "signals": [],
    }

    if extra:
        payload.update(extra)

    spread_state.update(strategy_name, payload)


# =========================================================
# ===================== TIME GUARD ========================
# =========================================================
def current_ist() -> datetime:
    return datetime.now(IST)


def get_market_open_close_ist(ref: Optional[datetime] = None) -> tuple[datetime, datetime]:
    now_ist = ref or current_ist()
    market_open = now_ist.replace(
        hour=MARKET_OPEN_HOUR,
        minute=MARKET_OPEN_MINUTE,
        second=0,
        microsecond=0,
    )
    market_close = now_ist.replace(
        hour=MARKET_CLOSE_HOUR,
        minute=MARKET_CLOSE_MINUTE,
        second=0,
        microsecond=0,
    )
    return market_open, market_close


def is_weekday_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    return now_ist.weekday() < 5


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


def wait_until_market_open() -> bool:
    while True:
        now_ist = current_ist()
        status = market_status_ist(now_ist)
        market_open, _ = get_market_open_close_ist(now_ist)

        if status == "OPEN":
            log_and_print("Market window is open. Starting upside stock signal engine.")
            return True

        if status == "CLOSED_WEEKEND":
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="STOPPED",
                message="Upside stock signal inactive outside working days.",
                progress_text="Stopped",
                is_loading=False,
            )
            return False

        if status == "CLOSED_DAY":
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="STOPPED",
                message="Trading window closed for the day.",
                progress_text="Stopped after 3:30 PM IST",
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
        log_and_print(f"Waiting until 10:00 AM IST. Remaining seconds={remaining}")
        time.sleep(min(remaining, 30))


def load_creds() -> dict:
    return {
        "z_api_key": os.environ["Z_API_KEY"].strip(),
        "z_access_token": os.environ["Z_ACCESS_TOKEN"].strip(),
    }


def resolve_existing_file(candidates: list[str], label: str) -> str:
    checked: list[str] = []
    for candidate in candidates:
        path = Path(candidate)
        checked.append(str(path.resolve()))
        if path.exists():
            log_and_print(f"Using {label} file: {path.resolve()}")
            return str(path)

    raise FileNotFoundError(f"No {label} file found. Checked: {checked}")


# =========================================================
# ===================== DATA PREP =========================
# =========================================================
def load_signal_tokens() -> pd.DataFrame:
    regime_file_path = resolve_existing_file(REGIME_FILE_CANDIDATES, "upside regime")
    instrument_file_path = resolve_existing_file(INSTRUMENT_FILE_CANDIDATES, "instrument")

    regime_df = pd.read_csv(regime_file_path)
    inst_df = pd.read_csv(instrument_file_path)

    possible_regime_symbol_cols = [
        "symbol",
        "Symbol",
        "stock",
        "Stock",
        "tradingsymbol",
        "TradingSymbol",
        "ticker",
        "Ticker",
    ]
    regime_symbol_col = next((c for c in possible_regime_symbol_cols if c in regime_df.columns), None)

    if regime_symbol_col is None:
        raise ValueError(f"Could not find regime symbol column. Available columns: {regime_df.columns.tolist()}")

    regime_symbols = (
        regime_df[regime_symbol_col]
        .astype(str)
        .str.strip()
        .str.upper()
        .dropna()
        .unique()
        .tolist()
    )

    if not regime_symbols:
        raise ValueError("No symbols found in regime upside file.")

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
        log_and_print("No strict NSE EQ rows found. Falling back to all NSE rows.", "warning")
        equity_df = inst_df[inst_df["exchange"] == "NSE"].copy()

    matched_df = equity_df[equity_df["tradingsymbol"].isin(regime_symbols)].copy()

    if matched_df.empty:
        raise ValueError(
            "No matching upside regime symbols found in NSE equity instruments. "
            f"Sample regime={regime_symbols[:10]} sample instruments={equity_df['tradingsymbol'].head(10).tolist()}"
        )

    matched_df = matched_df[
        ["instrument_token", "exchange_token", "tradingsymbol", "name", "instrument_type", "segment", "exchange"]
    ].drop_duplicates(subset=["tradingsymbol"]).reset_index(drop=True)

    matched_df = matched_df.rename(columns={"tradingsymbol": "symbol"})
    log_and_print(f"Matched {len(matched_df)} upside regime stocks with NSE cash tokens.")
    return matched_df


# =========================================================
# ===================== SIGNAL STATE ======================
# =========================================================
@dataclass
class StockSignalState:
    symbol: str
    instrument_token: int
    name: Optional[str] = None
    signal_status: str = "WAITING"
    paper_trade: bool = False
    entry_time: Optional[str] = None
    avg_price: Optional[float] = None
    current_ltp: Optional[float] = None
    max_ltp: Optional[float] = None
    points_captured: Optional[float] = None
    pct_captured: Optional[float] = None
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
            self.fast_ema = (price * self.fast_alpha) + (self.fast_ema * (1 - self.fast_alpha))

        if self.slow_ema is None:
            self.slow_ema = price
        else:
            self.slow_ema = (price * self.slow_alpha) + (self.slow_ema * (1 - self.slow_alpha))

    def bullish_crossover(self) -> bool:
        if None in (self.prev_fast_ema, self.prev_slow_ema, self.fast_ema, self.slow_ema):
            return False
        return self.prev_fast_ema <= self.prev_slow_ema and self.fast_ema > self.slow_ema


# =========================================================
# ===================== ENGINE ============================
# =========================================================
class LightninBullUpsideIntradaySignal:
    def __init__(self, cred: dict, regime_tokens_df: pd.DataFrame):
        self.cred = cred
        self.regime_tokens_df = regime_tokens_df.copy()
        self.fast_span = FAST_EMA_SPAN
        self.slow_span = SLOW_EMA_SPAN
        self.ws: Optional[KiteTicker] = None
        self.is_running = False
        self.last_publish_time = 0.0
        self.token_to_symbol: dict[int, str] = {}
        self.ema_states: dict[int, EMAState] = {}
        self.signal_states: dict[int, StockSignalState] = {}
        self._initialize_states()

    def _initialize_states(self) -> None:
        for _, row in self.regime_tokens_df.iterrows():
            token = int(row["instrument_token"])
            symbol = str(row["symbol"]).strip().upper()
            name = str(row["name"]).strip() if "name" in row and pd.notna(row["name"]) else None
            self.token_to_symbol[token] = symbol
            self.ema_states[token] = EMAState(self.fast_span, self.slow_span)
            self.signal_states[token] = StockSignalState(symbol=symbol, instrument_token=token, name=name)
        log_and_print(f"Initialized {len(self.signal_states)} upside regime stocks.")

    def _build_frontend_payload(
        self,
        *,
        ui_state: str = "RUNNING",
        message: str = "Monitoring upside regime stocks for bullish EMA crossover.",
        progress_text: str | None = None,
        is_loading: bool = False,
    ) -> dict:
        # CRITICAL: frontend receives ONLY ENTERED stocks, never the full 20-stock universe.
        signals = [asdict(state) for state in self.signal_states.values() if state.signal_status == "ENTERED"]
        signals = sorted(signals, key=lambda x: x["symbol"])
        entered_count = len(signals)

        return {
            "index": INDEX_NAME,
            "spread_type": SPREAD_TYPE,
            "strategy_name": STRATEGY_NAME,
            "status": ui_state,
            "ui_state": ui_state,
            "message": message,
            "progress_text": progress_text or f"{entered_count} entered out of {len(self.signal_states)} stocks",
            "is_loading": is_loading,
            "updated_at": current_ist().isoformat(),
            "updated_at_ist": current_ist().strftime("%Y-%m-%d %H:%M:%S"),
            "signals": signals,
            "net_pnl": 0.0,
            "entered_count": entered_count,
            "total_count": len(self.signal_states),
            "fast_ema_span": self.fast_span,
            "slow_ema_span": self.slow_span,
        }

    def _publish(self, force: bool = False) -> None:
        now = time.time()
        if not force and (now - self.last_publish_time < 1.0):
            return
        spread_state.update(STRATEGY_NAME, self._build_frontend_payload())
        self.last_publish_time = now

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
            signal_state.max_ltp = round(max(float(signal_state.max_ltp or ltp), float(ltp)), 2)
            if signal_state.avg_price is not None:
                points = float(signal_state.max_ltp) - float(signal_state.avg_price)
                signal_state.points_captured = round(points, 2)
                signal_state.pct_captured = round((points / float(signal_state.avg_price)) * 100, 2) if signal_state.avg_price else 0.0
            return

        if ema_state.bullish_crossover():
            signal_state.signal_status = "ENTERED"
            signal_state.paper_trade = True
            signal_state.entry_time = current_ist().strftime("%H:%M:%S")
            signal_state.avg_price = round(float(ltp), 2)
            signal_state.max_ltp = round(float(ltp), 2)
            signal_state.points_captured = 0.0
            signal_state.pct_captured = 0.0
            log_and_print(
                f"UPSIDE ENTRY | {signal_state.symbol} | avg_price={signal_state.avg_price:.2f} | "
                f"fast_ema={signal_state.fast_ema} | slow_ema={signal_state.slow_ema}"
            )

    def start(self) -> None:
        tokens = list(self.token_to_symbol.keys())
        if not tokens:
            raise ValueError("No instrument tokens available for websocket subscription.")

        self.ws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.is_running = True

        spread_state.update(
            STRATEGY_NAME,
            self._build_frontend_payload(
                ui_state="BOOTING",
                message="Starting intraday upside stock signal engine.",
                progress_text=f"Preparing {len(tokens)} regime upside stocks",
                is_loading=True,
            ),
        )

        def on_ticks(ws, ticks):
            if not self.is_running:
                return

            status = market_status_ist()
            if status != "OPEN":
                log_and_print(f"Market status={status}. Stopping upside stock signal engine.")
                self.stop()
                spread_state.update(
                    STRATEGY_NAME,
                    self._build_frontend_payload(
                        ui_state="STOPPED",
                        message="Trading window closed for the day.",
                        progress_text="Stopped",
                        is_loading=False,
                    ),
                )
                return

            for tick in ticks:
                token = tick.get("instrument_token")
                ltp = tick.get("last_price")
                if token is None or ltp is None or ltp <= 0:
                    continue
                try:
                    self._handle_tick(int(token), float(ltp))
                except Exception as exc:
                    log_and_print(f"Tick error for token={token}: {exc}", "error")

            self._publish()

        def on_connect(ws, response):
            log_and_print(f"Connected to websocket. Subscribing {len(tokens)} NSE cash tokens.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)
            spread_state.update(
                STRATEGY_NAME,
                self._build_frontend_payload(
                    ui_state="RUNNING",
                    message="Live feed connected. Monitoring upside crossover signals.",
                    progress_text=f"Subscribed {len(tokens)} stocks. Waiting for entries.",
                    is_loading=False,
                ),
            )

        def on_close(ws, code, reason):
            log_and_print(f"WebSocket closed: {code} - {reason}", "warning")
            self.is_running = False

        def on_error(ws, code, reason):
            log_and_print(f"WebSocket error: {code} - {reason}", "error")
            self.stop()
            spread_state.update(
                STRATEGY_NAME,
                self._build_frontend_payload(
                    ui_state="ERROR",
                    message=f"WebSocket error: {reason}",
                    progress_text="WebSocket stopped safely",
                    is_loading=False,
                ),
            )

        self.ws.on_ticks = on_ticks
        self.ws.on_connect = on_connect
        self.ws.on_close = on_close
        self.ws.on_error = on_error

        self._publish(force=True)
        self.ws.connect(threaded=True)

        # Keep this strategy thread alive while websocket is running.
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
            log_and_print(f"Error while closing websocket: {exc}", "error")


# =========================================================
# ===================== MAIN ==============================
# =========================================================
def main() -> None:
    log_and_print("Upside stock signal main() entered")

    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="BOOTING",
        message="Upside stock signal process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    try:
        if not wait_until_market_open():
            return

        cred = load_creds()
        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("Kite authenticated successfully.")

        regime_tokens_df = load_signal_tokens()
        engine = LightninBullUpsideIntradaySignal(cred=cred, regime_tokens_df=regime_tokens_df)
        engine.start()
        log_and_print("Upside intraday stock signal engine stopped.")

    except Exception as exc:
        log_and_print(f"Main execution failed: {exc}", "error")
        log_and_print(traceback.format_exc(), "error")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ERROR",
            message=f"Upside strategy failed: {str(exc)}",
            progress_text="Check Render logs",
            is_loading=False,
        )


if __name__ == "__main__":
    main()
