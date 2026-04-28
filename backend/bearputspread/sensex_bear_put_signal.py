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
from shared.strategy_locks import SENSEX_BEAR_PUT_LOCK

INDEX_NAME = "SENSEX"
SPREAD_TYPE = "put_debit"
STRATEGY_NAME = "ALPHA_BEAR_PAPER"

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
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

SENSEX_EXPIRY_WEEKS_AHEAD = int(os.getenv("SENSEX_EXPIRY_WEEKS_AHEAD", "0"))
LOG_FILE_NAME = "sensex_bear_put_spread.log"

IST = pytz.timezone("Asia/Kolkata")

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
        message = "Bear put spread is live."
        is_loading = False
    elif status == "CLOSED":
        message = "Bear put spread closed."
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
                if buy_leg and buy_leg.get("timestamp") is not None else None,
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
                if sell_leg and sell_leg.get("timestamp") is not None else None,
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


def is_before_market_open_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    market_open, _ = get_market_open_close_ist(now_ist)
    return now_ist < market_open


def is_market_hours_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    market_open, market_close = get_market_open_close_ist(now_ist)
    return market_open <= now_ist <= market_close


def resolve_sensex_weekly_expiry() -> str:
    """
    SENSEX weekly expiry is treated as Thursday in this strategy.
    On Thursday, this code shifts to next Thursday to avoid same-day expiry.
    """
    today = current_ist().date()
    weekday = today.weekday()  # Monday=0 ... Thursday=3

    if weekday == 3:
        expiry = today + timedelta(days=7)
    else:
        days_ahead = (3 - weekday) % 7
        expiry = today + timedelta(days=days_ahead)

    expiry = expiry + timedelta(days=7 * max(SENSEX_EXPIRY_WEEKS_AHEAD, 0))
    log_and_print(f"EXPIRY RESOLVED | SENSEX Thursday expiry={expiry.strftime('%Y-%m-%d')}")
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


