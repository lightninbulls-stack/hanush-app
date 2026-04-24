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
from datetime import datetime, timedelta, date
from typing import Optional

import pandas as pd
import pytz
from kiteconnect import KiteConnect, KiteTicker

from shared.intraday_spreads_state import spread_state
from shared.strategy_locks import SENSEX_BULL_CALL_LOCK

INDEX_NAME = "SENSEX"
SPREAD_TYPE = "bull_call"
STRATEGY_NAME = "ALPHA_BULL_SENSEX"

SENSEX_SPOT_TOKEN = 265
SENSEX_SPOT_SYMBOL = "BSE:SENSEX"
SENSEX_EXCHANGE_SEGMENT = "BFO"
STRIKE_STEP = 100
STRIKE_WINDOW = 500

PRELOAD_DAYS = 2
QUANTITY = 30

STOP_LOSS_AMOUNT = -1500.0
TARGET_AMOUNT = 3000.0

MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 23
MARKET_CLOSE_MINUTE = 59

SENSEX_EXPIRY_WEEKS_AHEAD = int(os.getenv("SENSEX_EXPIRY_WEEKS_AHEAD", "0"))
LOG_FILE_NAME = "sensex_bull_call_spread.log"

IST = pytz.timezone("Asia/Kolkata")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_NAME, mode="a", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("alpha_bull_sensex_strategy")


def log_and_print(msg: str, level: str = "info") -> None:
    stamp = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] {msg}"
    print(line)
    getattr(logger, level if level in {"info", "warning", "error", "debug"} else "info")(line)


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
        message = "Sensex bull call spread is live."
        is_loading = False
    elif status == "CLOSED":
        message = "Sensex bull call spread closed."
        is_loading = False
    else:
        message = "Monitoring market conditions for bullish entry trigger..."
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


def current_ist() -> datetime:
    return datetime.now(IST)


def get_market_open_close_ist(ref: Optional[datetime] = None) -> tuple[datetime, datetime]:
    now_ist = ref or current_ist()
    market_open = now_ist.replace(hour=MARKET_OPEN_HOUR, minute=MARKET_OPEN_MINUTE, second=0, microsecond=0)
    market_close = now_ist.replace(hour=MARKET_CLOSE_HOUR, minute=MARKET_CLOSE_MINUTE, second=0, microsecond=0)
    return market_open, market_close


def is_weekday_ist(ref: Optional[datetime] = None) -> bool:
    return (ref or current_ist()).weekday() < 5


def is_after_market_close_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    _, market_close = get_market_open_close_ist(now_ist)
    return now_ist > market_close


def wait_until_market_open() -> None:
    now_ist = current_ist()
    market_open, market_close = get_market_open_close_ist(now_ist)

    log_and_print(
        f"WAIT CHECK | now={now_ist.strftime('%Y-%m-%d %H:%M:%S')} | "
        f"open={market_open.strftime('%Y-%m-%d %H:%M:%S')} | "
        f"close={market_close.strftime('%Y-%m-%d %H:%M:%S')}"
    )

    if now_ist >= market_open:
        log_and_print("Skipping market-open wait for paper/test mode.")
        return

    sleep_seconds = int((market_open - now_ist).total_seconds())
    log_and_print(f"Waiting {sleep_seconds} seconds until market open.")
    time.sleep(sleep_seconds)


def resolve_sensex_weekly_expiry() -> str:
    today = current_ist().date()
    days_ahead = (3 - today.weekday()) % 7  # Thursday
    expiry = today if days_ahead == 0 else today + timedelta(days=days_ahead)
    expiry = expiry + timedelta(days=7 * max(SENSEX_EXPIRY_WEEKS_AHEAD, 0))
    return expiry.strftime("%Y%m%d")


def parse_yyyymmdd_to_date(value: str) -> date:
    return datetime.strptime(value, "%Y%m%d").date()


def load_creds() -> dict:
    return {
        "z_api_key": os.environ["Z_API_KEY"].strip(),
        "z_access_token": os.environ["Z_ACCESS_TOKEN"].strip(),
        "i_expiry_date_sensex": resolve_sensex_weekly_expiry(),
        "i_inst_name_sensex": "SENSEX",
    }


