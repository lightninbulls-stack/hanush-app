from __future__ import annotations

import time
from dataclasses import dataclass, asdict
from typing import Optional

from kiteconnect import KiteTicker

from shared.intraday_spreads_state import spread_state
from api_service.lightnin_bull_upside_intraday_signal import (
    INDEX_NAME,
    SPREAD_TYPE,
    FAST_EMA_SPAN,
    SLOW_EMA_SPAN,
    current_ist,
    market_status_ist,
    wait_until_market_open,
    load_creds,
    load_signal_tokens,
    log_and_print,
)

STRATEGY_NAME = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL"


@dataclass
class StockSignalState:
    symbol: str
    instrument_token: int
    signal_status: str = "WAITING"
    entry_time: Optional[str] = None
    avg_price: Optional[float] = None
    current_ltp: Optional[float] = None
    min_ltp: Optional[float] = None
    points_captured: Optional[float] = None
    pct_captured: Optional[float] = None


class EMAState:
    def __init__(self, fast_span: int, slow_span: int):
        self.fast_alpha = 2 / (fast_span + 1)
        self.slow_alpha = 2 / (slow_span + 1)
        self.fast_ema = None
        self.slow_ema = None
        self.prev_fast_ema = None
        self.prev_slow_ema = None

    def update(self, price: float):
        self.prev_fast_ema = self.fast_ema
        self.prev_slow_ema = self.slow_ema

        self.fast_ema = price if self.fast_ema is None else (
            price * self.fast_alpha + self.fast_ema * (1 - self.fast_alpha)
        )
        self.slow_ema = price if self.slow_ema is None else (
            price * self.slow_alpha + self.slow_ema * (1 - self.slow_alpha)
        )

    def bearish(self):
        if None in (self.prev_fast_ema, self.prev_slow_ema, self.fast_ema, self.slow_ema):
            return False
        return self.prev_fast_ema >= self.prev_slow_ema and self.fast_ema < self.slow_ema


class Engine:
    def __init__(self, cred, df):
        self.cred = cred
        self.df = df
        self.ws = None
        self.running = False

        self.ema = {}
        self.state = {}

        for _, r in df.iterrows():
            token = int(r["instrument_token"])
            self.ema[token] = EMAState(FAST_EMA_SPAN, SLOW_EMA_SPAN)
            self.state[token] = StockSignalState(
                symbol=r["symbol"],
                instrument_token=token
            )

    def payload(self, status="RUNNING"):
        signals = [
            asdict(s)
            for s in self.state.values()
            if s.signal_status == "ENTERED"
        ]

        return {
            "index": INDEX_NAME,
            "spread_type": SPREAD_TYPE,
            "strategy_name": STRATEGY_NAME,
            "status": status,
            "signals": signals,
            "entered_count": len(signals),
            "total_count": len(self.state),
            "updated_at": current_ist().isoformat(),
        }

    def tick(self, token, ltp):
        e = self.ema[token]
        s = self.state[token]

        e.update(ltp)
        s.current_ltp = ltp

        if s.signal_status == "ENTERED":
            s.min_ltp = min(s.min_ltp or ltp, ltp)

            if s.avg_price:
                p = s.avg_price - s.min_ltp
                s.points_captured = p
                s.pct_captured = (p / s.avg_price) * 100

            return

        if e.bearish():
            s.signal_status = "ENTERED"
            s.entry_time = current_ist().strftime("%H:%M:%S")
            s.avg_price = ltp
            s.min_ltp = ltp

            log_and_print(f"DOWNSIDE ENTRY | {s.symbol} @ {ltp}")

    def start(self):
        tokens = list(self.state.keys())

        self.ws = KiteTicker(
            self.cred["z_api_key"],
            self.cred["z_access_token"]
        )

        self.running = True

        def on_ticks(ws, ticks):
            if market_status_ist() != "OPEN":
                self.stop()
                spread_state.update(STRATEGY_NAME, self.payload("STOPPED"))
                return

            for t in ticks:
                if t.get("instrument_token") and t.get("last_price"):
                    self.tick(t["instrument_token"], t["last_price"])

            spread_state.update(STRATEGY_NAME, self.payload())

        def on_connect(ws, res):
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

        def on_error(ws, code, reason):
            self.stop()
            spread_state.update(STRATEGY_NAME, self.payload("ERROR"))

        self.ws.on_ticks = on_ticks
        self.ws.on_connect = on_connect
        self.ws.on_error = on_error

        self.ws.connect(threaded=True)

        while self.running:
            time.sleep(1)

    def stop(self):
        self.running = False
        if self.ws:
            self.ws.close()


def main():
    if not wait_until_market_open():
        return

    cred = load_creds()
    df = load_signal_tokens()

    Engine(cred, df).start()
