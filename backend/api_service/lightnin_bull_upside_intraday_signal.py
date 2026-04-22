from __future__ import annotations

import warnings
warnings.simplefilter(action="ignore", category=FutureWarning)

import logging
import os
import sys
import time
import traceback
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional

import pandas as pd
import pytz
from kiteconnect import KiteConnect, KiteTicker

from shared.intraday_spreads_state import spread_state


# =========================================================
# ===================== CONFIG ============================
# =========================================================
STRATEGY_NAME = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
INDEX_NAME = "STOCKS"
SPREAD_TYPE = "intraday_stock_signal"

REGIME_FILE_PATH = "backend/data/regime_upside_latest.csv"
INSTRUMENT_FILE_PATH = "backend/data/inst_zerodha_nfo.csv"

FAST_EMA_SPAN = 500
SLOW_EMA_SPAN = 1500

MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
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
    line = f"[{stamp}] {msg}"
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
        "net_pnl": 0.0,
        "signals": [],
    }

    if extra:
        payload.update(extra)

    spread_state.update(strategy_name, payload)


# =========================================================
# ===================== UTILITIES =========================
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


def is_after_market_close_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    _, market_close = get_market_open_close_ist(now_ist)
    return now_ist > market_close


def wait_until_market_open() -> None:
    now_ist = current_ist()
    market_open, market_close = get_market_open_close_ist(now_ist)

    if now_ist > market_close:
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Trading window closed for the day.",
            is_loading=False,
        )
        raise SystemExit

    if now_ist >= market_open:
        log_and_print("Market is already open. Starting now.")
        return

    sleep_seconds = int((market_open - now_ist).total_seconds())
    log_and_print(f"Waiting for market open. Start in {sleep_seconds} seconds.")

    for remaining in range(sleep_seconds, 0, -1):
        if remaining % 5 == 0 or remaining <= 10:
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_START_TIME",
                message=f"Waiting until {market_open.strftime('%H:%M:%S')} IST.",
                progress_text=f"Start in {remaining} seconds",
                is_loading=True,
            )
        time.sleep(1)


def load_creds() -> dict:
    return {
        "z_api_key": os.environ["Z_API_KEY"].strip(),
        "z_access_token": os.environ["Z_ACCESS_TOKEN"].strip(),
    }


# =========================================================
# ===================== DATA PREP =========================
# =========================================================
def load_regime_upside_tokens(
    regime_file_path: str = REGIME_FILE_PATH,
    instrument_file_path: str = INSTRUMENT_FILE_PATH,
) -> pd.DataFrame:
    regime_df = pd.read_csv(regime_file_path)
    inst_df = pd.read_csv(instrument_file_path)

    # -------- regime symbol column --------
    possible_regime_symbol_cols = [
        "symbol", "Symbol", "stock", "Stock", "tradingsymbol", "TradingSymbol", "ticker", "Ticker"
    ]
    regime_symbol_col = next((c for c in possible_regime_symbol_cols if c in regime_df.columns), None)

    if regime_symbol_col is None:
        raise ValueError(
            f"Could not find regime symbol column. Available columns: {regime_df.columns.tolist()}"
        )

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

    # -------- strict NSE cash filter --------
    inst_df["tradingsymbol"] = inst_df["tradingsymbol"].astype(str).str.strip().str.upper()
    inst_df["exchange"] = inst_df["exchange"].astype(str).str.strip().str.upper()
    inst_df["segment"] = inst_df["segment"].astype(str).str.strip().str.upper()
    inst_df["instrument_type"] = inst_df["instrument_type"].astype(str).str.strip().str.upper()

    equity_df = inst_df[
        (inst_df["exchange"] == "NSE") &
        (inst_df["segment"] == "NSE") &
        (inst_df["instrument_type"] == "EQ")
    ].copy()

    matched_df = equity_df[equity_df["tradingsymbol"].isin(regime_symbols)].copy()

    if matched_df.empty:
        raise ValueError(
            "No matching symbols found after filtering exchange='NSE', segment='NSE', instrument_type='EQ'."
        )

    matched_df = matched_df[
        ["instrument_token", "exchange_token", "tradingsymbol", "name", "instrument_type", "segment", "exchange"]
    ].drop_duplicates(subset=["tradingsymbol"]).reset_index(drop=True)

    matched_df = matched_df.rename(columns={"tradingsymbol": "symbol"})

    return matched_df


