"""
KiteTicker service.
- Connects to Zerodha WebSocket on start()
- Feeds every tick into aggregator (builds 1min/5min/15min/1hour candles)
- Flushes completed candles to DB every 5s
- Flushes partial candles to DB every 30s
- Broadcasts candle updates to frontend WebSocket clients
"""

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
        self._running   = False
        self._tasks     = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._eod_scheduled = False
        self.on_tick_callback: Optional[Callable] = None

    async def start(self):
        if self._running:
            logger.info("Ticker already running — skipping start()")
            return
        if not instrument_manager.is_loaded():
            logger.error("Cannot start ticker: instruments not loaded.")
            return
        if not kite_auth.get_kite():
            logger.error("Cannot start ticker: Kite not authenticated.")
            return

        self._loop    = asyncio.get_event_loop()
        self._running = True

        self._tasks = [
            asyncio.create_task(self._run(),                name="kite-ticker-ws"),
            asyncio.create_task(self._db_flush_loop(),      name="candle-db-flush"),
            asyncio.create_task(self._partial_flush_loop(), name="candle-partial-flush"),
            asyncio.create_task(self._eod_scheduler(),      name="eod-scheduler"),
        ]
        logger.info(f"KiteTickerService started — {len(instrument_manager.get_all_tokens())} tokens")

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
        logger.info("KiteTickerService stopped")

    async def resubscribe(self):
        if not self._ticker or not self._running:
            return
        tokens = instrument_manager.get_all_tokens()
        try:
            self._ticker.subscribe(tokens)
            self._ticker.set_mode(self._ticker.MODE_FULL, tokens)
            logger.info(f"Resubscribed: {len(tokens)} tokens")
        except Exception as e:
            logger.error(f"Resubscribe failed: {e}")

    # ── WebSocket connection ──────────────────────────────────────────────────
    async def _run(self):
        tokens       = instrument_manager.get_all_tokens()
        api_key      = kite_auth.api_key
        access_token = kite_auth.get_access_token()

        self._ticker = KiteTicker(api_key, access_token, reconnect=True, reconnect_tries=300)

        def on_ticks(ws, ticks):
            """Called by twisted thread on every tick batch."""
            if not self._loop or not self._running:
                return
            for tick in ticks:
                try:
                    symbol = instrument_manager.get_symbol(tick["instrument_token"])
                    if not symbol:
                        continue
                    # Schedule async process_tick on event loop from twisted thread
                    asyncio.run_coroutine_threadsafe(
                        aggregator.process_tick(symbol, tick), self._loop
                    )
                    if self.on_tick_callback:
                        self.on_tick_callback(symbol, tick)
                except Exception as e:
                    logger.error(f"Tick processing error: {e}")

        def on_connect(ws, response):
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_FULL, tokens)
            logger.info(f"KiteTicker connected — {len(tokens)} instruments subscribed")

        def on_close(ws, code, reason):
            logger.warning(f"KiteTicker closed: {code} — {reason}")

        def on_error(ws, code, reason):
            logger.error(f"KiteTicker error: {code} — {reason}")

        def on_reconnect(ws, attempts):
            logger.info(f"KiteTicker reconnecting (attempt {attempts})...")
            if ws is None:
                return
            try:
                current = instrument_manager.get_all_tokens()
                ws.subscribe(current)
                ws.set_mode(ws.MODE_FULL, current)
            except Exception as e:
                logger.warning(f"Resubscribe on reconnect failed: {e}")

        def on_noreconnect(ws):
            logger.critical("KiteTicker: max reconnects reached — giving up.")
            self._running = False

        self._ticker.on_ticks       = on_ticks
        self._ticker.on_connect     = on_connect
        self._ticker.on_close       = on_close
        self._ticker.on_error       = on_error
        self._ticker.on_reconnect   = on_reconnect
        self._ticker.on_noreconnect = on_noreconnect

        # threaded=True → twisted runs in its own OS thread, no signal conflict
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self._ticker.connect(threaded=True))

    # ── Flush loops ───────────────────────────────────────────────────────────
    async def _db_flush_loop(self):
        """Write completed candles from in-memory queue to DB every 5s."""
        while self._running:
            await asyncio.sleep(5)
            try:
                async with AsyncSessionLocal() as db:
                    await aggregator.flush_db_queue(db)
            except Exception as e:
                logger.error(f"DB flush error: {e}")

    async def _partial_flush_loop(self):
        """Write in-progress (partial) candles to DB every 30s."""
        while self._running:
            await asyncio.sleep(30)
            try:
                async with AsyncSessionLocal() as db:
                    await aggregator.flush_partial_candles(db)
            except Exception as e:
                logger.error(f"Partial flush error: {e}")

    async def _eod_scheduler(self):
        """Trigger EOD finalization after market close (15:30 IST)."""
        while self._running:
            await asyncio.sleep(30)
            try:
                now = datetime.now(IST)
                if now.time() >= dtime(15, 30) and not self._eod_scheduled:
                    self._eod_scheduled = True
                    logger.info("Market closed — running EOD finalization...")
                    async with AsyncSessionLocal() as db:
                        await aggregator.finalize_eod_candles(db)
                if now.time() < dtime(9, 0):
                    self._eod_scheduled = False
            except Exception as e:
                logger.error(f"EOD scheduler error: {e}")

    def is_running(self) -> bool:
        return self._running and bool(self._tasks)


ticker_service = KiteTickerService()