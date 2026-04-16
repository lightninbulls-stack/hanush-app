from __future__ import annotations

import warnings
warnings.simplefilter(action="ignore", category=FutureWarning)

import logging
import sys
import threading
import pandas as pd
import yaml
import time
import pytz
import uuid
from typing import Optional
from datetime import datetime, timedelta

from kiteconnect import KiteConnect, KiteTicker

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

TARGET_HOUR = 9
TARGET_MINUTE = 15

LOG_FILE_NAME = "vix_bn_strategy.log"

# In-memory frontend state holder
GLOBAL_SPREAD_STATE: dict[str, dict] = {}

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

IST = pytz.timezone("Asia/Kolkata")


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

    GLOBAL_SPREAD_STATE[strategy_name] = payload


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
        message = "Bull call spread is live."
        is_loading = False
    elif status == "CLOSED":
        message = "Bull call spread closed."
        is_loading = False
    else:
        message = "Waiting for entry signal."
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
    """
    Right now this stores the latest state in memory.
    Later your FastAPI/Flask/WebSocket layer can read from this.
    """
    GLOBAL_SPREAD_STATE[payload["strategy_name"]] = payload


def get_strategy_state(strategy_name: str = STRATEGY_NAME) -> dict:
    """
    Helper function for API layer.
    """
    return GLOBAL_SPREAD_STATE.get(
        strategy_name,
        {
            "index": INDEX_NAME,
            "spread_type": SPREAD_TYPE,
            "strategy_name": strategy_name,
            "status": "BOOTING",
            "ui_state": "BOOTING",
            "message": "Strategy is starting...",
            "progress_text": "Please wait",
            "is_loading": True,
            "updated_at": datetime.now(IST).isoformat(),
            "net_pnl": 0.0,
            "stop_loss": STOP_LOSS_AMOUNT,
            "target": TARGET_AMOUNT,
            "legs": [],
        },
    )


# =========================================================
# ===================== Utilities =========================
# =========================================================
def load_creds() -> dict:
    with open("cred.yml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def wait_until(target_hour: int, target_minute: int) -> None:
    now = datetime.now()
    run_time = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)

    if now < run_time:
        sleep_seconds = int((run_time - now).total_seconds())

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_START_TIME",
            message=f"Waiting until {run_time.strftime('%H:%M:%S')} to start strategy.",
            progress_text=f"Start in {sleep_seconds} seconds",
            is_loading=True,
        )

        log_and_print(f"Waiting until {run_time.strftime('%H:%M:%S')} ({sleep_seconds} seconds)")
        try:
            for remaining in range(sleep_seconds, 0, -1):
                print(f"\rTime left: {timedelta(seconds=remaining)}", end="")
                if remaining % 5 == 0 or remaining <= 10:
                    publish_strategy_state(
                        strategy_name=STRATEGY_NAME,
                        index_name=INDEX_NAME,
                        spread_type=SPREAD_TYPE,
                        ui_state="WAITING_START_TIME",
                        message=f"Waiting until {run_time.strftime('%H:%M:%S')} to start strategy.",
                        progress_text=f"Start in {remaining} seconds",
                        is_loading=True,
                    )
                time.sleep(1)
            print()
        except KeyboardInterrupt:
            print("\nCountdown interrupted by user.")
            raise SystemExit
    else:
        log_and_print(f"It's after {run_time.strftime('%H:%M:%S')} -- running strategy now.")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="BOOTING",
            message="Start time reached. Booting strategy...",
            progress_text="Initializing components",
            is_loading=True,
        )


