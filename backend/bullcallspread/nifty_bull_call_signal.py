from __future__ import annotations

import warnings
warnings.simplefilter(action="ignore", category=FutureWarning)

import logging
import os
import sys
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import pytz
from kiteconnect import KiteConnect, KiteTicker

from shared.intraday_spreads_state import spread_state

# =========================================================
# ========== CONFIGURATION: CHANGE FROM HERE ==============
# =========================================================
INDEX_NAME = "NIFTY"
SPREAD_TYPE = "bull_call"
STRATEGY_NAME = "ALPHA_BULL_PAPER"

NIFTY_SPOT_TOKEN = 256265
PRELOAD_DAYS = 2
QUANTITY = 65

STOP_LOSS_AMOUNT = -1500.0
TARGET_AMOUNT = 3000.0

MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 20
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

LOG_FILE_NAME = "bull_call_spread.log"

IST = pytz.timezone("Asia/Kolkata")

STRATEGY_RUN_LOCK = threading.Lock()
STRATEGY_ALREADY_STARTED = False

# =========================================================
# ===================== Logging ===========================
# =========================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_NAME, mode="a", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("alpha_bull_strategy")


def log_and_print(msg: str, level: str = "info") -> None:
    stamp = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] {msg}"
    print(line)
    getattr(logger, level if level in {"info", "warning", "error", "debug"} else "info")(line)


# =========================================================
# ===================== Frontend Payload ==================
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
        "stop_loss": STOP_LOSS_AMOUNT,
        "target": TARGET_AMOUNT,
        "legs": [],
    }

    if extra:
        payload.update(extra)

    spread_state.update(strategy_name, payload)


def build_spread_payload(
    *,
    paper_book: "PaperOrderBook",
    index_name: str,
    spread_type: str,
    strategy_name: str,
    stop_loss_amount: float,
    target_amount: float,
) -> dict:
    orders = paper_book.get_orders_snapshot()

    buy_leg = next((o for o in orders if o["side"] == "BUY"), None)
    sell_leg = next((o for o in orders if o["side"] == "SELL"), None)

    net_pnl = round(sum(o.get("pnl", 0.0) for o in orders), 2)

    status = "OPEN"
    if orders and all(o.get("status") == "CLOSED" for o in orders):
        status = "CLOSED"
    elif not orders:
        status = "NO_POSITION"

    if status == "OPEN":
        message = "Debit spread is live."
        is_loading = False
    elif status == "CLOSED":
        message = "Debit spread closed."
        is_loading = False
    else:
        message = "Monitoring market conditions for bullish entry trigger..."
        is_loading = True

    return {
        "index": index_name,
        "spread_type": spread_type,
        "strategy_name": strategy_name,
        "status": status,
        "ui_state": status,
        "message": message,
        "progress_text": None,
        "is_loading": is_loading,
        "net_pnl": net_pnl,
        "stop_loss": stop_loss_amount,
        "target": target_amount,
        "updated_at": datetime.now(IST).isoformat(),
        "legs": [
            {
                "side": buy_leg["side"] if buy_leg else None,
                "trading_symbol": buy_leg["trading_symbol"] if buy_leg else None,
                "avg_price": round(float(buy_leg["entry_price"]), 2) if buy_leg else None,
                "ltp": round(float(buy_leg["ltp"]), 2) if buy_leg else None,
                "pnl": round(float(buy_leg["pnl"]), 2) if buy_leg else None,
                "quantity": int(buy_leg["quantity"]) if buy_leg else None,
                "strike": int(buy_leg["strike"]) if buy_leg else None,
                "expiry": buy_leg["expiry"] if buy_leg else None,
                "right": buy_leg["right"] if buy_leg else None,
                "status": buy_leg["status"] if buy_leg else None,
            },
            {
                "side": sell_leg["side"] if sell_leg else None,
                "trading_symbol": sell_leg["trading_symbol"] if sell_leg else None,
                "avg_price": round(float(sell_leg["entry_price"]), 2) if sell_leg else None,
                "ltp": round(float(sell_leg["ltp"]), 2) if sell_leg else None,
                "pnl": round(float(sell_leg["pnl"]), 2) if sell_leg else None,
                "quantity": int(sell_leg["quantity"]) if sell_leg else None,
                "strike": int(sell_leg["strike"]) if sell_leg else None,
                "expiry": sell_leg["expiry"] if sell_leg else None,
                "right": sell_leg["right"] if sell_leg else None,
                "status": sell_leg["status"] if sell_leg else None,
            },
        ],
    }