def build_bear_put_candidates(
    df_pe: pd.DataFrame,
    strike_gaps: tuple[int, ...] = (200, 400),
    rr_target: float = 1.70,
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

    for sell_strike in strikes:
        for gap in strike_gaps:
            buy_strike = sell_strike + gap

            if buy_strike not in strike_to_row:
                continue

            buy_row = strike_to_row[buy_strike]
            sell_row = strike_to_row[sell_strike]

            buy_price = float(buy_row["last_price_y"])
            sell_price = float(sell_row["last_price_y"])

            spread_width = buy_strike - sell_strike
            net_debit = buy_price - sell_price

            if net_debit <= 0:
                continue

            max_loss = net_debit
            max_profit = spread_width - net_debit

            if max_profit <= 0:
                continue

            rr = max_profit / max_loss
            rr_distance = abs(rr - rr_target)

            candidates.append(
                {
                    "buy_strike": buy_strike,
                    "sell_strike": sell_strike,
                    "buy_price": buy_price,
                    "sell_price": sell_price,
                    "net_debit": net_debit,
                    "spread_width": spread_width,
                    "max_profit": max_profit,
                    "max_loss": max_loss,
                    "rr": rr,
                    "rr_distance": rr_distance,
                    "gap": gap,
                }
            )

    if not candidates:
        return pd.DataFrame()

    return pd.DataFrame(candidates).sort_values(
        by=["rr_distance", "rr", "spread_width"],
        ascending=[True, False, False],
    ).reset_index(drop=True)


def get_spot_ltp(kite: KiteConnect) -> float:
    last_error = None
    for symbol in SENSEX_SPOT_SYMBOLS:
        try:
            quote = kite.ltp([symbol])
            if symbol in quote:
                ltp = quote[symbol].get("last_price")
                if ltp is not None and float(ltp) > 0:
                    log_and_print(f"Spot symbol resolved: {symbol} | LTP={float(ltp):.2f}")
                    return float(ltp)
        except Exception as e:
            last_error = e
    raise ValueError(f"Unable to fetch valid SENSEX spot LTP. Last error={last_error}")


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
    df["expiry"] = pd.to_datetime(df["expiry"], errors="coerce").dt.date
    df["strike"] = pd.to_numeric(df["strike"], errors="coerce")

    valid_names = {"SENSEX", "SENSEX 50"}
    df = df[
        (df["name"].astype(str).str.upper().isin(valid_names))
        & (df["instrument_type"].astype(str).str.upper() == option_type.upper())
        & (df["expiry"] == expiry_date)
        & (df["strike"].notna())
    ].copy()

    log_and_print(
        f"Instrument filter | option_type={option_type} | expiry={expiry_str} | rows={len(df)}"
    )

    if df.empty:
        raise ValueError(f"No SENSEX {option_type} instruments found for expiry {expiry_str}")

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
    log_and_print(f"Using expiry: {expiry_str}")

    df = load_sensex_option_instruments(kite, expiry_str, option_type)
    df = df[(df["strike"] >= lower_strike) & (df["strike"] <= upper_strike)].copy()

    log_and_print(f"Post strike-range filter rows={len(df)}")

    if df.empty:
        raise ValueError(f"No SENSEX {option_type} instruments inside strike range {lower_strike}-{upper_strike}")

    df["quote_symbol"] = df["tradingsymbol"].astype(str).map(lambda x: f"{SENSEX_EXCHANGE_SEGMENT}:{x}")
    quote_symbols = df["quote_symbol"].dropna().tolist()
    if not quote_symbols:
        raise ValueError(f"Quote symbol list is empty for SENSEX {option_type}")

    log_and_print(f"LTP fetch symbol count={len(quote_symbols)}")

    try:
        quotes = kite.ltp(quote_symbols)
    except Exception as e:
        raise ValueError(f"SENSEX {option_type} ltp fetch failed: {e}") from e

    df["last_price_y"] = df["quote_symbol"].map(
        lambda s: float(quotes.get(s, {}).get("last_price", 0.0))
    )

    df = df[df["last_price_y"] > 0].copy()
    log_and_print(f"Post LTP filter rows={len(df)}")

    if df.empty:
        raise ValueError(f"All fetched LTPs are invalid/zero for SENSEX {option_type}")

    return df.sort_values("strike").reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────────
# PAPER ORDER BOOK
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# MTM TRACKER  (option-leg websocket — live PnL + exit logic)
# ─────────────────────────────────────────────────────────────────────────────

class PaperSpreadMTMTracker:
    def __init__(self, cred: dict, paper_book: PaperOrderBook, done_event: threading.Event):
        self.cred = cred
        self.paper_book = paper_book
        self.ws: Optional[KiteTicker] = None
        self.is_running = False
        self.last_print_time = 0.0
        # Signals the main thread that the strategy has fully completed
        self._done_event = done_event

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
                f"BUY {buy_leg['trading_symbol']} Entry={buy_leg['entry_price']:.2f} "
                f"LTP={buy_leg['ltp']:.2f} PnL={buy_leg['pnl']:.2f} | "
                f"SELL {sell_leg['trading_symbol']} Entry={sell_leg['entry_price']:.2f} "
                f"LTP={sell_leg['ltp']:.2f} PnL={sell_leg['pnl']:.2f} | "
                f"NET={total:.2f}"
            )

    def _shutdown(self, ws, tokens: list, reason: str) -> None:
        """Central shutdown — close positions, publish final state, stop WS, unblock main."""
        log_and_print(f"MTM SHUTDOWN | reason={reason}")
        self.paper_book.close_all_positions()
        self._publish_current_state()
        self.is_running = False
        try:
            ws.unsubscribe(tokens)
            ws.close()
        except Exception:
            pass
        self._done_event.set()

    def force_close_positions(self) -> None:
        """Called by main watchdog when market closes and ticks have gone silent."""
        log_and_print("WATCHDOG FORCE CLOSE | Closing all positions at market end.")
        self.paper_book.close_all_positions()
        self._publish_current_state()
        self.is_running = False
        try:
            if self.ws:
                self.ws.close()
        except Exception:
            pass

    def start(self) -> None:
        orders_df = self.paper_book.get_all_orders()
        if orders_df.empty or len(orders_df) < 2:
            log_and_print("MTM START | No open orders — skipping MTM websocket.", "warning")
            self._done_event.set()
            return

        tokens = orders_df["instrument_token"].tolist()
        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.ws = kws
        self.is_running = True

        def on_ticks(ws, ticks):
            if not self.is_running:
                return

            # Market close protection
            if is_after_market_close_ist():
                log_and_print("MARKET CLOSED | Closing bear put spread and stopping MTM websocket.")
                self._shutdown(ws, tokens, "MARKET_CLOSE")
                return

            # Update live PnL for each tick
            for tick in ticks:
                token = tick.get("instrument_token")
                ltp = tick.get("last_price")
                if token is None or ltp is None or ltp <= 0:
                    continue
                self.paper_book.update_ltp_and_pnl(token, float(ltp))

            total_pnl = self.paper_book.total_pnl()

            # Stop loss check
            if total_pnl <= STOP_LOSS_AMOUNT:
                log_and_print(
                    f"🛑 STOP LOSS HIT | NET PnL={total_pnl:.2f} | SL={STOP_LOSS_AMOUNT:.2f}"
                )
                self._shutdown(ws, tokens, "STOP_LOSS")
                return

            # Target check
            if total_pnl >= TARGET_AMOUNT:
                log_and_print(
                    f"🎯 TARGET HIT | NET PnL={total_pnl:.2f} | TARGET={TARGET_AMOUNT:.2f}"
                )
                self._shutdown(ws, tokens, "TARGET")
                return

            current_time = time.time()
            if current_time - self.last_print_time >= 1.0:
                self._log_live_mtm()
                self.last_print_time = current_time

            self._publish_current_state()

        def on_connect(ws, response):
            log_and_print("Connected to option-leg MTM websocket.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

        def on_error(ws, code, reason):
            # Unblock main thread so process does not hang on Render
            log_and_print(f"MTM WS ERROR | code={code} reason={reason}", "error")
            self.is_running = False
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message=f"MTM websocket error: {reason}",
                progress_text="Check Render logs",
                is_loading=False,
            )
            self._done_event.set()

        def on_close(ws, code, reason):
            log_and_print(f"MTM WS CLOSED | code={code} reason={reason}")
            # If closed unexpectedly while still live, unblock main
            if self.is_running:
                self.is_running = False
                self._done_event.set()

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.on_error = on_error
        kws.on_close = on_close
        kws.connect(threaded=True)