def build_bull_call_candidates(df_ce: pd.DataFrame, strike_gaps: tuple[int, ...] = (200, 400)) -> pd.DataFrame:
    required_cols = {"strike", "tradingsymbol", "instrument_token", "last_price_y"}
    missing = required_cols - set(df_ce.columns)
    if missing:
        raise ValueError(f"df_ce missing required columns: {missing}")

    temp = df_ce.copy()
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

            buy_row = strike_to_row[lower_strike]
            sell_row = strike_to_row[higher_strike]

            buy_price = float(buy_row["last_price_y"])
            sell_price = float(sell_row["last_price_y"])
            net_debit = buy_price - sell_price
            width = higher_strike - lower_strike
            max_profit = width - net_debit
            max_loss = net_debit

            if net_debit <= 0 or max_profit <= 0:
                continue

            rr = max_profit / max_loss if max_loss > 0 else None
            candidates.append(
                {
                    "buy_strike": lower_strike,
                    "sell_strike": higher_strike,
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

    return pd.DataFrame(candidates).sort_values(
        by=["rr", "max_profit", "net_debit"],
        ascending=[False, False, True],
    ).reset_index(drop=True)


def get_spot_ltp(kite: KiteConnect) -> float:
    quote = kite.ltp([SENSEX_SPOT_SYMBOL])
    if SENSEX_SPOT_SYMBOL not in quote:
        raise ValueError(f"Spot quote missing for {SENSEX_SPOT_SYMBOL}")
    ltp = quote[SENSEX_SPOT_SYMBOL].get("last_price")
    if ltp is None or float(ltp) <= 0:
        raise ValueError(f"Invalid spot LTP for {SENSEX_SPOT_SYMBOL}: {ltp}")
    return float(ltp)


def round_to_step(value: float, step: int) -> int:
    return int(round(value / step) * step)


def load_sensex_option_instruments(kite: KiteConnect, expiry_str: str, option_type: str) -> pd.DataFrame:
    expiry_date = parse_yyyymmdd_to_date(expiry_str)
    all_instruments = pd.DataFrame(kite.instruments(SENSEX_EXCHANGE_SEGMENT))
    if all_instruments.empty:
        raise ValueError(f"No instruments returned from Kite for {SENSEX_EXCHANGE_SEGMENT}")

    required_cols = {
        "tradingsymbol", "instrument_token", "name",
        "expiry", "strike", "instrument_type", "segment", "exchange"
    }
    missing = required_cols - set(all_instruments.columns)
    if missing:
        raise ValueError(f"Instrument dump missing columns: {missing}")

    df = all_instruments.copy()
    df["expiry"] = pd.to_datetime(df["expiry"]).dt.date
    df["strike"] = pd.to_numeric(df["strike"], errors="coerce")

    df = df[
        (df["name"].astype(str).str.upper() == "SENSEX")
        & (df["instrument_type"].astype(str).str.upper() == option_type.upper())
        & (df["expiry"] == expiry_date)
        & (df["strike"].notna())
    ].copy()

    if df.empty:
        raise ValueError(
            f"No SENSEX {option_type} instruments found for expiry {expiry_str}"
        )

    return df.reset_index(drop=True)


def build_local_sensex_chain_with_ltp(
    *,
    kite: KiteConnect,
    expiry_str: str,
    option_type: str,
    strike_step: int = STRIKE_STEP,
    strike_window: int = STRIKE_WINDOW,
) -> pd.DataFrame:
    spot = get_spot_ltp(kite)
    atm = round_to_step(spot, strike_step)
    lower_strike = atm - strike_window
    upper_strike = atm + strike_window

    log_and_print(f"Current SENSEX Spot: {spot:.2f}")
    log_and_print(f"Detected ATM Strike: {atm}")
    log_and_print(f"Strike Range: {lower_strike} to {upper_strike}")

    df = load_sensex_option_instruments(kite, expiry_str, option_type)
    df = df[(df["strike"] >= lower_strike) & (df["strike"] <= upper_strike)].copy()

    if df.empty:
        raise ValueError(
            f"No SENSEX {option_type} instruments inside strike range {lower_strike}-{upper_strike}"
        )

    df["quote_symbol"] = df["tradingsymbol"].astype(str).map(lambda x: f"{SENSEX_EXCHANGE_SEGMENT}:{x}")
    quote_symbols = df["quote_symbol"].dropna().tolist()

    if not quote_symbols:
        raise ValueError(f"Quote symbol list is empty for SENSEX {option_type}")

    try:
        quotes = kite.ltp(quote_symbols)
    except Exception as e:
        raise ValueError(
            f"SENSEX {option_type} ltp fetch failed | quote_count={len(quote_symbols)} | error={e}"
        ) from e

    df["last_price_y"] = df["quote_symbol"].map(
        lambda s: float(quotes.get(s, {}).get("last_price", 0.0))
    )

    df = df[df["last_price_y"] > 0].copy()
    if df.empty:
        raise ValueError(f"All fetched LTPs are invalid/zero for SENSEX {option_type}")

    return df.sort_values("strike").reset_index(drop=True)


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
        log_and_print(f"📝 PAPER ORDER | RefID={ref_id} | {side} {quantity} {trading_symbol} | Entry={entry_price:.2f}")
        return ref_id

    def get_all_orders(self) -> pd.DataFrame:
        with self.lock:
            return pd.DataFrame(self.orders) if self.orders else pd.DataFrame()

    def update_ltp_and_pnl(self, instrument_token: int, ltp: float) -> None:
        with self.lock:
            for order in self.orders:
                if order["instrument_token"] == instrument_token:
                    order["ltp"] = float(ltp)
                    if order["side"] == "BUY":
                        order["pnl"] = (order["ltp"] - order["entry_price"]) * order["quantity"]
                    else:
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


class PaperSpreadMTMTracker:
    def __init__(self, cred: dict, paper_book: PaperOrderBook):
        self.cred = cred
        self.paper_book = paper_book
        self.ws: Optional[KiteTicker] = None
        self.is_running = False
        self.last_print_time = 0.0

    def _publish_current_state(self) -> None:
        payload = build_spread_payload(
            paper_book=self.paper_book,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            strategy_name=STRATEGY_NAME,
            stop_loss_amount=STOP_LOSS_AMOUNT,
            target_amount=TARGET_AMOUNT,
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
                f"BUY {buy_leg['trading_symbol']} Entry={buy_leg['entry_price']:.2f} LTP={buy_leg['ltp']:.2f} PnL={buy_leg['pnl']:.2f} | "
                f"SELL {sell_leg['trading_symbol']} Entry={sell_leg['entry_price']:.2f} LTP={sell_leg['ltp']:.2f} PnL={sell_leg['pnl']:.2f} | "
                f"NET={total:.2f}"
            )

    def start(self) -> None:
        orders_df = self.paper_book.get_all_orders()
        if orders_df.empty or len(orders_df) < 2:
            return

        tokens = orders_df["instrument_token"].tolist()
        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.ws = kws
        self.is_running = True

        def on_ticks(ws, ticks):
            if not self.is_running:
                return
            if is_after_market_close_ist():
                self.paper_book.close_all_positions()
                self._publish_current_state()
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

        def on_connect(ws, response):
            log_and_print("Connected to option-leg MTM websocket.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.connect(threaded=True)


class AlphaBullCallSensex:
    def __init__(self, kite: KiteConnect, cred: dict, paper_book: PaperOrderBook):
        self.kite = kite
        self.cred = cred
        self.paper_book = paper_book
        self.quantity = QUANTITY
        self.trade_initialized = False
        self.expiry = None
        self.buy_strike = None
        self.sell_strike = None
        self.symbol_ce = "SENSEX"
        self.buy_leg_token = None
        self.sell_leg_token = None
        self.buy_leg_symbol = None
        self.sell_leg_symbol = None
        self.buy_entry_price = None
        self.sell_entry_price = None
        self.mtm_tracker: Optional[PaperSpreadMTMTracker] = None

    def quote_details(self) -> None:
        log_and_print("QD 1: building local SENSEX CE chain")
        self.expiry = str(self.cred["i_expiry_date_sensex"])

        df_ce = build_local_sensex_chain_with_ltp(
            kite=self.kite,
            expiry_str=self.expiry,
            option_type="CE",
            strike_step=STRIKE_STEP,
            strike_window=STRIKE_WINDOW,
        )

        if df_ce is None or df_ce.empty:
            raise ValueError("Local SENSEX CE chain is empty")

        log_and_print(f"QD 2: df_ce rows={len(df_ce)}")

        option_chain_ce = build_bull_call_candidates(df_ce=df_ce, strike_gaps=(200, 400))
        if option_chain_ce is None or option_chain_ce.empty:
            raise ValueError("No valid Sensex bull call spread candidates found in local chain")

        log_and_print(f"QD 3: candidate rows={len(option_chain_ce)}")

        best = option_chain_ce.iloc[0]
        self.buy_strike = int(best["buy_strike"])
        self.sell_strike = int(best["sell_strike"])

        log_and_print(
            f"QD 4: selected buy_strike={self.buy_strike}, "
            f"sell_strike={self.sell_strike}, expiry={self.expiry}"
        )

        buy_match = df_ce.loc[df_ce["strike"].astype(int) == self.buy_strike]
        sell_match = df_ce.loc[df_ce["strike"].astype(int) == self.sell_strike]

        if buy_match.empty:
            raise ValueError(f"Buy strike {self.buy_strike} not found in SENSEX CE chain")
        if sell_match.empty:
            raise ValueError(f"Sell strike {self.sell_strike} not found in SENSEX CE chain")

        buy_row = buy_match.iloc[0]
        sell_row = sell_match.iloc[0]

        self.buy_leg_token = int(buy_row["instrument_token"])
        self.sell_leg_token = int(sell_row["instrument_token"])
        self.buy_leg_symbol = str(buy_row["tradingsymbol"])
        self.sell_leg_symbol = str(sell_row["tradingsymbol"])
        self.buy_entry_price = float(buy_row["last_price_y"])
        self.sell_entry_price = float(sell_row["last_price_y"])

        log_and_print(
            "QD 5: legs resolved | "
            f"BUY {self.buy_leg_symbol} token={self.buy_leg_token} price={self.buy_entry_price:.2f} | "
            f"SELL {self.sell_leg_symbol} token={self.sell_leg_token} price={self.sell_entry_price:.2f}"
        )

    def place_orders(self) -> None:
        if self.trade_initialized:
            log_and_print("PO 1: trade already initialized, skipping place_orders")
            return

        log_and_print("PO 2: placing BUY order")
        self.paper_book.place_order(
            strategy_name=STRATEGY_NAME,
            symbol=self.symbol_ce,
            strike=self.buy_strike,
            expiry=self.expiry,
            side="BUY",
            quantity=self.quantity,
            right="CE",
            entry_price=self.buy_entry_price,
            instrument_token=self.buy_leg_token,
            trading_symbol=self.buy_leg_symbol,
        )

        log_and_print("PO 3: placing SELL order")
        self.paper_book.place_order(
            strategy_name=STRATEGY_NAME,
            symbol=self.symbol_ce,
            strike=self.sell_strike,
            expiry=self.expiry,
            side="SELL",
            quantity=self.quantity,
            right="CE",
            entry_price=self.sell_entry_price,
            instrument_token=self.sell_leg_token,
            trading_symbol=self.sell_leg_symbol,
        )

        self.trade_initialized = True
        log_and_print("PO 4: place_orders complete")

    def start(self) -> None:
        try:
            log_and_print("STEP 0: entered AlphaBullCallSensex.start()")
            log_and_print("STEP 1: waiting for SENSEX_BULL_CALL_LOCK")

            with SENSEX_BULL_CALL_LOCK:
                log_and_print("STEP 2: acquired SENSEX_BULL_CALL_LOCK")
                log_and_print("STEP 3: entering quote_details()")
                self.quote_details()
                log_and_print("STEP 4: quote_details() complete")
                log_and_print("STEP 5: entering place_orders()")
                self.place_orders()
                log_and_print("STEP 6: place_orders() complete")

            log_and_print("STEP 7: released SENSEX_BULL_CALL_LOCK")

            payload = build_spread_payload(
                paper_book=self.paper_book,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                strategy_name=STRATEGY_NAME,
                stop_loss_amount=STOP_LOSS_AMOUNT,
                target_amount=TARGET_AMOUNT,
            )
            publish_spread_update(payload)

            log_and_print("STEP 8: starting MTM tracker")
            self.mtm_tracker = PaperSpreadMTMTracker(self.cred, self.paper_book)
            self.mtm_tracker.start()
            log_and_print("STEP 9: MTM tracker started")

        except Exception as e:
            log_and_print(f"START FAILED: {e}", "error")
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


class EMACrossover1Min:
    def __init__(self, kite: KiteConnect, cred: dict, instrument_token: int = SENSEX_SPOT_TOKEN, preload_days: int = PRELOAD_DAYS):
        self.kite = kite
        self.cred = cred
        self.token = instrument_token
        self.preload_days = preload_days
        self.onemin_bars = self._load_history()
        self._stop_flag = False
        self._ws: Optional[KiteTicker] = None
        self.last_trade_signal = 0

    def _load_history(self) -> pd.DataFrame:
        try:
            end_dt = datetime.today()
            start_dt = end_dt - timedelta(days=self.preload_days)
            hist = self.kite.historical_data(self.token, start_dt, end_dt, "minute")
            df = pd.DataFrame(hist)
            if df.empty:
                return pd.DataFrame(columns=["open", "high", "low", "close"])
            df["datetime"] = pd.to_datetime(df["date"], utc=True).dt.tz_convert(IST)
            return df.set_index("datetime")[["open", "high", "low", "close"]].sort_index()
        except Exception:
            return pd.DataFrame(columns=["open", "high", "low", "close"])

    def _stop_stream(self) -> None:
        self._stop_flag = True
        try:
            if self._ws:
                self._ws.unsubscribe([self.token])
                self._ws.close()
        except Exception:
            pass

    def start(self, rider: AlphaBullCallSensex) -> None:
        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self._ws = kws

        def on_ticks(ws, ticks):
            if self._stop_flag:
                return

        def on_connect(ws, response):
            log_and_print("WS 1: on_connect fired")
            ws.subscribe([self.token])
            ws.set_mode(ws.MODE_LTP, [self.token])

            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Connected to live SENSEX feed. Monitoring for bullish trigger...",
                progress_text="Live feed active",
                is_loading=True,
            )

            def _inject_test_signal():
                log_and_print("WS 2: inject_test_signal started")
                time.sleep(3)
                if self._stop_flag or self.last_trade_signal == 1:
                    return
                self.last_trade_signal = 1
                self._stop_stream()

                def _launch():
                    try:
                        log_and_print("WS 3: about to call rider.start()")
                        rider.start()
                    except Exception as e:
                        log_and_print(f"AlphaBullCallSensex.start() failed: {e}", "error")
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

                threading.Thread(target=_launch, daemon=True).start()

            threading.Thread(target=_inject_test_signal, daemon=True).start()

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.connect(threaded=True)


def main():
    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="BOOTING",
        message="Strategy process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    log_and_print("MAIN 1: entered main()")

    if not is_weekday_ist(current_ist()):
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy is inactive outside working days.",
            is_loading=False,
        )
        return

    wait_until_market_open()
    log_and_print("MAIN 2: passed wait_until_market_open()")

    try:
        cred = load_creds()
        log_and_print("MAIN 3: creds loaded")

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("MAIN 4: kite initialized")

        paper_book = PaperOrderBook()
        log_and_print("MAIN 5: paper book created")

        sensex_ema = EMACrossover1Min(
            kite=kite,
            cred=cred,
            instrument_token=SENSEX_SPOT_TOKEN,
            preload_days=PRELOAD_DAYS,
        )
        alpha_bull = AlphaBullCallSensex(kite=kite, cred=cred, paper_book=paper_book)
        log_and_print("MAIN 6: about to start EMA stream")
        sensex_ema.start(alpha_bull)

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