def publish_spread_update(payload: dict) -> None:
    spread_state.update(payload["strategy_name"], payload)


# =========================================================
# ===================== Utilities =========================
# =========================================================
def current_ist() -> datetime:
    return datetime.now(IST)


def get_market_open_close_ist(ref: Optional[datetime] = None) -> tuple[datetime, datetime]:
    now_ist = ref or current_ist()
    open_dt = now_ist.replace(
        hour=MARKET_OPEN_HOUR,
        minute=MARKET_OPEN_MINUTE,
        second=0,
        microsecond=0,
    )
    close_dt = now_ist.replace(
        hour=MARKET_CLOSE_HOUR,
        minute=MARKET_CLOSE_MINUTE,
        second=0,
        microsecond=0,
    )
    return open_dt, close_dt


def is_weekday_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    return now_ist.weekday() < 5  # Monday=0, Friday=4


def is_market_open_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    open_dt, close_dt = get_market_open_close_ist(now_ist)
    return open_dt <= now_ist <= close_dt


def is_after_market_close_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    _, close_dt = get_market_open_close_ist(now_ist)
    return now_ist > close_dt


def resolve_nifty_expiry() -> str:
    """
    Expiry priority:
    1. I_EXPIRY_DATE_NIFTY_OVERRIDE (exact date, e.g. 20260429 or 2026-04-29)
    2. I_EXPIRY_WEEKS_AHEAD (0 = nearest Tuesday, 1 = next week, 2 = third week, ...)
    3. default nearest Tuesday
    """
    override = os.getenv("I_EXPIRY_DATE_NIFTY_OVERRIDE", "").strip()
    if override:
        cleaned = override.replace("-", "")
        datetime.strptime(cleaned, "%Y%m%d")
        return cleaned

    weeks_ahead = int(os.getenv("I_EXPIRY_WEEKS_AHEAD", "0").strip() or "0")
    if weeks_ahead < 0:
        weeks_ahead = 0

    today = current_ist().date()
    days_ahead = (1 - today.weekday()) % 7  # Tuesday is weekday 1
    if days_ahead == 0:
        expiry = today
    else:
        expiry = today + timedelta(days=days_ahead)

    expiry = expiry + timedelta(days=7 * weeks_ahead)
    return expiry.strftime("%Y%m%d")


def load_creds() -> dict:
    """
    Required env vars:
      - Z_API_KEY
      - Z_ACCESS_TOKEN

    Optional:
      - I_EXPIRY_DATE_NIFTY_OVERRIDE
      - I_EXPIRY_WEEKS_AHEAD
    """
    return {
        "z_api_key": os.environ["Z_API_KEY"],
        "z_access_token": os.environ["Z_ACCESS_TOKEN"],
        "i_expiry_date_nifty": resolve_nifty_expiry(),
    }


def wait_until_market_open() -> None:
    now_ist = current_ist()
    open_dt, _ = get_market_open_close_ist(now_ist)

    if now_ist < open_dt:
        sleep_seconds = int((open_dt - now_ist).total_seconds())

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_START_TIME",
            message="Waiting for scheduled trading window...",
            progress_text=f"Start in {sleep_seconds} seconds",
            is_loading=True,
        )

        log_and_print(f"Waiting until {open_dt.strftime('%H:%M:%S')} ({sleep_seconds} seconds)")
        try:
            for remaining in range(sleep_seconds, 0, -1):
                print(f"\rTime left: {timedelta(seconds=remaining)}", end="")
                if remaining % 5 == 0 or remaining <= 10:
                    publish_strategy_state(
                        strategy_name=STRATEGY_NAME,
                        index_name=INDEX_NAME,
                        spread_type=SPREAD_TYPE,
                        ui_state="WAITING_START_TIME",
                        message="Waiting for scheduled trading window...",
                        progress_text=f"Start in {remaining} seconds",
                        is_loading=True,
                    )
                time.sleep(1)
            print()
        except KeyboardInterrupt:
            print("\nCountdown interrupted by user.")
            raise SystemExit
    else:
        log_and_print(f"It's after {open_dt.strftime('%H:%M:%S')} -- running strategy now.")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="BOOTING",
            message="Trading window opened. Initializing strategy...",
            progress_text="Initializing market context...",
            is_loading=True,
        )