# ─────────────────────────────────────────────────────────────────────────────
# ALPHA BEAR PUT  (spread builder + paper order placer)
# ─────────────────────────────────────────────────────────────────────────────

class AlphaBearPutSensex:
    def __init__(self, kite: KiteConnect, cred: dict, paper_book: PaperOrderBook, done_event: threading.Event):
        self.kite = kite
        self.cred = cred
        self.paper_book = paper_book
        self.quantity = QUANTITY
        self.trade_initialized = False
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
        self.mtm_tracker: Optional[PaperSpreadMTMTracker] = None
        self._done_event = done_event

    def quote_details(self) -> None:
        log_and_print("QD 1: building local SENSEX PE chain")
        self.expiry = str(self.cred["i_expiry_date_sensex"])

        df_pe = build_local_sensex_chain_with_ltp(
            kite=self.kite,
            expiry_str=self.expiry,
            option_type="PE",
            strike_step=STRIKE_STEP,
            strike_window=STRIKE_WINDOW,
        )

        if df_pe is None or df_pe.empty:
            raise ValueError("Local SENSEX PE chain is empty")

        log_and_print(f"QD 2: df_pe rows={len(df_pe)}")

        option_chain_pe = build_bear_put_candidates(
            df_pe=df_pe,
            strike_gaps=(200, 400),
            rr_target=1.70,
        )
        if option_chain_pe is None or option_chain_pe.empty:
            raise ValueError("No valid SENSEX bear put spread candidates found in local chain")

        log_and_print(f"QD 3: candidate rows={len(option_chain_pe)}")

        best = option_chain_pe.iloc[0]
        self.buy_strike = int(best["buy_strike"])
        self.sell_strike = int(best["sell_strike"])

        log_and_print(
            f"QD 4: selected buy_strike={self.buy_strike}, "
            f"sell_strike={self.sell_strike}, expiry={self.expiry}"
        )

        buy_match = df_pe.loc[df_pe["strike"].astype(int) == self.buy_strike]
        sell_match = df_pe.loc[df_pe["strike"].astype(int) == self.sell_strike]

        if buy_match.empty:
            raise ValueError(f"Buy strike {self.buy_strike} not found in SENSEX PE chain")
        if sell_match.empty:
            raise ValueError(f"Sell strike {self.sell_strike} not found in SENSEX PE chain")

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

        log_and_print("PO 2: placing BUY PE order")
        self.paper_book.place_order(
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

        log_and_print("PO 3: placing SELL PE order")
        self.paper_book.place_order(
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
        self.trade_initialized = True
        log_and_print("PO 4: place_orders complete")

    def start(self) -> None:
        try:
            log_and_print("STEP 0: entered AlphaBearPut.start()")
            log_and_print("STEP 1: waiting for SENSEX_BEAR_PUT_LOCK")

            with SENSEX_BEAR_PUT_LOCK:
                log_and_print("STEP 2: acquired SENSEX_BEAR_PUT_LOCK")
                log_and_print("STEP 3: entering quote_details()")
                self.quote_details()
                log_and_print("STEP 4: quote_details() complete")
                log_and_print("STEP 5: entering place_orders()")
                self.place_orders()
                log_and_print("STEP 6: place_orders() complete")

            log_and_print("STEP 7: released SENSEX_BEAR_PUT_LOCK")

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
            self.mtm_tracker = PaperSpreadMTMTracker(self.cred, self.paper_book, self._done_event)
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
            # Unblock main even on error so the process can exit
            self._done_event.set()


# ─────────────────────────────────────────────────────────────────────────────
# EMA CROSSOVER  (SENSEX spot signal detection — bearish: EMA5 crosses below EMA55)
# ─────────────────────────────────────────────────────────────────────────────

class EMACrossover1Min:
    def __init__(
        self,
        kite: KiteConnect,
        cred: dict,
        done_event: threading.Event,
        instrument_token: int = SENSEX_SPOT_TOKEN,
        preload_days: int = PRELOAD_DAYS,
    ):
        self.kite = kite
        self.cred = cred
        self.token = instrument_token
        self.preload_days = preload_days
        self.onemin_bars = self._load_history()
        self.prev_minute = None
        self.tick_buffer = pd.DataFrame(columns=["last_price"])
        self.last_trade_signal = 0

        # LIVE-ONLY SIGNAL CONTROL:
        # Historical candles are used only to warm EMA values.
        # We block trades until at least 2 completed live candles exist.
        self.live_completed_candles: int = 0
        # Record the last timestamp from historical data exactly once.
        # Live candles are filtered using this fixed cutoff — NOT using
        # onemin_bars.index.max() which grows with every appended live candle
        # and would silently filter out all candles after the first one.
        self.history_cutoff_ts = (
            self.onemin_bars.index.max() if not self.onemin_bars.empty else None
        )
        log_and_print(
            f"HISTORY CUTOFF | ts={self.history_cutoff_ts} | "
            f"history_rows={len(self.onemin_bars)}"
        )

        self._stop_flag = False
        self._ws: Optional[KiteTicker] = None
        self._done_event = done_event

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
        except Exception as e:
            log_and_print(f"History load failed (continuing without): {e}", "warning")
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
            return

        if ltt.minute != self.prev_minute:
            ohlc = self.tick_buffer["last_price"].resample("1min").ohlc().iloc[:-1]
            if not ohlc.empty:
                ohlc["signal"] = 0

                # Filter using the FIXED history cutoff, not the growing
                # onemin_bars.index.max(). Using index.max() after appending
                # live candles means every subsequent live candle gets filtered
                # out — silently killing the stream after candle 1.
                if self.history_cutoff_ts is not None:
                    ohlc = ohlc[ohlc.index > self.history_cutoff_ts]

                if not ohlc.empty:
                    self.onemin_bars = pd.concat([self.onemin_bars, ohlc])
                    self.onemin_bars = self.onemin_bars[~self.onemin_bars.index.duplicated(keep="last")]
                    self.onemin_bars = self.onemin_bars.sort_index()

                    # Count only completed live candles, not historical candles.
                    self.live_completed_candles += len(ohlc)
                    log_and_print(
                        f"LIVE CANDLE COMPLETED | live_completed_candles={self.live_completed_candles} | "
                        f"Last={self.onemin_bars.index[-1].strftime('%H:%M:%S')}"
                    )

                    self._update_ema_crossover(rider)

            self.tick_buffer = row
            self.prev_minute = ltt.minute

    def _stop_sensex_stream(self) -> None:
        self._stop_flag = True
        try:
            if self._ws:
                self._ws.unsubscribe([self.token])
                self._ws.close()
        except Exception:
            pass

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
            f"Close={latest['close']:.2f} | EMA5={latest['EMA5']:.2f} | EMA55={latest['EMA55']:.2f}"
        )

        self.onemin_bars.iloc[-1, self.onemin_bars.columns.get_loc("signal")] = 0

        # ── BEARISH CROSSOVER CHECK ──────────────────────────────────────────
        # Fires ONLY when EMA5 transitions from >= EMA55  →  < EMA55.
        # This is the mirror of the bull call crossover.
        # Prevents false entry when EMA5 is already below EMA55 at startup.
        signal_condition = bool(
            prev["EMA5"] >= prev["EMA55"] and latest["EMA5"] < latest["EMA55"]
        )
        # ─────────────────────────────────────────────────────────────────────

        log_and_print(
            f"CHECKING SIGNAL | PrevEMA5={prev['EMA5']:.2f} | PrevEMA55={prev['EMA55']:.2f} | "
            f"EMA5={latest['EMA5']:.2f} | EMA55={latest['EMA55']:.2f} | "
            f"Crossover={signal_condition} | LiveCandles={self.live_completed_candles}"
        )

        # LIVE CANDLE GATE:
        # Block any signal until at least 2 fully live candles have completed.
        # This prevents false entries from a history/live boundary crossover.
        if self.live_completed_candles < 2:
            log_and_print(
                f"WAITING LIVE CONFIRMATION | live_completed_candles={self.live_completed_candles} < 2"
            )
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Monitoring market conditions for bearish entry trigger...",
                progress_text="Live SENSEX feed active",
                is_loading=True,
            )
            return

        if signal_condition and self.last_trade_signal != 1:
            log_and_print(
                f"✅ EMA BEARISH CROSSOVER SIGNAL | EMA5 crossed below EMA55 | "
                f"PrevEMA5={prev['EMA5']:.2f} PrevEMA55={prev['EMA55']:.2f} | "
                f"CurrEMA5={latest['EMA5']:.2f} CurrEMA55={latest['EMA55']:.2f}"
            )
            self.last_trade_signal = 1
            self._stop_sensex_stream()

            def _launch_rider():
                try:
                    log_and_print("WS 3: about to call rider.start()")
                    rider.start()
                except Exception as e:
                    log_and_print(f"AlphaBearPut.start() failed: {e}", "error")
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
                    self._done_event.set()

            threading.Thread(target=_launch_rider, daemon=True).start()

        else:
            # No crossover yet — publish waiting state with live EMA values
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="WAITING_SIGNAL",
                message="Monitoring market conditions for bearish entry trigger...",
                progress_text="Live SENSEX feed active",
                is_loading=True,
            )

    def start(self, rider: AlphaBearPutSensex) -> None:
        tokens = [self.token]
        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self._ws = kws

        def on_ticks(ws, ticks):
            if self._stop_flag:
                return

            if not is_market_hours_ist():
                log_and_print("OUTSIDE MARKET HOURS | Stopping SENSEX EMA websocket.")
                self._stop_sensex_stream()
                publish_strategy_state(
                    strategy_name=STRATEGY_NAME,
                    index_name=INDEX_NAME,
                    spread_type=SPREAD_TYPE,
                    ui_state="STOPPED",
                    message="Strategy stopped. No crossover signal before market close.",
                    progress_text="Market closed",
                    is_loading=False,
                )
                # No trade happened — unblock main so process exits cleanly
                self._done_event.set()
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
            log_and_print("WS 1: on_connect fired")
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

        def on_error(ws, code, reason):
            # Unblock main thread so process does not hang on Render
            log_and_print(f"EMA WS ERROR | code={code} reason={reason}", "error")
            publish_strategy_state(
                strategy_name=STRATEGY_NAME,
                index_name=INDEX_NAME,
                spread_type=SPREAD_TYPE,
                ui_state="ERROR",
                message=f"EMA websocket error: {reason}",
                progress_text="Check Render logs",
                is_loading=False,
            )
            self._done_event.set()

        def on_close(ws, code, reason):
            log_and_print(f"EMA WS CLOSED | code={code} reason={reason}")
            # Closed before any crossover fired — unblock main
            if not self._stop_flag and self.last_trade_signal == 0:
                self._done_event.set()

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect
        kws.on_error = on_error
        kws.on_close = on_close
        kws.connect(threaded=True)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

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

    # Weekday check
    if not is_weekday_ist(current_ist()):
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy is inactive outside working days.",
            is_loading=False,
        )
        log_and_print("STOPPED | Not a weekday. Exiting.")
        return

    now = current_ist()

    # Before market open
    if is_before_market_open_ist(now):
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy not started. Market is not open yet.",
            progress_text="Outside market hours",
            is_loading=False,
        )
        log_and_print("STOPPED | Market not open yet. Exiting to save Render runtime.")
        return

    # After market close
    if is_after_market_close_ist(now):
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy stopped. Market is already closed.",
            progress_text="Outside market hours",
            is_loading=False,
        )
        log_and_print("STOPPED | Market already closed. Exiting to save Render runtime.")
        return

    log_and_print("MAIN 2: inside market hours — proceeding")

    # ── threading.Event keeps main thread alive until strategy fully finishes ─
    # All terminal paths — SL, target, market close, WS error, exception —
    # call done_event.set(). Without this, main() returns immediately after
    # sensex_ema.start() and Python kills every daemon thread (both websockets).
    done_event = threading.Event()

    try:
        cred = load_creds()
        log_and_print(f"MAIN 3: creds loaded | expiry={cred['i_expiry_date_sensex']}")

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("MAIN 4: kite initialized")

        paper_book = PaperOrderBook()
        log_and_print("MAIN 5: paper book created")

        sensex_ema = EMACrossover1Min(
            kite=kite,
            cred=cred,
            done_event=done_event,
            instrument_token=SENSEX_SPOT_TOKEN,
            preload_days=PRELOAD_DAYS,
        )
        alpha_bear = AlphaBearPutSensex(
            kite=kite,
            cred=cred,
            paper_book=paper_book,
            done_event=done_event,
        )

        log_and_print("MAIN 6: starting EMA crossover stream")
        sensex_ema.start(alpha_bear)

        # Block until strategy finishes (SL / Target / Market close / Error / WS drop).
        #
        # IMPORTANT PRODUCTION SAFETY:
        # We do not use plain done_event.wait() forever because websocket ticks can stop.
        # If no tick arrives after market close, on_ticks will not run and the process
        # can remain alive on Render unnecessarily. This loop wakes every 2 seconds
        # and force-closes the paper spread after market close.
        log_and_print("MAIN 7: waiting for strategy completion...")

        while not done_event.is_set():
            if is_after_market_close_ist():
                log_and_print("MAIN MARKET CLOSE WATCHDOG | Force closing bear put strategy and exiting.")

                try:
                    if alpha_bear.mtm_tracker is not None and alpha_bear.mtm_tracker.is_running:
                        alpha_bear.mtm_tracker.force_close_positions()
                    else:
                        paper_book.close_all_positions()
                        final_payload = build_spread_payload(
                            paper_book=paper_book,
                            index_name=INDEX_NAME,
                            spread_type=SPREAD_TYPE,
                            strategy_name=STRATEGY_NAME,
                            stop_loss_amount=STOP_LOSS_AMOUNT,
                            target_amount=TARGET_AMOUNT,
                        )
                        publish_spread_update(final_payload)

                    sensex_ema._stop_sensex_stream()

                except Exception as close_exc:
                    log_and_print(
                        f"MAIN MARKET CLOSE WATCHDOG failed to publish final state: {close_exc}",
                        "error",
                    )

                done_event.set()
                break

            done_event.wait(timeout=2.0)

        log_and_print("MAIN 8: strategy complete — exiting cleanly.")

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
