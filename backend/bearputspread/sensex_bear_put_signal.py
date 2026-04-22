from __future__ import annotations

import warnings
warnings.simplefilter(action="ignore", category=FutureWarning)

import logging
import os
import sys
import threading
import time
import traceback
import uuid
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import pytz
from kiteconnect import KiteConnect, KiteTicker

print("✅ sensex_bear_put_signal.py imported")

from shared.intraday_spreads_state import spread_state

# =========================================================
# ========== CONFIGURATION: CHANGE FROM HERE ==============
# =========================================================
INDEX_NAME = "SENSEX"
SPREAD_TYPE = "put_debit"
STRATEGY_NAME = "ALPHA_BEAR_SENSEX"

SENSEX_SPOT_TOKEN = 265
PRELOAD_DAYS = 2
QUANTITY = 30

STOP_LOSS_AMOUNT = -1500.0
TARGET_AMOUNT = 3000.0

MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 23
MARKET_CLOSE_MINUTE = 59

SENSEX_EXPIRY_WEEKS_AHEAD = int(os.getenv("SENSEX_EXPIRY_WEEKS_AHEAD", "0"))

LOG_FILE_NAME = "sensex_bear_put_spread.log"

IST = pytz.timezone("Asia/Kolkata")

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
logger = logging.getLogger("alpha_bear_sensex_strategy")


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
        message = "Sensex bear put spread is live."
        is_loading = False
    elif status == "CLOSED":
        message = "Sensex bear put spread closed."
        is_loading = False
    else:
        message = "Monitoring market conditions for bearish entry trigger..."
        is_loading = True

    entry_time = None
    if orders:
        valid_timestamps = [o["timestamp"] for o in orders if o.get("timestamp") is not None]
        if valid_timestamps:
            entry_time = min(valid_timestamps).strftime("%H:%M:%S")

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
        "entry_time": entry_time,
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
                "entry_time": buy_leg["timestamp"].strftime("%H:%M:%S")
                if buy_leg and buy_leg.get("timestamp") is not None
                else None,
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
                "entry_time": sell_leg["timestamp"].strftime("%H:%M:%S")
                if sell_leg and sell_leg.get("timestamp") is not None
                else None,
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

    log_and_print(
        f"WAIT CHECK | now_ist={now_ist} | "
        f"market_open={market_open} | market_close={market_close}"
    )

    if now_ist > market_close:
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Trading window closed for the day.",
            progress_text=None,
            is_loading=False,
        )
        log_and_print("It is after market close. Strategy will not run today.")
        raise SystemExit

    if now_ist >= market_open:
        log_and_print("Market is already open in IST -- running strategy now.")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="BOOTING",
            message="Market is open. Initializing strategy...",
            progress_text="Preparing market context...",
            is_loading=True,
        )
        return

    sleep_seconds = int((market_open - now_ist).total_seconds())

    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="WAITING_START_TIME",
        message=f"Waiting until {market_open.strftime('%H:%M:%S')} IST to start strategy.",
        progress_text=f"Start in {sleep_seconds} seconds",
        is_loading=True,
    )

    log_and_print(f"Waiting until {market_open.strftime('%H:%M:%S')} IST ({sleep_seconds} seconds)")
    try:
        for remaining in range(sleep_seconds, 0, -1):
            print(f"\rTime left: {timedelta(seconds=remaining)}", end="")
            if remaining % 5 == 0 or remaining <= 10:
                publish_strategy_state(
                    strategy_name=STRATEGY_NAME,
                    index_name=INDEX_NAME,
                    spread_type=SPREAD_TYPE,
                    ui_state="WAITING_START_TIME",
                    message=f"Waiting until {market_open.strftime('%H:%M:%S')} IST to start strategy.",
                    progress_text=f"Start in {remaining} seconds",
                    is_loading=True,
                )
            time.sleep(1)
        print()
    except KeyboardInterrupt:
        print("\nCountdown interrupted by user.")
        raise SystemExit