def publish_stopped_state(message: str) -> None:
    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="STOPPED",
        message=message,
        progress_text=None,
        is_loading=False,
    )


# =========================================================
# ===================== Paper Order Book ==================
# =========================================================
class PaperOrderBook:
    def __init__(self) -> None:
        self.orders: list[dict] = []
        self.lock = threading.Lock()

    def place_order(
        self,
        strategy_name: str,
        symbol: str,
        strike: int,
        expiry: str,
        side: str,
        quantity: int,
        right: str,
        entry_price: float,
        instrument_token: int,
        trading_symbol: str,
    ) -> str:
        ref_id = f"PAPER-{uuid.uuid4().hex[:10].upper()}"
        order = {
            "reference_id": ref_id,
            "timestamp": current_ist(),
            "strategy_name": strategy_name,
            "symbol": symbol,
            "strike": strike,
            "expiry": expiry,
            "side": side,
            "quantity": quantity,
            "right": right,
            "entry_price": float(entry_price),
            "ltp": float(entry_price),
            "instrument_token": int(instrument_token),
            "status": "FILLED",
            "trading_symbol": trading_symbol,
            "pnl": 0.0,
            "exit_price": None,
            "exit_timestamp": None,
        }

        with self.lock:
            self.orders.append(order)

        log_and_print(
            f"📝 PAPER ORDER | RefID={ref_id} | {side} {quantity} {trading_symbol} | Entry={entry_price:.2f}"
        )
        return ref_id

    def get_all_orders(self) -> pd.DataFrame:
        with self.lock:
            if not self.orders:
                return pd.DataFrame()
            return pd.DataFrame(self.orders)

    def update_ltp_and_pnl(self, instrument_token: int, ltp: float) -> None:
        with self.lock:
            for order in self.orders:
                if order["instrument_token"] == instrument_token:
                    order["ltp"] = float(ltp)

                    if order["side"] == "BUY":
                        order["pnl"] = (order["ltp"] - order["entry_price"]) * order["quantity"]
                    elif order["side"] == "SELL":
                        order["pnl"] = (order["entry_price"] - order["ltp"]) * order["quantity"]

    def total_pnl(self) -> float:
        with self.lock:
            return float(sum(order.get("pnl", 0.0) for order in self.orders))

    def close_all_positions(self) -> None:
        with self.lock:
            now_ts = current_ist()
            for order in self.orders:
                if order["exit_price"] is None:
                    order["exit_price"] = order["ltp"]
                    order["exit_timestamp"] = now_ts
                    order["status"] = "CLOSED"

    def get_orders_snapshot(self) -> list[dict]:
        with self.lock:
            return [order.copy() for order in self.orders]