# =========================================================
# ===================== SIGNAL STATE ======================
# =========================================================
@dataclass
class StockSignalState:
    symbol: str
    instrument_token: int
    name: Optional[str] = None

    signal_status: str = "WAITING"   # WAITING / ENTERED
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
        self.fast_span = fast_span
        self.slow_span = slow_span

        self.fast_alpha = 2 / (fast_span + 1)
        self.slow_alpha = 2 / (slow_span + 1)

        self.fast_ema: Optional[float] = None
        self.slow_ema: Optional[float] = None
        self.prev_fast_ema: Optional[float] = None
        self.prev_slow_ema: Optional[float] = None

    def update(self, price: float) -> None:
        if self.fast_ema is None:
            self.fast_ema = price
        else:
            self.prev_fast_ema = self.fast_ema
            self.fast_ema = (price * self.fast_alpha) + (self.fast_ema * (1 - self.fast_alpha))

        if self.slow_ema is None:
            self.slow_ema = price
        else:
            self.prev_slow_ema = self.slow_ema
            self.slow_ema = (price * self.slow_alpha) + (self.slow_ema * (1 - self.slow_alpha))

    def bullish_crossover(self) -> bool:
        if None in (self.prev_fast_ema, self.prev_slow_ema, self.fast_ema, self.slow_ema):
            return False

        return (
            self.prev_fast_ema <= self.prev_slow_ema
            and self.fast_ema > self.slow_ema
        )


