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

from shared.intraday_spreads_state import spread_state
from shared.option_chain_build_lock import OPTION_CHAIN_BUILD_LOCK

INDEX_NAME = "SENSEX"
SPREAD_TYPE = "bull_call"
STRATEGY_NAME = "ALPHA_BULL_SENSEX"

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

    if now_ist > market_close:
        raise SystemExit

    if now_ist >= market_open:
        return

    sleep_seconds = int((market_open - now_ist).total_seconds())
    for _ in range(sleep_seconds):
        time.sleep(1)


def resolve_sensex_weekly_expiry() -> str:
    today = current_ist().date()
    days_ahead = (3 - today.weekday()) % 7
    expiry = today if days_ahead == 0 else today + timedelta(days=days_ahead)
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


def patch_nfo_util_config(nfo_util_module, cred: dict) -> None:
    if hasattr(nfo_util_module, "load_creds"):
        nfo_util_module.load_creds = lambda: cred
    setattr(nfo_util_module, "i_inst_name_sensex", cred["i_inst_name_sensex"])
    setattr(nfo_util_module, "i_expiry_date_sensex", cred["i_expiry_date_sensex"])
    setattr(nfo_util_module, "z_api_key", cred["z_api_key"])
    setattr(nfo_util_module, "z_access_token", cred["z_access_token"])


def build_bull_call_candidates(df_ce: pd.DataFrame, strike_gaps: tuple[int, ...] = (100, 200)) -> pd.DataFrame:
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
        ensure_cred_yml(self.cred)
        from option_spreads import nfo_util
        patch_nfo_util_config(nfo_util, self.cred)

        tokens = nfo_util.get_instrument_tokens_ce_sensex()
        if not tokens:
            raise ValueError("No SENSEX CE tokens returned from nfo_util.get_instrument_tokens_ce_sensex()")

        _ = self.kite.ltp(tokens)
        df_ce = nfo_util.build_sensex_ce_chain_100_strike_with_ltp()

        if df_ce is None or df_ce.empty:
            raise ValueError("df_ce is empty. Could not build SENSEX CE option chain.")

        option_chain_ce = build_bull_call_candidates(df_ce=df_ce, strike_gaps=(100, 200))
        if option_chain_ce is None or option_chain_ce.empty:
            raise ValueError("No valid Sensex bull call spread candidates found in option chain.")

        best = option_chain_ce.iloc[0]
        self.buy_strike = int(best["buy_strike"])
        self.sell_strike = int(best["sell_strike"])
        self.expiry = str(self.cred["i_expiry_date_sensex"])

        buy_match = df_ce.loc[df_ce["strike"].astype(int) == self.buy_strike]
        sell_match = df_ce.loc[df_ce["strike"].astype(int) == self.sell_strike]

        if buy_match.empty or sell_match.empty:
            raise ValueError("Selected SENSEX CE strikes not found in option chain.")

        buy_row = buy_match.iloc[0]
        sell_row = sell_match.iloc[0]

        self.buy_leg_token = int(buy_row["instrument_token"])
        self.sell_leg_token = int(sell_row["instrument_token"])
        self.buy_leg_symbol = str(buy_row["tradingsymbol"])
        self.sell_leg_symbol = str(sell_row["tradingsymbol"])
        self.buy_entry_price = float(buy_row["last_price_y"])
        self.sell_entry_price = float(sell_row["last_price_y"])

        log_and_print(
            f"✅ Selected Spread | Buy Strike = {self.buy_strike} | Sell Strike = {self.sell_strike} | Expiry = {self.expiry}"
        )

    def place_orders(self) -> None:
        if self.trade_initialized:
            return

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

    def start(self) -> None:
        with OPTION_CHAIN_BUILD_LOCK:
            self.quote_details()
            self.place_orders()

        payload = build_spread_payload(
            paper_book=self.paper_book,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            strategy_name=STRATEGY_NAME,
            stop_loss_amount=STOP_LOSS_AMOUNT,
            target_amount=TARGET_AMOUNT,
        )
        publish_spread_update(payload)

        self.mtm_tracker = PaperSpreadMTMTracker(self.cred, self.paper_book)
        self.mtm_tracker.start()


class EMACrossover1Min:
    def __init__(self, kite: KiteConnect, cred: dict, instrument_token: int = SENSEX_SPOT_TOKEN, preload_days: int = PRELOAD_DAYS):
        self.kite = kite
        self.cred = cred
        self.token = instrument_token
        self.preload_days = preload_days
        self.onemin_bars = self._load_history()
        self.last_trade_signal = 0
        self._stop_flag = False
        self._ws: Optional[KiteTicker] = None

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
            if self._stop_flag:
                return
            log_and_print("Connected & subscribed to SENSEX EMA stream.")
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
                time.sleep(3)
                if self._stop_flag or self.last_trade_signal == 1:
                    return
                self.last_trade_signal = 1
                self._stop_stream()

                def _launch():
                    try:
                        log_and_print("🚀 _launch_rider: calling rider.start()")
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

    try:
        cred = load_creds()
        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])

        paper_book = PaperOrderBook()
        sensex_ema = EMACrossover1Min(kite=kite, cred=cred, instrument_token=SENSEX_SPOT_TOKEN, preload_days=PRELOAD_DAYS)
        alpha_bull = AlphaBullCallSensex(kite=kite, cred=cred, paper_book=paper_book)
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