# =========================================================
# ===================== Live MTM Tracker ==================
# =========================================================
class PaperSpreadMTMTracker:
    def __init__(
        self,
        cred: dict,
        paper_book: PaperOrderBook,
        stop_loss_amount: float = STOP_LOSS_AMOUNT,
        target_amount: float = TARGET_AMOUNT,
        index_name: str = INDEX_NAME,
        spread_type: str = SPREAD_TYPE,
        strategy_name: str = STRATEGY_NAME,
    ):
        self.cred = cred
        self.paper_book = paper_book
        self.stop_loss_amount = float(stop_loss_amount)
        self.target_amount = float(target_amount)
        self.index_name = index_name
        self.spread_type = spread_type
        self.strategy_name = strategy_name
        self.ws: Optional[KiteTicker] = None
        self.is_running = False
        self.last_print_time = 0.0

    def _publish_current_state(self) -> None:
        payload = build_spread_payload(
            paper_book=self.paper_book,
            index_name=self.index_name,
            spread_type=self.spread_type,
            strategy_name=self.strategy_name,
            stop_loss_amount=self.stop_loss_amount,
            target_amount=self.target_amount,
        )
        publish_spread_update(payload)

    def _log_live_mtm(self) -> None:
        orders = self.paper_book.get_orders_snapshot()
        if len(orders) < 2:
            return

        total = self.paper_book.total_pnl()

        buy_leg = next((o for o in orders if o["side"] == "BUY"), None)
        sell_leg = next((o for o in orders if o["side"] == "SELL"), None)

        if buy_leg and sell_leg:
            log_and_print(
                "LIVE MTM | "
                f"BUY {buy_leg['trading_symbol']} Entry={buy_leg['entry_price']:.2f} "
                f"LTP={buy_leg['ltp']:.2f} PnL={buy_leg['pnl']:.2f} | "
                f"SELL {sell_leg['trading_symbol']} Entry={sell_leg['entry_price']:.2f} "
                f"LTP={sell_leg['ltp']:.2f} PnL={sell_leg['pnl']:.2f} | "
                f"NET={total:.2f}"
            )

    def _check_exit_conditions(self) -> None:
        total = self.paper_book.total_pnl()

        if total <= self.stop_loss_amount:
            log_and_print(
                f"🛑 STOP LOSS HIT | Net PnL={total:.2f} <= {self.stop_loss_amount:.2f}",
                "warning",
            )
            self.paper_book.close_all_positions()
            self._publish_current_state()
            self.stop()

        elif total >= self.target_amount:
            log_and_print(
                f"🎯 TARGET HIT | Net PnL={total:.2f} >= {self.target_amount:.2f}",
                "info",
            )
            self.paper_book.close_all_positions()
            self._publish_current_state()
            self.stop()

    def stop(self) -> None:
        self.is_running = False
        try:
            if self.ws is not None:
                orders_df = self.paper_book.get_all_orders()
                if not orders_df.empty:
                    tokens = orders_df["instrument_token"].tolist()
                    if tokens:
                        self.ws.unsubscribe(tokens)
                self.ws.close()
        except Exception as e:
            log_and_print(f"Error while stopping MTM tracker: {e}", "error")

        self._publish_current_state()

    def start(self) -> None:
        orders_df = self.paper_book.get_all_orders()
        if orders_df.empty or len(orders_df) < 2:
            log_and_print("No paper positions available for MTM tracking.", "warning")
            return

        tokens = orders_df["instrument_token"].tolist()

        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.ws = kws
        self.is_running = True

        def on_ticks(ws, ticks):
            if not self.is_running:
                return

            if is_after_market_close_ist():
                log_and_print("Market close reached. Closing paper spread positions.", "info")
                self.paper_book.close_all_positions()
                self._publish_current_state()
                self.stop()
                return

            for tick in ticks:
                token = tick.get("instrument_token")
                ltp = tick.get("last_price")

                if token is None or ltp is None or ltp <= 0:
                    continue

                self.paper_book.update_ltp_and_pnl(token, float(ltp))

            current_time = time.time()
            if current_time - self.last_print_time >= 1.0:
                self._log_live_mtm()
                self.last_print_time = current_time

            self._publish_current_state()
            self._check_exit_conditions()

        def on_connect(ws, response):
            log_and_print("Connected to option-leg MTM websocket.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

        def on_close(ws, code, reason):
            log_and_print(f"Option MTM websocket closed: {code} - {reason}", "warning")

        def on_error(ws, code, reason):
            log_and_print(f"Option MTM websocket error: {code} - {reason}", "error")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message="Runtime issue detected while tracking live positions.",
                progress_text=None,
                is_loading=False,
            )

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.on_close = on_close
        kws.on_error = on_error

        log_and_print("Starting option-leg MTM websocket...")
        self._publish_current_state()
        kws.connect(threaded=True)


