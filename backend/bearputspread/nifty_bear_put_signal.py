# ================== SAME IMPORTS ==================
from __future__ import annotations

import logging
import os
import sys
import threading
import time
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import pytz
from kiteconnect import KiteConnect, KiteTicker

from shared.intraday_spreads_state import spread_state

# ================== CONFIG ==================
INDEX_NAME = "NIFTY"
SPREAD_TYPE = "bear_put"
STRATEGY_NAME = "ALPHA_BEAR_PAPER"

NIFTY_SPOT_TOKEN = 256265
QUANTITY = 65

STOP_LOSS_AMOUNT = -1500.0
TARGET_AMOUNT = 3000.0

IST = pytz.timezone("Asia/Kolkata")

# ================== LOGGING ==================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

def log(msg):
    print(f"[{datetime.now(IST)}] {msg}")

# ================== EXPIRY LOGIC ==================
def get_nifty_expiry():
    today = datetime.now().date()
    days_ahead = (1 - today.weekday()) % 7  # Tuesday
    expiry = today if days_ahead == 0 else today + timedelta(days=days_ahead)

    weeks_ahead = int(os.getenv("NIFTY_EXPIRY_WEEKS_AHEAD", "0"))
    expiry = expiry + timedelta(days=7 * weeks_ahead)

    return expiry.strftime("%Y%m%d")

# ================== CREDS ==================
def load_creds():
    return {
        "z_api_key": os.environ["Z_API_KEY"],
        "z_access_token": os.environ["Z_ACCESS_TOKEN"],
        "i_expiry_date_nifty": get_nifty_expiry(),
        "i_inst_name_nifty": "NIFTY",
    }

# ================== PATCH NFO ==================
def patch_nfo_util(nfo_util, cred):
    if hasattr(nfo_util, "load_creds"):
        nfo_util.load_creds = lambda: cred

    nfo_util.i_inst_name_nifty = cred["i_inst_name_nifty"]
    nfo_util.i_expiry_date_nifty = cred["i_expiry_date_nifty"]

# ================== PAPER BOOK ==================
class PaperOrderBook:
    def __init__(self):
        self.orders = []

    def place(self, side, symbol, price, token):
        self.orders.append({
            "side": side,
            "symbol": symbol,
            "entry": price,
            "ltp": price,
            "token": token,
            "pnl": 0
        })

    def update(self, token, ltp):
        for o in self.orders:
            if o["token"] == token:
                o["ltp"] = ltp
                if o["side"] == "BUY":
                    o["pnl"] = (ltp - o["entry"]) * QUANTITY
                else:
                    o["pnl"] = (o["entry"] - ltp) * QUANTITY

    def total(self):
        return sum(o["pnl"] for o in self.orders)

# ================== STRATEGY ==================
class BearPutStrategy:

    def __init__(self, kite, cred):
        self.kite = kite
        self.cred = cred
        self.book = PaperOrderBook()
        self.ws = None
        self.last_tick_log = 0

    def execute(self):
        from option_spreads import nfo_util
        patch_nfo_util(nfo_util, self.cred)

        log("Selecting Bear Put Spread...")

        df = nfo_util.build_nifty_pe_chain_100_strike_with_ltp()

        spread = nfo_util.bear_put_spreads_nifty(
            df,
            gaps=(150, 200),
            rr_target=1.5,
        )

        row = spread.iloc[0]

        buy = df[df["strike"] == row["buy_strike"]].iloc[0]
        sell = df[df["strike"] == row["sell_strike"]].iloc[0]

        self.book.place("BUY", buy["tradingsymbol"], buy["last_price_y"], buy["instrument_token"])
        self.book.place("SELL", sell["tradingsymbol"], sell["last_price_y"], sell["instrument_token"])

        log("Bear Put Spread Executed")

        self.start_mtm()

    def start_mtm(self):
        tokens = [o["token"] for o in self.book.orders]

        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])
        self.ws = kws

        def on_ticks(ws, ticks):
            now = time.time()

            for t in ticks:
                self.book.update(t["instrument_token"], t["last_price"])

            if now - self.last_tick_log > 5:
                log(f"MTM: {self.book.total():.2f}")
                self.last_tick_log = now

            if self.book.total() <= STOP_LOSS_AMOUNT:
                log("STOP LOSS HIT")
                ws.close()

            if self.book.total() >= TARGET_AMOUNT:
                log("TARGET HIT")
                ws.close()

        def on_connect(ws, resp):
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect

        kws.connect(threaded=True)

# ================== EMA ==================
class EMAHandler:

    def __init__(self, kite, cred):
        self.kite = kite
        self.cred = cred
        self.df = pd.DataFrame()
        self.prev_min = None
        self.last_trade = 0

    def start(self):
        kws = KiteTicker(self.cred["z_api_key"], self.cred["z_access_token"])

        def on_ticks(ws, ticks):
            price = ticks[0]["last_price"]
            ts = datetime.now(IST)

            if self.prev_min is None:
                self.prev_min = ts.minute
                return

            if ts.minute != self.prev_min:
                self.df.loc[ts] = price

                self.df["EMA5"] = self.df[0].ewm(span=5).mean()
                self.df["EMA55"] = self.df[0].ewm(span=55).mean()

                if len(self.df) > 55:
                    prev = self.df.iloc[-2]
                    curr = self.df.iloc[-1]

                    # ONLY DOWNSIDE SIGNAL
                    if prev["EMA5"] >= prev["EMA55"] and curr["EMA5"] < curr["EMA55"]:
                        log("🔻 Bearish crossover detected")

                        if self.last_trade != -1:
                            self.last_trade = -1
                            strategy = BearPutStrategy(self.kite, self.cred)
                            threading.Thread(target=strategy.execute).start()

                self.prev_min = ts.minute

        def on_connect(ws, resp):
            ws.subscribe([NIFTY_SPOT_TOKEN])

        kws.on_ticks = on_ticks
        kws.on_connect = on_connect

        kws.connect(threaded=True)

# ================== MAIN ==================
def main():
    cred = load_creds()

    kite = KiteConnect(api_key=cred["z_api_key"])
    kite.set_access_token(cred["z_access_token"])

    log("Starting Bear Put Strategy")

    ema = EMAHandler(kite, cred)
    ema.start()


if __name__ == "__main__":
    main()
