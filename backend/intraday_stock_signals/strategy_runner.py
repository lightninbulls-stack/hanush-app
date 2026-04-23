from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

import pandas as pd
from kiteconnect import KiteConnect, KiteTicker

from .config import IST
from .ema_engine import EMAState
from .models import StockSignalState
from .publisher import build_payload, publish_strategy_state


class IntradayStockSignalRunner:
    def __init__(
        self,
        *,
        kite: KiteConnect,
        cred: dict,
        regime_tokens_df: pd.DataFrame,
        strategy_name: str,
        side: str,
        fast_span: int,
        slow_span: int,
        log_and_print,
        is_after_market_close_fn,
    ) -> None:
        self.kite = kite
        self.cred = cred
        self.regime_tokens_df = regime_tokens_df.copy()
        self.strategy_name = strategy_name
        self.side = side
        self.fast_span = fast_span
        self.slow_span = slow_span
        self.log_and_print = log_and_print
        self.is_after_market_close_fn = is_after_market_close_fn

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

        self.log_and_print(
            f"Initialized {len(self.signal_states)} {self.side.lower()} regime stocks."
        )

    def _build_frontend_payload(self) -> dict:
        return build_payload(
            strategy_name=self.strategy_name,
            side=self.side,
            signal_states=self.signal_states,
            fast_span=self.fast_span,
            slow_span=self.slow_span,
        )

    def _publish(self, force: bool = False) -> None:
        now = time.time()
        if not force and (now - self.last_publish_time < 1.0):
            return

        publish_strategy_state(
            strategy_name=self.strategy_name,
            ui_state="RUNNING",
            message=self._build_frontend_payload()["message"],
            progress_text=self._build_frontend_payload()["progress_text"],
            is_loading=False,
            extra=self._build_frontend_payload(),
        )
        self.last_publish_time = now

    def _handle_entered_state(self, signal_state: StockSignalState, ltp: float) -> None:
        if signal_state.avg_price is None:
            return

        if self.side == "UPSIDE":
            if signal_state.max_ltp is None:
                signal_state.max_ltp = round(float(ltp), 2)
            else:
                signal_state.max_ltp = round(max(float(signal_state.max_ltp), float(ltp)), 2)

            points = (signal_state.max_ltp or 0.0) - signal_state.avg_price
        else:
            if signal_state.min_ltp is None:
                signal_state.min_ltp = round(float(ltp), 2)
            else:
                signal_state.min_ltp = round(min(float(signal_state.min_ltp), float(ltp)), 2)

            points = signal_state.avg_price - (signal_state.min_ltp or 0.0)

        pct = (points / signal_state.avg_price) * 100 if signal_state.avg_price != 0 else 0.0
        signal_state.points_captured = round(points, 2)
        signal_state.pct_captured = round(pct, 2)

    def _entry_triggered(self, ema_state: EMAState) -> bool:
        if self.side == "UPSIDE":
            return ema_state.bullish_crossover()
        return ema_state.bearish_crossover()

    def _handle_tick(self, token: int, ltp: float) -> None:
        if token not in self.ema_states:
            return

        ema_state = self.ema_states[token]
        signal_state = self.signal_states[token]

        ema_state.update(ltp)

        signal_state.current_ltp = round(float(ltp), 2)
        signal_state.fast_ema = round(float(ema_state.fast_ema), 4) if ema_state.fast_ema is not None else None
        signal_state.slow_ema = round(float(ema_state.slow_ema), 4) if ema_state.slow_ema is not None else None

        if signal_state.signal_status == "ENTERED":
            self._handle_entered_state(signal_state, ltp)
            return

        if self._entry_triggered(ema_state):
            signal_state.signal_status = "ENTERED"
            signal_state.paper_trade = True
            signal_state.entry_time = datetime.now(IST).strftime("%H:%M:%S")
            signal_state.avg_price = round(float(ltp), 2)
            signal_state.points_captured = 0.0
            signal_state.pct_captured = 0.0

            if self.side == "UPSIDE":
                signal_state.max_ltp = round(float(ltp), 2)
                signal_state.min_ltp = None
            else:
                signal_state.min_ltp = round(float(ltp), 2)
                signal_state.max_ltp = None

            self.log_and_print(
                f"{self.side} ENTRY | {signal_state.symbol} | "
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
            strategy_name=self.strategy_name,
            ui_state="BOOTING",
            message=f"Starting intraday {self.side.lower()} stock signal engine.",
            progress_text=f"Preparing {len(tokens)} regime stocks",
            is_loading=True,
        )

        def on_ticks(ws, ticks):
            if not self.is_running:
                return

            if self.is_after_market_close_fn():
                self.log_and_print("Market closed. Stopping stock signal engine.")
                self.stop()
                publish_strategy_state(
                    strategy_name=self.strategy_name,
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
                except Exception as exc:
                    self.log_and_print(f"Tick error for token={token}: {exc}", "error")

            self._publish()

        def on_connect(ws, response):
            self.log_and_print(f"Connected to websocket. Subscribing {len(tokens)} NSE cash tokens.")
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_LTP, tokens)

            publish_strategy_state(
                strategy_name=self.strategy_name,
                ui_state="RUNNING",
                message=(
                    "Live feed connected. Monitoring upside crossover signals."
                    if self.side == "UPSIDE"
                    else "Live feed connected. Monitoring downside crossover signals."
                ),
                progress_text=f"Subscribed {len(tokens)} stocks",
                is_loading=False,
                extra=self._build_frontend_payload(),
            )

        def on_close(ws, code, reason):
            self.log_and_print(f"WebSocket closed: {code} - {reason}", "warning")

        def on_error(ws, code, reason):
            self.log_and_print(f"WebSocket error: {code} - {reason}", "error")
            publish_strategy_state(
                strategy_name=self.strategy_name,
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
        except Exception as exc:
            self.log_and_print(f"Error while closing websocket: {exc}", "error")
