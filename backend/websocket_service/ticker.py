"""KiteTicker WebSocket — subscribes to all active symbols, feeds aggregator."""

import logging
import threading
import time
from datetime import datetime, time as dtime
from typing import Optional, Callable

import pytz
from kiteconnect import KiteTicker

from kite_service.auth import kite_auth
from kite_service.instrument_manager import instrument_manager
from websocket_service.aggregator import aggregator

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")


class KiteTickerService:
    def __init__(self):
        self._ticker: Optional[KiteTicker] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._flush_thread: Optional[threading.Thread] = None
        self._partial_thread: Optional[threading.Thread] = None
        self._eod_scheduled = False
        self.on_tick_callback: Optional[Callable] = None

    def start(self):
        if self._running:
            return
        if not instrument_manager.is_loaded():
            logger.error("Instruments not loaded.")
            return
        if not kite_auth.get_kite():
            logger.error("Kite not authenticated.")
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="kite-ticker")
        self._thread.start()
        self._flush_thread = threading.Thread(target=self._db_flush_loop, daemon=True, name="db-flush")
        self._flush_thread.start()
        self._partial_thread = threading.Thread(target=self._partial_flush_loop, daemon=True, name="partial-flush")
        self._partial_thread.start()
        threading.Thread(target=self._eod_scheduler, daemon=True, name="eod-scheduler").start()
        logger.info("KiteTickerService started")

    def stop(self):
        self._running = False
        if self._ticker:
            try:
                self._ticker.stop()
                self._ticker.close()
            except Exception:
                pass

    def resubscribe(self):
        """Hot-add/remove symbols without restarting the connection."""
        if not self._ticker or not self._running:
            return
        tokens = instrument_manager.get_all_tokens()
        try:
            self._ticker.subscribe(tokens)
            self._ticker.set_mode(self._ticker.MODE_FULL, tokens)
            logger.info(f"Resubscribed to {len(tokens)} instruments")
        except Exception as e:
            logger.error(f"Resubscribe failed: {e}")

    def _run(self):
        tokens = instrument_manager.get_all_tokens()
        self._ticker = KiteTicker(kite_auth.api_key, kite_auth.get_access_token(),
                                   reconnect=True, reconnect_tries=300)

        def on_ticks(ws, ticks):
            for tick in ticks:
                try:
                    symbol = instrument_manager.get_symbol(tick["instrument_token"])
                    if symbol:
                        aggregator.process_tick(symbol, tick)
                        if self.on_tick_callback:
                            self.on_tick_callback(symbol, tick)
                except Exception as e:
                    logger.error(f"Tick error: {e}")

        def on_connect(ws, response):
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_FULL, tokens)
            logger.info(f"KiteTicker connected — {len(tokens)} instruments subscribed")

        def on_close(ws, code, reason):
            logger.warning(f"KiteTicker closed: {code} - {reason}")

        def on_error(ws, code, reason):
            logger.error(f"KiteTicker error: {code} - {reason}")

        def on_reconnect(ws, attempts):
            logger.info(f"KiteTicker reconnecting ({attempts})...")
            current_tokens = instrument_manager.get_all_tokens()
            ws.subscribe(current_tokens)
            ws.set_mode(ws.MODE_FULL, current_tokens)

        def on_noreconnect(ws):
            logger.critical("KiteTicker max reconnect attempts reached!")
            self._running = False

        self._ticker.on_ticks = on_ticks
        self._ticker.on_connect = on_connect
        self._ticker.on_close = on_close
        self._ticker.on_error = on_error
        self._ticker.on_reconnect = on_reconnect
        self._ticker.on_noreconnect = on_noreconnect
        self._ticker.connect(threaded=False)

    def _db_flush_loop(self):
        while self._running:
            try:
                aggregator.flush_db_queue()
            except Exception as e:
                logger.error(f"Flush loop error: {e}")
            time.sleep(5)

    def _partial_flush_loop(self):
        while self._running:
            try:
                aggregator.flush_partial_candles()
            except Exception as e:
                logger.error(f"Partial flush error: {e}")
            time.sleep(30)

    def _eod_scheduler(self):
        while self._running:
            now = datetime.now(IST)
            if now.time() >= dtime(15, 30) and not self._eod_scheduled:
                self._eod_scheduled = True
                logger.info("Market closed. Running EOD finalization...")
                try:
                    aggregator.finalize_eod_candles()
                except Exception as e:
                    logger.error(f"EOD error: {e}")
            if now.time() < dtime(9, 0):
                self._eod_scheduled = False
            time.sleep(30)

    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()


ticker_service = KiteTickerService()