def resolve_sensex_weekly_expiry() -> str:
    today = current_ist().date()
    days_ahead = (3 - today.weekday()) % 7  # Thursday = 3

    if days_ahead == 0:
        expiry = today
    else:
        expiry = today + timedelta(days=days_ahead)

    expiry = expiry + timedelta(days=7 * max(SENSEX_EXPIRY_WEEKS_AHEAD, 0))
    return expiry.strftime("%Y%m%d")


def load_creds() -> dict:
    return {
        "z_api_key": os.environ["Z_API_KEY"].strip(),
        "z_access_token": os.environ["Z_ACCESS_TOKEN"].strip(),
        "i_expiry_date_sensex": resolve_sensex_weekly_expiry(),
        "i_inst_name_sensex": "S",
    }


def ensure_cred_yml(cred: dict, file_path: str = "cred.yml") -> None:
    content = (
        f"z_api_key: {cred['z_api_key']}\n"
        f"z_access_token: {cred['z_access_token']}\n"
        f"i_expiry_date_sensex: {cred['i_expiry_date_sensex']}\n"
        f"i_inst_name_sensex: {cred['i_inst_name_sensex']}\n"
    )

    with open(file_path, "w", encoding="utf-8") as file:
        file.write(content)

    log_and_print(f"cred.yml created for legacy spread utilities at {file_path}")


def patch_nfo_util_config(nfo_util_module, cred: dict) -> None:
    if hasattr(nfo_util_module, "load_creds"):
        nfo_util_module.load_creds = lambda: cred

    setattr(nfo_util_module, "i_inst_name_sensex", cred["i_inst_name_sensex"])
    setattr(nfo_util_module, "i_expiry_date_sensex", cred["i_expiry_date_sensex"])
    setattr(nfo_util_module, "z_api_key", cred["z_api_key"])
    setattr(nfo_util_module, "z_access_token", cred["z_access_token"])