# =========================================================
# ===================== ENGINE ============================
# =========================================================
class LightninBullUpsideIntradaySignal:
    def __init__(
        self,
        kite: KiteConnect,
        cred: dict,
        regime_tokens_df: pd.DataFrame,
        fast_span: int = FAST_EMA_SPAN,
        slow_span: int = SLOW_EMA_SPAN,
    ):
        self.kite = kite
        self.cred = cred
        self.regime_tokens_df = regime_tokens_df.copy()
        self.fast_span = fast_span
        self.slow_span = slow_span

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
            self.signal_states[token] = StockSignalState(
                symbol=symbol,
                instrument_token=token,
                name=name,
            )

        log_and_print(f"Initialized {len(self.signal_states)} upside regime stocks.")

    def _build_frontend_payload(self) -> dict:
        signals = []

        for state in self.signal_states.values():
            signals.append(asdict(state))

        # entered signals first
        signals = sorted(
            signals,
            key=lambda x: (
                0 if x["signal_status"] == "ENTERED" else 1,
                x["symbol"]
            )
        )

        entered_count = sum(1 for x in signals if x["signal_status"] == "ENTERED")

        return {
            "index": INDEX_NAME,
            "spread_type": SPREAD_TYPE,
            "strategy_name": STRATEGY_NAME,
            "status": "RUNNING",
            "ui_state": "RUNNING",
            "message": "Monitoring upside regime stocks for bullish EMA crossover.",
            "progress_text": f"{entered_count} entered out of {len(signals)} stocks",
            "is_loading": False,
            "updated_at": datetime.now(IST).isoformat(),
            "signals": signals,
            "net_pnl": 0.0,
            "entered_count": entered_count,
            "total_count": len(signals),
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

        # already entered -> only track max/high and capture
        if signal_state.signal_status == "ENTERED":
            if signal_state.max_ltp is None:
                signal_state.max_ltp = round(float(ltp), 2)
            else:
                signal_state.max_ltp = round(max(float(signal_state.max_ltp), float(ltp)), 2)

            if signal_state.avg_price is not None and signal_state.max_ltp is not None:
                points = signal_state.max_ltp - signal_state.avg_price
                pct = (points / signal_state.avg_price) * 100 if signal_state.avg_price != 0 else 0.0

                signal_state.points_captured = round(points, 2)
                signal_state.pct_captured = round(pct, 2)

            return

        # first bullish crossover only
        if ema_state.bullish_crossover():
            signal_state.signal_status = "ENTERED"
            signal_state.paper_trade = True
            signal_state.entry_time = datetime.now(IST).strftime("%H:%M:%S")
            signal_state.avg_price = round(float(ltp), 2)
            signal_state.max_ltp = round(float(ltp), 2)
            signal_state.points_captured = 0.0
            signal_state.pct_captured = 0.0

            log_and_print(
                f"UPSIDE ENTRY | {signal_state.symbol} | "
                f"avg_price={signal_state.avg_price:.2f} | "
                f"fast_ema={signal_state.fast_ema} | slow_ema={signal_state.slow_ema}"
            )

    def start(self) -> None:
        tokens = list(self.token_to_symbol.keys())
        if not tokens:
            raise ValueError("No instrument tokens available for websocket subscription.")

        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.ws = kws
        self.is_running = True

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="BOOTING",
            message="Starting intraday upside stock signal engine.",
            progress_text=f"Preparing {len(tokens)} regime upside stocks",
            is_loading=True,
        )

        def on_ticks(ws, ticks):
            if not self.is_running:
                return

            if is_after_market_close_ist():
                log_and_print("Market closed. Stopping stock signal engine.")
                self.stop()
                publish_strategy_state(
                    strategy_name=STRATEGY_NAME,
                    index_name=INDEX_NAME,
                    spread_type=SPREAD_TYPE,
                    ui_state="STOPPED",
                    message="Trading window closed for the day.",
                    is_loading=False,
                    extra=self._build_frontend_payload(),
                )
                return

            for tick in ticks:
                token = tick.get("instrument_token")
                ltp = tick.get("last_price")

                if token is None or ltp is None or ltp <= 0:
                    continue

                try:
                    self._handle_tick(int(token), float(ltp))
                except Exception as e:
                    log_and_print(f"Tick error for token={token}: {e}", "error")

            self._publish()

        def on_connect(ws, response):
            log_and_print(f"Connected to websocket. Subscribing {len(tokens)} NSE cash tokens.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="RUNNING",
                message="Live feed connected. Monitoring upside crossover signals.",
                progress_text=f"Subscribed {len(tokens)} stocks",
                is_loading=False,
                extra=self._build_frontend_payload(),
            )

        def on_close(ws, code, reason):
            log_and_print(f"WebSocket closed: {code} - {reason}", "warning")

        def on_error(ws, code, reason):
            log_and_print(f"WebSocket error: {code} - {reason}", "error")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message=f"WebSocket error: {reason}",
                progress_text="Check backend logs",
                is_loading=False,
            )

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.on_close = on_close
        kws.on_error = on_error

        self._publish(force=True)
        kws.connect(threaded=True)

    def stop(self) -> None:
        self.is_running = False

        try:
            if self.ws is not None:
                tokens = list(self.token_to_symbol.keys())
                if tokens:
                    self.ws.unsubscribe(tokens)
                self.ws.close()
        except Exception as e:
            log_and_print(f"Error while closing websocket: {e}", "error")


# =========================================================
# ===================== MAIN ==============================
# =========================================================
def main() -> None:
    log_and_print("Strategy main() entered")

    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="BOOTING",
        message="Strategy process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    if not is_weekday_ist():
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy inactive outside working days.",
            is_loading=False,
        )
        return

    wait_until_market_open()

    try:
        cred = load_creds()

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("Kite authenticated successfully.")

        regime_tokens_df = load_regime_upside_tokens(
            regime_file_path=REGIME_FILE_PATH,
            instrument_file_path=INSTRUMENT_FILE_PATH,
        )

        log_and_print(f"Matched {len(regime_tokens_df)} regime upside stocks with NSE cash tokens.")

        engine = LightninBullUpsideIntradaySignal(
            kite=kite,
            cred=cred,
            regime_tokens_df=regime_tokens_df,
            fast_span=FAST_EMA_SPAN,
            slow_span=SLOW_EMA_SPAN,
        )

        engine.start()
        log_and_print("Intraday stock signal engine started.")

    except SystemExit:
        log_and_print("Exited after execution.")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy stopped manually.",
            is_loading=False,
        )

    except Exception as e:
        log_and_print(f"Main execution failed: {e}", "error")
        log_and_print(traceback.format_exc(), "error")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ERROR",
            message=f"Strategy failed: {str(e)}",
            progress_text="Check logs",
            is_loading=False,
        )


if __name__ == "__main__":
    main()
