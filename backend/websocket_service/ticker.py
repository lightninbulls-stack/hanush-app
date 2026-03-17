import logging
import asyncio
from datetime import datetime, time as dtime
from typing import Optional, Callable

import pytz
from kiteconnect import KiteTicker

from kite_service.auth import kite_auth
from kite_service.instrument_manager import instrument_manager
from websocket_service.aggregator import aggregator
from db import AsyncSessionLocal

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")


class KiteTickerService:
    def __init__(self):
        self._ticker: Optional[KiteTicker] = None
        self._running = False
        self._tasks: list[asyncio.Task] = []
        self._eod_scheduled = False
        self.on_tick_callback: Optional[Callable] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def start(self):
        if self._running:
            return
        if not instrument_manager.is_loaded():
            logger.error("Instruments not loaded.")
            return
        if not kite_auth.get_kite():
            logger.error("Kite not authenticated.")
            return

        self._loop   = asyncio.get_event_loop()
        self._running = True
        self._tasks.append(asyncio.create_task(self._run()))
        self._tasks.append(asyncio.create_task(self._db_flush_loop()))
        self._tasks.append(asyncio.create_task(self._partial_flush_loop()))
        self._tasks.append(asyncio.create_task(self._eod_scheduler()))
        logger.info("KiteTickerService started")

    async def stop(self):
        self._running = False
        if self._ticker:
            try:
                self._ticker.stop()
                self._ticker.close()
            except Exception:
                pass
        for t in self._tasks:
            t.cancel()
        self._tasks.clear()

    async def resubscribe(self):
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

    async def _run(self):
        tokens       = instrument_manager.get_all_tokens()
        self._ticker = KiteTicker(kite_auth.api_key, kite_auth.get_access_token(),
                                   reconnect=True, reconnect_tries=300)

        def on_ticks(ws, ticks):
            if not self._loop:
                return
            for tick in ticks:
                try:
                    symbol = instrument_manager.get_symbol(tick["instrument_token"])
                    if symbol:
                        # process_tick is async — schedule on event loop from this thread
                        asyncio.run_coroutine_threadsafe(
                            aggregator.process_tick(symbol, tick), self._loop
                        )
                        if self.on_tick_callback:
                            self.on_tick_callback(symbol, tick)
                except Exception as e:
                    logger.error(f"Tick error: {e}")

        def on_connect(ws, response):
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_FULL, tokens)
            logger.info(f"KiteTicker connected — {len(tokens)} instruments subscribed")

        def on_close(ws, code, reason):
            logger.info(f"KiteTicker closed: {code} - {reason}")

        def on_error(ws, code, reason):
            logger.info(f"KiteTicker error: {code} - {reason}")

        def on_reconnect(ws, attempts):
            logger.info(f"KiteTicker reconnecting ({attempts})...")
            # ws may be None or not yet connected during reconnect phase — guard it
            if ws is None:
                return
            try:
                current_tokens = instrument_manager.get_all_tokens()
                ws.subscribe(current_tokens)
                ws.set_mode(ws.MODE_FULL, current_tokens)
            except Exception as e:
                logger.warning(f"Resubscribe on reconnect failed (will retry): {e}")

        def on_noreconnect(ws):
            logger.critical("KiteTicker max reconnect attempts reached!")
            self._running = False

        self._ticker.on_ticks      = on_ticks
        self._ticker.on_connect    = on_connect
        self._ticker.on_close      = on_close
        self._ticker.on_error      = on_error
        self._ticker.on_reconnect  = on_reconnect
        self._ticker.on_noreconnect = on_noreconnect

        # threaded=True runs twisted reactor in its own thread — no signal conflict
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self._ticker.connect(threaded=True))

    async def _db_flush_loop(self):
        """Flush completed candles from in-memory queue to DB every 5 seconds."""
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    await aggregator.flush_db_queue(db)
            except Exception as e:
                logger.error(f"Flush loop error: {e}")
            await asyncio.sleep(5)

    async def _partial_flush_loop(self):
        """Write partial (in-progress) candles to DB every 30 seconds."""
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    await aggregator.flush_partial_candles(db)
            except Exception as e:
                logger.error(f"Partial flush error: {e}")
            await asyncio.sleep(30)

    async def _eod_scheduler(self):
        """Trigger EOD finalization after market close (15:30 IST)."""
        while self._running:
            now = datetime.now(IST)
            if now.time() >= dtime(15, 30) and not self._eod_scheduled:
                self._eod_scheduled = True
                logger.info("Market closed. Running EOD finalization...")
                try:
                    async with AsyncSessionLocal() as db:
                        await aggregator.finalize_eod_candles(db)
                except Exception as e:
                    logger.error(f"EOD error: {e}")
            if now.time() < dtime(9, 0):
                self._eod_scheduled = False
            await asyncio.sleep(30)

    def is_running(self) -> bool:
        return self._running and bool(self._tasks)


ticker_service = KiteTickerService()