# =========================================================
# ===================== Spread Builder ====================
# =========================================================
def build_bear_put_candidates(
    df_pe: pd.DataFrame,
    strike_gaps: tuple[int, ...] = (100, 200),
) -> pd.DataFrame:
    required_cols = {"strike", "tradingsymbol", "instrument_token", "last_price_y"}
    missing = required_cols - set(df_pe.columns)
    if missing:
        raise ValueError(f"df_pe missing required columns: {missing}")

    temp = df_pe.copy()
    temp = temp.dropna(subset=["strike", "last_price_y"]).copy()
    temp["strike"] = temp["strike"].astype(int)
    temp["last_price_y"] = pd.to_numeric(temp["last_price_y"], errors="coerce")
    temp = temp.dropna(subset=["last_price_y"]).sort_values("strike").reset_index(drop=True)

    candidates = []
    strikes = temp["strike"].tolist()
    strike_to_row = {int(row["strike"]): row for _, row in temp.iterrows()}

    for lower_strike in strikes:
        for gap in strike_gaps:
            higher_strike = lower_strike + gap

            if higher_strike not in strike_to_row:
                continue

            sell_row = strike_to_row[lower_strike]
            buy_row = strike_to_row[higher_strike]

            buy_price = float(buy_row["last_price_y"])
            sell_price = float(sell_row["last_price_y"])

            net_debit = buy_price - sell_price
            width = higher_strike - lower_strike
            max_profit = width - net_debit
            max_loss = net_debit

            if net_debit <= 0:
                continue
            if max_profit <= 0:
                continue

            rr = max_profit / max_loss if max_loss > 0 else None

            candidates.append(
                {
                    "buy_strike": higher_strike,
                    "sell_strike": lower_strike,
                    "buy_price": buy_price,
                    "sell_price": sell_price,
                    "net_debit": net_debit,
                    "spread_width": width,
                    "max_profit": max_profit,
                    "max_loss": max_loss,
                    "rr": rr,
                }
            )

    if not candidates:
        return pd.DataFrame()

    out = pd.DataFrame(candidates)
    out = out.sort_values(
        by=["rr", "max_profit", "net_debit"],
        ascending=[False, False, True],
    ).reset_index(drop=True)

    return out


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
        self.pnl_history = []
        self.entry_reference_time = None

    def _publish_current_state(self) -> None:
        payload = build_spread_payload(
            paper_book=self.paper_book,
            index_name=self.index_name,
            spread_type=self.spread_type,
            strategy_name=self.strategy_name,
            stop_loss_amount=self.stop_loss_amount,
            target_amount=self.target_amount,
        )

        orders = self.paper_book.get_orders_snapshot()

        if orders and self.entry_reference_time is None:
            valid_timestamps = [o["timestamp"] for o in orders if o.get("timestamp") is not None]
            if valid_timestamps:
                self.entry_reference_time = min(valid_timestamps)

        current_time = datetime.now(IST).strftime("%H:%M:%S")
        current_pnl = float(payload["net_pnl"])

        self.pnl_history.append({
            "time": current_time,
            "pnl": current_pnl,
        })

        self.pnl_history = self.pnl_history[-200:]

        running_peak = None
        pnl_curve = []

        for point in self.pnl_history:
            pnl_val = float(point["pnl"])

            if running_peak is None:
                running_peak = pnl_val
            else:
                running_peak = max(running_peak, pnl_val)

            drawdown = pnl_val - running_peak

            pnl_curve.append({
                "time": point["time"],
                "pnl": pnl_val,
                "stop_loss": self.stop_loss_amount,
                "target": self.target_amount,
                "drawdown": drawdown,
            })

        payload["pnl_curve"] = pnl_curve
        payload["entry_marker_time"] = (
            self.entry_reference_time.strftime("%H:%M:%S")
            if self.entry_reference_time is not None
            else None
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

            if is_after_market_close_ist():
                log_and_print("Market is closed in IST. Closing paper positions.", "info")
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
# ================= Alpha Bear Strategy ===================
# =========================================================
class AlphaBearPutSensex:
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
        self.buy_strike = None
        self.sell_strike = None
        self.symbol_pe = "SENSEX"

        self.buy_leg_token = None
        self.sell_leg_token = None
        self.buy_leg_symbol = None
        self.sell_leg_symbol = None
        self.buy_entry_price = None
        self.sell_entry_price = None

    def quote_details(self) -> None:
        ensure_cred_yml(self.cred)

        from option_spreads import nfo_util

        patch_nfo_util_config(nfo_util, self.cred)

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ENTERING_SPREAD",
            message="Entry conditions satisfied. Preparing Sensex bear put spread...",
            progress_text="Selecting spread structure...",
            is_loading=True,
        )

        log_and_print("DEBUG STEP 1 | quote_details() entered")
        log_and_print(f"DEBUG STEP 2 | expiry from cred = {self.cred.get('i_expiry_date_sensex')}")

        tokens = nfo_util.get_instrument_tokens_pe_sensex()
        log_and_print(f"DEBUG STEP 3 | PE tokens fetched = {0 if tokens is None else len(tokens)}")

        if not tokens:
            raise ValueError("No SENSEX PE tokens returned from nfo_util.get_instrument_tokens_pe_sensex()")

        _ = self.kite.ltp(tokens)

        df_pe = nfo_util.build_sensex_pe_chain_100_strike_with_ltp()
        log_and_print(f"DEBUG STEP 5 | df_pe built = {'None' if df_pe is None else f'{len(df_pe)} rows'}")

        if df_pe is None or df_pe.empty:
            raise ValueError("df_pe is empty. Could not build SENSEX PE option chain.")

        log_and_print(
            "DEBUG STEP 6 | df_pe sample =\n"
            + df_pe[["tradingsymbol", "strike", "instrument_token", "last_price_y"]]
            .head(10)
            .to_string(index=False)
        )

        option_chain_pe = build_bear_put_candidates(
            df_pe=df_pe,
            strike_gaps=(100, 200),
        )

        log_and_print(
            f"DEBUG STEP 7 | option_chain_pe = "
            f"{'None' if option_chain_pe is None else f'{len(option_chain_pe)} rows'}"
        )

        if option_chain_pe is None or option_chain_pe.empty:
            raise ValueError("No valid Sensex bear put spread candidates found in option chain.")

        log_and_print(
            "DEBUG STEP 8 | option_chain_pe sample =\n"
            + option_chain_pe.head(10).to_string(index=False)
        )

        best = option_chain_pe.iloc[0]
        log_and_print(f"DEBUG STEP 9 | best spread row = {best.to_dict()}")

        self.buy_strike = int(best["buy_strike"])
        self.sell_strike = int(best["sell_strike"])
        self.expiry = str(self.cred["i_expiry_date_sensex"])

        log_and_print(
            f"✅ Selected Spread | Buy Strike = {self.buy_strike} | "
            f"Sell Strike = {self.sell_strike} | Expiry = {self.expiry}"
        )

        buy_match = df_pe.loc[df_pe["strike"].astype(int) == self.buy_strike]
        sell_match = df_pe.loc[df_pe["strike"].astype(int) == self.sell_strike]

        log_and_print(f"DEBUG STEP 10 | buy_match rows = {len(buy_match)} | sell_match rows = {len(sell_match)}")

        if buy_match.empty:
            raise ValueError(f"Buy strike {self.buy_strike} not found in df_pe.")
        if sell_match.empty:
            raise ValueError(f"Sell strike {self.sell_strike} not found in df_pe.")

        buy_row = buy_match.iloc[0]
        sell_row = sell_match.iloc[0]

        self.buy_leg_token = int(buy_row["instrument_token"])
        self.sell_leg_token = int(sell_row["instrument_token"])

        self.buy_leg_symbol = str(buy_row["tradingsymbol"])
        self.sell_leg_symbol = str(sell_row["tradingsymbol"])

        self.buy_entry_price = float(buy_row["last_price_y"])
        self.sell_entry_price = float(sell_row["last_price_y"])

        log_and_print(
            f"DEBUG STEP 11 | BUY leg = {self.buy_leg_symbol} | "
            f"token={self.buy_leg_token} | price={self.buy_entry_price}"
        )
        log_and_print(
            f"DEBUG STEP 12 | SELL leg = {self.sell_leg_symbol} | "
            f"token={self.sell_leg_token} | price={self.sell_entry_price}"
        )

        buy_expiry_dt = pd.to_datetime(buy_row["expiry"])
        sell_expiry_dt = pd.to_datetime(sell_row["expiry"])

        log_and_print(
            f"✅ BUY LEG SELECTED | Symbol: SENSEX, Year: {buy_expiry_dt.year}, "
            f"Month: {buy_expiry_dt.month}, Day: {buy_expiry_dt.day}, "
            f"Strike: {self.buy_strike}, Type: PE, Expiry: {buy_expiry_dt.strftime('%Y%m%d')}"
        )

        log_and_print(
            f"✅ SELL LEG SELECTED | Symbol: SENSEX, Year: {sell_expiry_dt.year}, "
            f"Month: {sell_expiry_dt.month}, Day: {sell_expiry_dt.day}, "
            f"Strike: {self.sell_strike}, Type: PE, Expiry: {sell_expiry_dt.strftime('%Y%m%d')}"
        )

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ENTERING_SPREAD",
            message="Spread legs selected successfully.",
            progress_text=f"BUY {self.buy_strike} PE | SELL {self.sell_strike} PE",
            is_loading=True,
        )

        if not self.trade_initialized:
            self.place_pe_order_buy()
            self.place_pe_order_sell()
            self.trade_initialized = True

    def place_pe_order_buy(self) -> str:
        return self.paper_book.place_order(
            strategy_name=STRATEGY_NAME,
            symbol=self.symbol_pe,
            strike=self.buy_strike,
            expiry=self.expiry,
            side="BUY",
            quantity=self.quantity,
            right="PE",
            entry_price=self.buy_entry_price,
            instrument_token=self.buy_leg_token,
            trading_symbol=self.buy_leg_symbol,
        )

    def place_pe_order_sell(self) -> str:
        return self.paper_book.place_order(
            strategy_name=STRATEGY_NAME,
            symbol=self.symbol_pe,
            strike=self.sell_strike,
            expiry=self.expiry,
            side="SELL",
            quantity=self.quantity,
            right="PE",
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
            message="Entry conditions satisfied. Creating paper Sensex bear put spread...",
            progress_text="Placing paper orders",
            is_loading=True,
        )

        log_and_print("Alpha Bear Put SENSEX PAPER strategy: START", "info")
        self.quote_details()

        log_and_print(
            f"✅ SPREAD EXECUTED | "
            f"BUY {self.buy_leg_symbol} @ {self.buy_entry_price:.2f} | "
            f"SELL {self.sell_leg_symbol} @ {self.sell_entry_price:.2f}"
        )

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
# ============= SENSEX EMA Confirmation Handler ===========
# =========================================================
class EMACrossover1Min:
    def __init__(
        self,
        kite: KiteConnect,
        cred: dict,
        instrument_token: int = SENSEX_SPOT_TOKEN,
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
            message="Loading historical data...",
            progress_text="Preparing 1-minute candles",
            is_loading=True,
        )

        self.onemin_bars = self._load_history()

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_SIGNAL",
            message="Monitoring market conditions for bearish entry trigger...",
            progress_text="Watching live market",
            is_loading=True,
            extra={"history_rows": int(len(self.onemin_bars))},
        )

        self.prev_minute = None
        self.tick_buffer = pd.DataFrame(columns=["last_price"])

        self.last_trade_signal = 0
        self.last_tick_log_time = 0.0
        self._last_candle_flush_time: Optional[datetime] = None

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

    def _prepare_1min_df(self, ltt: datetime, last_price: float, rider: AlphaBearPutSensex) -> None:
        ltt = self._to_ist(ltt)
        row = pd.DataFrame([[last_price]], columns=["last_price"], index=[ltt])

        self.tick_buffer = pd.concat([self.tick_buffer, row]) if not self.tick_buffer.empty else row

        if self.prev_minute is None:
            self.prev_minute = ltt.minute
            self._last_candle_flush_time = ltt
            return

        minute_changed = ltt.minute != self.prev_minute

        force_flush = (
            self._last_candle_flush_time is not None
            and (ltt - self._last_candle_flush_time).total_seconds() >= 90
        )

        if minute_changed or force_flush:
            if minute_changed:
                ohlc = self.tick_buffer["last_price"].resample("1min").ohlc().iloc[:-1]
            else:
                ohlc = self.tick_buffer["last_price"].resample("1min").ohlc()

            if not ohlc.empty:
                log_and_print(
                    f"1MIN CANDLE CLOSED | Time={ohlc.index[-1]} | Close={ohlc['close'].iloc[-1]:.2f}"
                    + (" [FORCE FLUSH]" if force_flush and not minute_changed else "")
                )
                ohlc["signal"] = 0
                self.onemin_bars = pd.concat([self.onemin_bars, ohlc])
                self._update_ema_crossover(rider)

            self._last_candle_flush_time = ltt
            self.tick_buffer = row
            self.prev_minute = ltt.minute

    def _stop_stream(self) -> None:
        self._stop_flag = True
        try:
            if self._ws:
                self._ws.unsubscribe([self.token])
                self._ws.close()
        except Exception as e:
            log_and_print(f"WebSocket close error: {e}", "error")

    def _update_ema_crossover(self, rider: AlphaBearPutSensex) -> None:
        self.onemin_bars["EMA5"] = self.onemin_bars["close"].ewm(span=5, adjust=False).mean()
        self.onemin_bars["EMA55"] = self.onemin_bars["close"].ewm(span=55, adjust=False).mean()

        if len(self.onemin_bars) < 2:
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Monitoring market conditions for bearish entry trigger...",
                progress_text="Building enough 1-minute candles",
                is_loading=True,
            )
            return

        latest = self.onemin_bars.iloc[-1]
        prev = self.onemin_bars.iloc[-2]

        if "signal" not in self.onemin_bars.columns:
            self.onemin_bars["signal"] = 0

        log_and_print(
            f"EMA UPDATE | Time={self.onemin_bars.index[-1].strftime('%H:%M:%S')} | "
            f"Close={latest['close']:.2f} | "
            f"EMA5={latest['EMA5']:.2f} | EMA55={latest['EMA55']:.2f}"
        )

        self.onemin_bars.iloc[-1, self.onemin_bars.columns.get_loc("signal")] = 0

        # Replace with real bearish logic after first verification:
        # signal_condition = latest["EMA5"] <= latest["EMA55"]
        signal_condition = True
        log_and_print("⚠️ TEST MODE ACTIVE - FORCING SIGNAL")

        log_and_print(
            f"CHECKING SIGNAL | "
            f"PrevEMA5={prev['EMA5']:.2f} | PrevEMA55={prev['EMA55']:.2f} | "
            f"EMA5={latest['EMA5']:.2f} | EMA55={latest['EMA55']:.2f} | "
            f"Condition={signal_condition}"
        )

        if signal_condition:
            self.onemin_bars.at[self.onemin_bars.index[-1], "signal"] = 1

            log_and_print(
                f"🚀 EMA CROSSOVER SIGNAL | "
                f"Time={self.onemin_bars.index[-1].strftime('%H:%M:%S')} | "
                f"Price={latest['close']:.2f} | "
                f"EMA5={latest['EMA5']:.2f} | EMA55={latest['EMA55']:.2f}"
            )

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="SIGNAL_TRIGGERED",
                message="Bearish entry signal detected. Preparing spread...",
                progress_text="Preparing Sensex bear put spread entry",
                is_loading=True,
                extra={
                    "signal_price": float(latest["close"]),
                    "last_price": float(latest["close"]),
                    "ema5": round(float(latest["EMA5"]), 2),
                    "ema55": round(float(latest["EMA55"]), 2),
                },
            )

            if self.last_trade_signal != 1:
                log_and_print("Signal is new. Stopping SENSEX stream and launching spread entry.")
                self.last_trade_signal = 1
                self._stop_stream()

                def _launch_rider():
                    try:
                        log_and_print("🚀 _launch_rider: calling rider.start()")
                        rider.start()
                    except Exception as e:
                        log_and_print(f"AlphaBearPutSensex.start() failed: {e}", "error")
                        log_and_print(traceback.format_exc(), "error")
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

        else:
            log_and_print(
                f"NO SIGNAL | Time={self.onemin_bars.index[-1].strftime('%H:%M:%S')} | "
                f"EMA5={latest['EMA5']:.2f} | EMA55={latest['EMA55']:.2f}"
            )

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Monitoring market conditions for bearish entry trigger...",
                progress_text="Watching live market",
                is_loading=True,
                extra={
                    "last_price": float(latest["close"]),
                    "ema5": round(float(latest["EMA5"]), 2),
                    "ema55": round(float(latest["EMA55"]), 2),
                },
            )

    def start(self, rider: AlphaBearPutSensex) -> None:
        tokens = [self.token]
        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self._ws = kws

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="WAITING_SIGNAL",
            message="Monitoring market conditions for bearish entry trigger...",
            progress_text="Watching live market",
            is_loading=True,
        )

        def on_ticks(ws, ticks):
            if self._stop_flag:
                return

            if is_after_market_close_ist():
                self._stop_stream()
                publish_strategy_state(
                    strategy_name=STRATEGY_NAME,
                    index_name=INDEX_NAME,
                    spread_type=SPREAD_TYPE,
                    ui_state="STOPPED",
                    message="Trading window closed for the day.",
                    progress_text=None,
                    is_loading=False,
                )
                return

            ltt_utc = datetime.utcnow()
            latest_price = None

            for tick in ticks:
                if tick.get("instrument_token") != self.token:
                    continue

                price = tick.get("last_price")
                if price is None or price <= 0:
                    continue

                latest_price = float(price)
                self._prepare_1min_df(ltt_utc, latest_price, rider)

            current_time = time.time()
            if latest_price is not None and current_time - self.last_tick_log_time >= 5:
                ema5 = None
                ema55 = None

                if len(self.onemin_bars) > 0:
                    latest_bar = self.onemin_bars.iloc[-1]
                    ema5 = latest_bar.get("EMA5", None)
                    ema55 = latest_bar.get("EMA55", None)

                log_and_print(
                    f"LIVE SENSEX TICK | Price={latest_price:.2f} | "
                    f"EMA5={round(float(ema5), 2) if pd.notna(ema5) else 'NA'} | "
                    f"EMA55={round(float(ema55), 2) if pd.notna(ema55) else 'NA'}"
                )
                self.last_tick_log_time = current_time

        def on_connect(ws, response):
            if self._stop_flag:
                return
            log_and_print("Connected & subscribed to SENSEX EMA stream.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Connected to live SENSEX feed. Monitoring for bearish trigger...",
                progress_text="Live feed active",
                is_loading=True,
            )

            def _inject_test_signal():
                time.sleep(3)
                if self._stop_flag:
                    return
                try:
                    log_and_print("⚠️ TEST MODE: Injecting fake candle to trigger spread entry...")
                    now_ist = current_ist()
                    fake_close = 80000.0

                    fake_bar1 = pd.DataFrame(
                        {"open": fake_close, "high": fake_close, "low": fake_close,
                         "close": fake_close, "signal": 0},
                        index=pd.DatetimeIndex([now_ist - timedelta(minutes=2)]),
                    )
                    fake_bar2 = pd.DataFrame(
                        {"open": fake_close, "high": fake_close, "low": fake_close,
                         "close": fake_close, "signal": 0},
                        index=pd.DatetimeIndex([now_ist - timedelta(minutes=1)]),
                    )

                    self.onemin_bars = pd.concat([self.onemin_bars, fake_bar1, fake_bar2])
                    log_and_print("⚠️ TEST MODE: Fake bars injected. Firing _update_ema_crossover...")
                    self._update_ema_crossover(rider)
                except Exception as e:
                    log_and_print(f"TEST SIGNAL injection failed: {e}", "error")
                    log_and_print(traceback.format_exc(), "error")

            threading.Thread(target=_inject_test_signal, daemon=True).start()

        def on_close(ws, code, reason):
            log_and_print(f"SENSEX EMA WS closed: {code} - {reason}", "warning")

        def on_error(ws, code, reason):
            log_and_print(f"SENSEX EMA WS error: {code} - {reason}", "error")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message=f"SENSEX websocket error: {reason}",
                progress_text="Check websocket connection",
                is_loading=False,
            )

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.on_close = on_close
        kws.on_error = on_error

        log_and_print("Starting SENSEX EMA WebSocket…")
        kws.connect(threaded=True)