# =========================================================
# ================= Alpha Bull Strategy ===================
# =========================================================
class AlphaBullCall:
    def __init__(
        self,
        kite: KiteConnect,
        cred: dict,
        paper_book: PaperOrderBook,
        stop_loss_amount: float = STOP_LOSS_AMOUNT,
        target_amount: float = TARGET_AMOUNT,
    ):
        self.kite = kite
        self.cred = cred
        self.paper_book = paper_book
        self.quantity = QUANTITY
        self.stop_loss_amount = stop_loss_amount
        self.target_amount = target_amount
        self.mtm_tracker: Optional[PaperSpreadMTMTracker] = None
        self.reset_state()

    def reset_state(self) -> None:
        self.trade_initialized = False
        self.position_closed = False
        self.expiry = None
        self.itm_strike = None
        self.otm_strike = None
        self.symbol_ce = "NIFTY"

        self.buy_leg_token = None
        self.sell_leg_token = None
        self.buy_leg_symbol = None
        self.sell_leg_symbol = None
        self.buy_entry_price = None
        self.sell_entry_price = None

    def quote_details(self) -> None:
        import nfo_util

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ENTERING_SPREAD",
            message="Entry conditions satisfied. Preparing debit spread entry...",
            progress_text="Preparing spread structure...",
            is_loading=True,
        )

        _ = self.kite.ltp(nfo_util.get_instrument_tokens_ce_nifty())

        df_ce = nfo_util.build_nifty_ce_chain_100_strike_with_ltp()
        option_chain_ce = nfo_util.bull_call_spreads_nifty(
            df_ce,
            gaps=(150, 200),
            rr_target=1.7,
            atm_only=False,
        )

        if option_chain_ce.empty:
            raise ValueError("No eligible bull call spread candidates found in option chain.")

        self.itm_strike = int(option_chain_ce.loc[0, "buy_strike"])
        self.otm_strike = int(option_chain_ce.loc[0, "sell_strike"])

        log_and_print(f"ITM Strike selected: {self.itm_strike}")
        log_and_print(f"OTM Strike selected: {self.otm_strike}")

        expiry_value = self.cred["i_expiry_date_nifty"]
        self.expiry = str(expiry_value)

        buy_row = df_ce.loc[df_ce["strike"].astype(int) == self.itm_strike].iloc[0]
        sell_row = df_ce.loc[df_ce["strike"].astype(int) == self.otm_strike].iloc[0]

        self.buy_leg_token = int(buy_row["instrument_token"])
        self.sell_leg_token = int(sell_row["instrument_token"])

        self.buy_leg_symbol = str(buy_row["tradingsymbol"])
        self.sell_leg_symbol = str(sell_row["tradingsymbol"])

        self.buy_entry_price = float(buy_row["last_price_y"])
        self.sell_entry_price = float(sell_row["last_price_y"])

        log_and_print(
            f"Selected BUY leg | {self.buy_leg_symbol} | Token={self.buy_leg_token} | Entry={self.buy_entry_price:.2f}"
        )
        log_and_print(
            f"Selected SELL leg | {self.sell_leg_symbol} | Token={self.sell_leg_token} | Entry={self.sell_entry_price:.2f}"
        )

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ENTERING_SPREAD",
            message="Entry conditions satisfied. Preparing debit spread entry...",
            progress_text="Executing spread structure...",
            is_loading=True,
        )

        if not self.trade_initialized:
            self.place_ce_order_buy()
            self.place_ce_order_sell()
            self.trade_initialized = True

    def place_ce_order_buy(self) -> str:
        return self.paper_book.place_order(
            strategy_name=STRATEGY_NAME,
            symbol=self.symbol_ce,
            strike=self.itm_strike,
            expiry=self.expiry,
            side="BUY",
            quantity=self.quantity,
            right="CE",
            entry_price=self.buy_entry_price,
            instrument_token=self.buy_leg_token,
            trading_symbol=self.buy_leg_symbol,
        )

    def place_ce_order_sell(self) -> str:
        return self.paper_book.place_order(
            strategy_name=STRATEGY_NAME,
            symbol=self.symbol_ce,
            strike=self.otm_strike,
            expiry=self.expiry,
            side="SELL",
            quantity=self.quantity,
            right="CE",
            entry_price=self.sell_entry_price,
            instrument_token=self.sell_leg_token,
            trading_symbol=self.sell_leg_symbol,
        )

    def start(self) -> None:
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ENTERING_SPREAD",
            message="Entry conditions satisfied. Preparing debit spread entry...",
            progress_text="Executing spread structure...",
            is_loading=True,
        )

        log_and_print("Alpha Bull Call PAPER strategy: START", "info")
        self.quote_details()
        log_and_print("Bull call spread paper entry created successfully.", "info")

        initial_payload = build_spread_payload(
            paper_book=self.paper_book,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            strategy_name=STRATEGY_NAME,
            stop_loss_amount=self.stop_loss_amount,
            target_amount=self.target_amount,
        )
        publish_spread_update(initial_payload)

        self.mtm_tracker = PaperSpreadMTMTracker(
            cred=self.cred,
            paper_book=self.paper_book,
            stop_loss_amount=self.stop_loss_amount,
            target_amount=self.target_amount,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            strategy_name=STRATEGY_NAME,
        )
        self.mtm_tracker.start()


