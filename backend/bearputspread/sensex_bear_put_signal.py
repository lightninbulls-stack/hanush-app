from __future__ import annotations

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
# CONFIG
# =========================================================
INDEX_NAME = "SENSEX"
SPREAD_TYPE = "bear_put"
STRATEGY_NAME = "SENSEX_BEAR_PAPER"

SENSEX_SPOT_TOKEN = int(os.getenv("SENSEX_SPOT_TOKEN", "0"))

QUANTITY = 30
STOP_LOSS_AMOUNT = -1500.0
TARGET_AMOUNT = 3000.0

IST = pytz.timezone("Asia/Kolkata")

# =========================================================
# LOGGING
# =========================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("sensex_bear")


def log(msg):
    print(msg)
    logger.info(msg)


# =========================================================
# EXPIRY (THURSDAY)
# =========================================================
def resolve_sensex_expiry():
    today = datetime.now(IST).date()
    days_ahead = (3 - today.weekday()) % 7  # Thursday = 3
    expiry = today if days_ahead == 0 else today + timedelta(days=days_ahead)
    return expiry.strftime("%Y%m%d")


def load_creds():
    return {
        "z_api_key": os.environ["Z_API_KEY"],
        "z_access_token": os.environ["Z_ACCESS_TOKEN"],
        "i_expiry_date_sensex": resolve_sensex_expiry(),
        "i_inst_name_sensex": "SENSEX",
    }


# =========================================================
# STATE PUBLISH
# =========================================================
def publish(payload):
    spread_state.update(payload["strategy_name"], payload)


# =========================================================
# PAPER BOOK
# =========================================================
class PaperBook:
    def __init__(self):
        self.orders = []
        self.lock = threading.Lock()

    def place(self, side, symbol, token, price):
        order = {
            "side": side,
            "trading_symbol": symbol,
            "instrument_token": token,
            "entry_price": price,
            "ltp": price,
            "pnl": 0.0,
            "timestamp": datetime.now(IST),
            "status": "OPEN",
        }
        with self.lock:
            self.orders.append(order)

    def update(self, token, ltp):
        with self.lock:
            for o in self.orders:
                if o["instrument_token"] == token:
                    o["ltp"] = ltp
                    if o["side"] == "BUY":
                        o["pnl"] = (ltp - o["entry_price"]) * QUANTITY
                    else:
                        o["pnl"] = (o["entry_price"] - ltp) * QUANTITY

    def snapshot(self):
        with self.lock:
            return [o.copy() for o in self.orders]

    def total_pnl(self):
        return sum(o["pnl"] for o in self.orders)


# =========================================================
# PAYLOAD
# =========================================================
def build_payload(book: PaperBook):
    orders = book.snapshot()

    pnl = book.total_pnl()

    entry_time = None
    if orders:
        entry_time = min(o["timestamp"] for o in orders).strftime("%H:%M:%S")

    return {
        "index": INDEX_NAME,
        "spread_type": SPREAD_TYPE,
        "strategy_name": STRATEGY_NAME,
        "status": "OPEN" if orders else "WAITING_SIGNAL",
        "net_pnl": pnl,
        "entry_time": entry_time,
        "stop_loss": STOP_LOSS_AMOUNT,
        "target": TARGET_AMOUNT,
        "legs": [
            {
                "side": o["side"],
                "trading_symbol": o["trading_symbol"],
                "avg_price": o["entry_price"],
                "ltp": o["ltp"],
                "pnl": o["pnl"],
                "entry_time": o["timestamp"].strftime("%H:%M:%S"),
            }
            for o in orders
        ],
    }


# =========================================================
# MTM TRACKER + PNL CURVE
# =========================================================
class Tracker:
    def __init__(self, book):
        self.book = book
        self.pnl_history = []
        self.entry_marker = None

    def update(self):
        payload = build_payload(self.book)

        now = datetime.now(IST).strftime("%H:%M:%S")
        pnl = payload["net_pnl"]

        self.pnl_history.append({"time": now, "pnl": pnl})
        self.pnl_history = self.pnl_history[-200:]

        peak = None
        curve = []

        for p in self.pnl_history:
            peak = p["pnl"] if peak is None else max(peak, p["pnl"])
            drawdown = p["pnl"] - peak

            curve.append({
                "time": p["time"],
                "pnl": p["pnl"],
                "stop_loss": STOP_LOSS_AMOUNT,
                "target": TARGET_AMOUNT,
                "drawdown": drawdown,
            })

        payload["pnl_curve"] = curve
        payload["entry_marker_time"] = payload["entry_time"]

        publish(payload)


# =========================================================
# STRATEGY
# =========================================================
class BearPutStrategy:
    def __init__(self, kite, cred):
        self.kite = kite
        self.cred = cred
        self.book = PaperBook()
        self.tracker = Tracker(self.book)

    def enter(self):
        from option_spreads import nfo_util

        # IMPORTANT: you must have sensex functions
        df = nfo_util.build_sensex_pe_chain_100_strike_with_ltp()

        spread = nfo_util.bear_put_spreads_sensex(df)

        itm = int(spread.loc[0, "buy_strike"])
        otm = int(spread.loc[0, "sell_strike"])

        buy = df[df["strike"] == itm].iloc[0]
        sell = df[df["strike"] == otm].iloc[0]

        self.book.place("BUY", buy["tradingsymbol"], buy["instrument_token"], buy["last_price_y"])
        self.book.place("SELL", sell["tradingsymbol"], sell["instrument_token"], sell["last_price_y"])

    def start(self):
        self.enter()

        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])

        tokens = [o["instrument_token"] for o in self.book.snapshot()]

        def on_ticks(ws, ticks):
            for t in ticks:
                self.book.update(t["instrument_token"], t["last_price"])

            self.tracker.update()

        def on_connect(ws, res):
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect

        kws.connect(threaded=True)


# =========================================================
# EMA SIGNAL
# =========================================================
class EMASignal:
    def __init__(self, kite, cred):
        self.kite = kite
        self.cred = cred
        self.data = pd.DataFrame()
        self.prev = None

    def update(self, price):
        now = datetime.now(IST)

        self.data.loc[now] = price
        df = self.data.resample("1min").last().dropna()

        if len(df) < 55:
            return

        df["ema5"] = df.iloc[:, 0].ewm(span=5).mean()
        df["ema55"] = df.iloc[:, 0].ewm(span=55).mean()

        latest = df.iloc[-1]
        prev = df.iloc[-2]

        # 🔻 DOWN CROSS
        if prev["ema5"] >= prev["ema55"] and latest["ema5"] < latest["ema55"]:
            log("🔻 SENSEX BEAR SIGNAL")
            strategy = BearPutStrategy(self.kite, self.cred)
            strategy.start()


# =========================================================
# MAIN
# =========================================================
def main():
    cred = load_creds()

    kite = KiteConnect(api_key=cred["z_api_key"])
    kite.set_access_token(cred["z_access_token"])

    ema = EMASignal(kite, cred)

    kws = KiteTicker(cred["z_api_key"], cred["z_access_token"])

    def on_ticks(ws, ticks):
        for t in ticks:
            ema.update(t["last_price"])

    def on_connect(ws, res):
        ws.subscribe([SENSEX_SPOT_TOKEN])
        ws.set_mode(ws.MODE_LTP, [SENSEX_SPOT_TOKEN])

    kws.on_ticks = on_ticks
    kws.on_connect = on_connect

    kws.connect(threaded=True)


if __name__ == "__main__":
    main()