def main():
    log_and_print("✅ Strategy main() entered")
    log_and_print(f"MAIN STARTED | Current IST={current_ist()}")

    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="BOOTING",
        message="Strategy process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    now_ist = current_ist()
    log_and_print(f"WEEKDAY CHECK | now_ist={now_ist} | weekday={now_ist.weekday()}")

    if not is_weekday_ist(now_ist):
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy is inactive outside working days.",
            progress_text=None,
            is_loading=False,
        )
        log_and_print("Today is not a working day. Strategy will not run.")
        return

    wait_until_market_open()

    try:
        cred = load_creds()

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("Kite API authenticated.")
        log_and_print(f"Resolved SENSEX weekly expiry: {cred['i_expiry_date_sensex']}")

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

        sensex_ema = EMACrossover1Min(
            kite=kite,
            cred=cred,
            instrument_token=SENSEX_SPOT_TOKEN,
            preload_days=PRELOAD_DAYS,
        )

        alpha_bear = AlphaBearPutSensex(
            kite=kite,
            cred=cred,
            paper_book=paper_book,
            stop_loss_amount=STOP_LOSS_AMOUNT,
            target_amount=TARGET_AMOUNT,
        )

        log_and_print("Starting SENSEX EMA bearish-entry logic...")
        sensex_ema.start(alpha_bear)
        log_and_print("Strategy initialized successfully. Live websocket is running in background.")

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