# =========================================================
# ===================== Paper Order Book ==================
# =========================================================
class PaperOrderBook:
    """
    In-memory paper order / paper position tracker.
    """

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
            "timestamp": datetime.now(IST),
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
            now_ts = datetime.now(IST)
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
    """
    After bull call spread entry:
      - subscribe only to option leg tokens
      - update tick-by-tick MTM
      - exit all paper positions on SL / target
      - publish structured spread state for frontend
    """

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

        orders_df = self.paper_book.get_all_orders()
        if not orders_df.empty:
            log_and_print("Final paper positions:")
            print(orders_df.to_string(index=False))

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
            log_and_print(f"Option MTM WS closed: {code} - {reason}", "warning")

        def on_error(ws, code, reason):
            log_and_print(f"Option MTM WS error: {code} - {reason}", "error")

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
    """
    Creates bull call spread paper entry, then hands off to MTM tracker.
    """

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
            message="Signal confirmed. Building bull call spread...",
            progress_text="Fetching option chain and selecting strikes",
            is_loading=True,
        )

        _ = self.kite.ltp(nfo_util.get_instrument_tokens_ce_nifty())

        df_ce = nfo_util.build_nifty_ce_chain_100_strike_with_ltp()
        option_chain_ce = nfo_util.bull_call_spreads_nifty(
            df_ce,
            gaps=(150, 200),
            rr_target=1.5,
            atm_only=False,
        )

        if option_chain_ce.empty:
            raise ValueError("No bull call spread candidates found in option chain.")

        self.itm_strike = int(option_chain_ce.loc[0, "buy_strike"])
        self.otm_strike = int(option_chain_ce.loc[0, "sell_strike"])

        log_and_print(f"ITM Strike selected: {self.itm_strike}")
        log_and_print(f"OTM Strike selected: {self.otm_strike}")

        expiry_date_str = self.cred["i_expiry_date_nifty"]
        self.expiry = (
            expiry_date_str.strftime("%Y%m%d")
            if hasattr(expiry_date_str, "strftime")
            else str(expiry_date_str)
        )

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
            message="Spread legs selected successfully.",
            progress_text=f"BUY {self.itm_strike} CE | SELL {self.otm_strike} CE",
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
            message="Signal confirmed. Creating paper bull call spread...",
            progress_text="Placing paper orders",
            is_loading=True,
        )

        log_and_print("Alpha Bull Call PAPER strategy: START", "info")
        self.quote_details()
        log_and_print("Bull call spread paper entry created successfully.", "info")

        orders_df = self.paper_book.get_all_orders()
        if not orders_df.empty:
            log_and_print("Current paper order book:")
            print(orders_df.to_string(index=False))

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
    """
    Stream NIFTY 1-min logic.
    On bullish EMA(5,55) crossover:
      - stop NIFTY websocket
      - launch bull call paper entry
      - hand off to option-leg live MTM tracker
    """

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
            message="Loading historical data for EMA confirmation...",
            progress_text="Preparing 1-minute candles",
            is_loading=True,
        )

        self.onemin_bars = self._load_history()

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_SIGNAL",
            message="Historical data loaded. Waiting for bullish EMA crossover...",
            progress_text="Watching live market for entry signal",
            is_loading=True,
            extra={
                "history_rows": int(len(self.onemin_bars)),
            },
        )

        self.prev_minute = None
        self.tick_buffer = pd.DataFrame(columns=["last_price"])

        self.last_signal = 0
        self.last_trade_signal = 0

        self._stop_flag = False
        self._ws: Optional[KiteTicker] = None

    def _load_history(self) -> pd.DataFrame:
        try:
            end_dt = datetime.today()
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
                message=f"History load failed: {str(e)}",
                progress_text="Check logs",
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

                cols = ["close", "EMA5", "EMA55", "signal"]
                for col in cols:
                    if col not in self.onemin_bars.columns:
                        self.onemin_bars[col] = pd.NA

                log_and_print("=== Latest 30 Bars (close, EMA5, EMA55, signal) ===")
                print(self.onemin_bars[cols].tail(30).to_string(float_format="%.2f"))

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
        self.onemin_bars["EMA5"] = self.onemin_bars["close"].ewm(span=5, adjust=False).mean()
        self.onemin_bars["EMA55"] = self.onemin_bars["close"].ewm(span=55, adjust=False).mean()

        if len(self.onemin_bars) < 55:
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Collecting enough candles for EMA crossover logic...",
                progress_text=f"Loaded bars: {len(self.onemin_bars)} / 55",
                is_loading=True,
            )
            return

        latest = self.onemin_bars.iloc[-1]
        prev = self.onemin_bars.iloc[-2]

        if "signal" not in self.onemin_bars.columns:
            self.onemin_bars["signal"] = 0

        self.onemin_bars.iloc[-1, self.onemin_bars.columns.get_loc("signal")] = 0

        if prev["EMA5"] <= prev["EMA55"] and latest["EMA5"] > latest["EMA55"]:
            self.last_signal = 1
            self.onemin_bars.at[self.onemin_bars.index[-1], "signal"] = 1

            log_and_print(
                f"🚀 Bullish crossover @ {self.onemin_bars.index[-1].strftime('%H:%M:%S')} | Price: {latest['close']:.2f}"
            )

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="SIGNAL_TRIGGERED",
                message=f"Bullish crossover detected at {self.onemin_bars.index[-1].strftime('%H:%M:%S')}",
                progress_text="Preparing bull call spread entry",
                is_loading=True,
                extra={
                    "signal_price": float(latest["close"]),
                    "signal_type": "BULLISH_EMA_CROSSOVER",
                },
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
                            message=f"Spread launch failed: {str(e)}",
                            progress_text="Check backend logs",
                            is_loading=False,
                        )

                threading.Thread(target=_launch_rider, daemon=True).start()

        elif prev["EMA5"] >= prev["EMA55"] and latest["EMA5"] < latest["EMA55"]:
            self.last_signal = -1
            self.onemin_bars.at[self.onemin_bars.index[-1], "signal"] = -1

            log_and_print(
                f"🔻 Bearish crossover @ {self.onemin_bars.index[-1].strftime('%H:%M:%S')} | Price: {latest['close']:.2f}"
            )

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Bearish crossover seen. Still waiting for bullish EMA crossover...",
                progress_text="Monitoring EMA(5,55)",
                is_loading=True,
                extra={
                    "signal_price": float(latest["close"]),
                    "signal_type": "BEARISH_EMA_CROSSOVER",
                },
            )
        else:
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Live feed running. Waiting for bullish EMA crossover...",
                progress_text="Monitoring EMA(5,55)",
                is_loading=True,
                extra={
                    "last_price": float(latest["close"]),
                    "ema5": round(float(latest["EMA5"]), 2),
                    "ema55": round(float(latest["EMA55"]), 2),
                },
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
            message="Live feed started. Waiting for bullish EMA crossover...",
            progress_text="Monitoring EMA(5,55)",
            is_loading=True,
        )

        def on_ticks(ws, ticks):
            if self._stop_flag:
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
                message="Connected to live NIFTY feed. Waiting for signal...",
                progress_text="EMA engine active",
                is_loading=True,
            )

        def on_close(ws, code, reason):
            log_and_print(f"NIFTY EMA WS closed: {code} - {reason}", "warning")

        def on_error(ws, code, reason):
            log_and_print(f"NIFTY EMA WS error: {code} - {reason}", "error")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message=f"NIFTY websocket error: {reason}",
                progress_text="Check websocket connection",
                is_loading=False,
            )

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.on_close = on_close
        kws.on_error = on_error

        log_and_print("Starting NIFTY EMA WebSocket…")
        kws.connect(threaded=False)


# =========================================================
# ========================= Main ==========================
# =========================================================
if __name__ == "__main__":
    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="BOOTING",
        message="Strategy process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    wait_until(TARGET_HOUR, TARGET_MINUTE)

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
            message="Kite API authenticated successfully.",
            progress_text="Preparing strategy objects",
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

        log_and_print("Starting NIFTY EMA bullish-entry logic...")
        nifty_ema.start(alpha_bull)

        log_and_print("Main finished.")

    except SystemExit:
        log_and_print("Exited after execution.")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy stopped manually.",
            progress_text=None,
            is_loading=False,
        )
    except Exception as e:
        log_and_print(f"An error occurred in main execution: {e}", "error")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ERROR",
            message=f"Strategy failed: {str(e)}",
            progress_text="Check logs",
            is_loading=False,
        )