# =========================================================
# ============= Nifty EMA Confirmation Handler ============
# =========================================================
class EMACrossover1Min:
    def __init__(
        self,
        kite: KiteConnect,
        cred: dict,
        instrument_token: int = NIFTY_SPOT_TOKEN,
        preload_days: int = PRELOAD_DAYS,
    ):
        self.kite = kite
        self.cred = cred
        self.token = instrument_token
        self.preload_days = preload_days

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="LOADING_HISTORY",
            message="Initializing market context...",
            progress_text="Preparing live market conditions...",
            is_loading=True,
        )

        self.onemin_bars = self._load_history()

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_SIGNAL",
            message="Monitoring market conditions for bullish entry trigger...",
            progress_text="Scanning live market conditions...",
            is_loading=True,
        )

        self.prev_minute = None
        self.tick_buffer = pd.DataFrame(columns=["last_price"])

        self.last_trade_signal = 0
        self._stop_flag = False
        self._ws: Optional[KiteTicker] = None

    def _load_history(self) -> pd.DataFrame:
        try:
            end_dt = current_ist()
            start_dt = end_dt - timedelta(days=self.preload_days)

            hist = self.kite.historical_data(
                instrument_token=self.token,
                from_date=start_dt,
                to_date=end_dt,
                interval="minute",
            )

            df = pd.DataFrame(hist)
            if df.empty:
                log_and_print("No historical data received; starting with empty frame.", "warning")
                return pd.DataFrame(columns=["open", "high", "low", "close"])

            df["datetime"] = pd.to_datetime(df["date"], utc=True).dt.tz_convert(IST)
            df = df.set_index("datetime")[["open", "high", "low", "close"]].sort_index()
            return df

        except Exception as e:
            log_and_print(f"History load failed: {e}", "error")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message="Unable to initialize market context.",
                progress_text=None,
                is_loading=False,
            )
            return pd.DataFrame(columns=["open", "high", "low", "close"])

    def _to_ist(self, ts: datetime) -> datetime:
        if ts.tzinfo is None:
            ts = pytz.utc.localize(ts)
        return ts.astimezone(IST)

    def _prepare_1min_df(self, ltt: datetime, last_price: float, rider: AlphaBullCall) -> None:
        ltt = self._to_ist(ltt)
        row = pd.DataFrame([[last_price]], columns=["last_price"], index=[ltt])

        self.tick_buffer = pd.concat([self.tick_buffer, row]) if not self.tick_buffer.empty else row

        if self.prev_minute is None:
            self.prev_minute = ltt.minute
            return

        if ltt.minute != self.prev_minute:
            ohlc = self.tick_buffer["last_price"].resample("1min").ohlc().iloc[:-1]

            if not ohlc.empty:
                ohlc["signal"] = 0
                self.onemin_bars = pd.concat([self.onemin_bars, ohlc])
                self._update_ema_crossover(rider)

            self.tick_buffer = row
            self.prev_minute = ltt.minute

    def _stop_nifty_stream(self) -> None:
        self._stop_flag = True
        try:
            if self._ws:
                self._ws.unsubscribe([self.token])
                self._ws.close()
        except Exception as e:
            log_and_print(f"WebSocket close error: {e}", "error")

    def _update_ema_crossover(self, rider: AlphaBullCall) -> None:
        self.onemin_bars["EMA5"] = self.onemin_bars["close"].ewm(span=1, adjust=False).mean()
        self.onemin_bars["EMA55"] = self.onemin_bars["close"].ewm(span=2, adjust=False).mean()

        if len(self.onemin_bars) < 55:
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Monitoring market conditions for bullish entry trigger...",
                progress_text="Scanning live market conditions...",
                is_loading=True,
            )
            return

        latest = self.onemin_bars.iloc[-1]
        prev = self.onemin_bars.iloc[-2]

        if "signal" not in self.onemin_bars.columns:
            self.onemin_bars["signal"] = 0

        self.onemin_bars.iloc[-1, self.onemin_bars.columns.get_loc("signal")] = 0

        if prev["EMA5"] <= prev["EMA55"] and latest["EMA5"] > latest["EMA55"]:
            self.onemin_bars.at[self.onemin_bars.index[-1], "signal"] = 1

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="SIGNAL_TRIGGERED",
                message="Entry conditions satisfied. Preparing debit spread entry...",
                progress_text="Executing spread structure...",
                is_loading=True,
            )

            if self.last_trade_signal != 1:
                self.last_trade_signal = 1
                self._stop_nifty_stream()

                def _launch_rider():
                    try:
                        rider.start()
                    except Exception as e:
                        log_and_print(f"AlphaBullCall.start() failed: {e}", "error")
                        publish_strategy_state(
                            strategy_name=STRATEGY_NAME,
                            index_name=INDEX_NAME,
                            spread_type=SPREAD_TYPE,
                            ui_state="ERROR",
                            message="Unable to complete entry preparation.",
                            progress_text=None,
                            is_loading=False,
                        )

                threading.Thread(target=_launch_rider, daemon=True).start()

        else:
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Monitoring market conditions for bullish entry trigger...",
                progress_text="Scanning live market conditions...",
                is_loading=True,
            )

    def start(self, rider: AlphaBullCall) -> None:
        tokens = [self.token]
        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self._ws = kws

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_SIGNAL",
            message="Monitoring market conditions for bullish entry trigger...",
            progress_text="Scanning live market conditions...",
            is_loading=True,
        )

        def on_ticks(ws, ticks):
            if self._stop_flag:
                return

            if is_after_market_close_ist():
                self._stop_nifty_stream()
                publish_stopped_state("Trading window closed for the day.")
                return

            ltt_utc = datetime.utcnow()

            for tick in ticks:
                if tick.get("instrument_token") != self.token:
                    continue

                price = tick.get("last_price")
                if price is None or price <= 0:
                    continue

                self._prepare_1min_df(ltt_utc, float(price), rider)

        def on_connect(ws, response):
            if self._stop_flag:
                return
            log_and_print("Connected & subscribed to NIFTY EMA stream.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Monitoring market conditions for bullish entry trigger...",
                progress_text="Scanning live market conditions...",
                is_loading=True,
            )

        def on_close(ws, code, reason):
            log_and_print(f"NIFTY market websocket closed: {code} - {reason}", "warning")

        def on_error(ws, code, reason):
            log_and_print(f"NIFTY market websocket error: {code} - {reason}", "error")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message="Unable to continue market monitoring.",
                progress_text=None,
                is_loading=False,
            )

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.on_close = on_close
        kws.on_error = on_error

        log_and_print("Starting NIFTY market websocket...")
        kws.connect(threaded=True)


def main():
    global STRATEGY_ALREADY_STARTED

    with STRATEGY_RUN_LOCK:
        if STRATEGY_ALREADY_STARTED:
            log_and_print("Strategy has already started for this process. Skipping duplicate start.", "warning")
            return
        STRATEGY_ALREADY_STARTED = True

    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="BOOTING",
        message="Initializing strategy...",
        progress_text="Preparing market context...",
        is_loading=True,
    )

    now_ist = current_ist()

    if not is_weekday_ist(now_ist):
        publish_stopped_state("Strategy is inactive outside working days.")
        log_and_print("Today is not a working day. Strategy will not run.", "info")
        return

    if is_after_market_close_ist(now_ist):
        publish_stopped_state("Trading window closed for the day.")
        log_and_print("It is after market close. Strategy will not run.", "info")
        return

    wait_until_market_open()

    try:
        cred = load_creds()

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("Kite API authenticated.")

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="BOOTING",
            message="Initializing strategy...",
            progress_text="Preparing market context...",
            is_loading=True,
        )

        paper_book = PaperOrderBook()

        nifty_ema = EMACrossover1Min(
            kite=kite,
            cred=cred,
            instrument_token=NIFTY_SPOT_TOKEN,
            preload_days=PRELOAD_DAYS,
        )

        alpha_bull = AlphaBullCall(
            kite=kite,
            cred=cred,
            paper_book=paper_book,
            stop_loss_amount=STOP_LOSS_AMOUNT,
            target_amount=TARGET_AMOUNT,
        )

        log_and_print("Starting NIFTY bullish-entry logic...")
        nifty_ema.start(alpha_bull)
        log_and_print("Strategy monitoring started.")

    except SystemExit:
        log_and_print("Exited after execution.")
        publish_stopped_state("Strategy stopped manually.")
    except Exception as e:
        log_and_print(f"An error occurred in main execution: {e}", "error")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ERROR",
            message="Runtime issue detected during strategy execution.",
            progress_text=None,
            is_loading=False,
        )


if __name__ == "__main__":
    main()
