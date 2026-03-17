"""FastAPI WebSocket manager — broadcasts live ticks and candle events to frontend clients."""

import asyncio
import json
import logging
from typing import Dict, Set
from datetime import datetime
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._clients: Dict[str, Dict] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        async with self._lock:
            self._clients[client_id] = {"ws": websocket, "symbols": set(), "timeframes": set()}
        logger.info(f"WS client connected: {client_id} (total: {len(self._clients)})")

    async def disconnect(self, client_id: str):
        async with self._lock:
            self._clients.pop(client_id, None)
        logger.info(f"WS client disconnected: {client_id}")

    async def subscribe(self, client_id: str, symbols: list, timeframes: list = None):
        async with self._lock:
            if client_id in self._clients:
                self._clients[client_id]["symbols"]    = set(s.upper() for s in symbols)
                self._clients[client_id]["timeframes"] = set(timeframes or [])
                logger.info(f"Client {client_id} subscribed to {symbols} tf={timeframes}")

    async def broadcast_tick(self, symbol: str, price: float, volume: int, timestamp: datetime):
        msg = json.dumps({
            "type":      "tick",
            "symbol":    symbol,
            "price":     price,
            "volume":    volume,
            "timestamp": timestamp.isoformat() if timestamp else None,
        })
        await self._send_to_subscribers(symbol, msg)

    async def broadcast_candle_update(self, symbol: str, timeframe: str,
                                       candle: dict, is_closed: bool = False):
        """
        Broadcast a candle update to all clients subscribed to this symbol.
        is_closed=True  → candle bar is finalized (new bar started)
        is_closed=False → candle bar is still in progress (partial update)
        """
        msg = json.dumps({
            "type":      "candle_closed" if is_closed else "candle_update",
            "symbol":    symbol,
            "timeframe": timeframe,
            "candle":    candle,   # already has unix timestamp from aggregator
        })
        await self._send_to_subscribers(symbol, msg, timeframe=timeframe)

    async def broadcast_candle_close(self, symbol: str, timeframe: str, candle: dict):
        """Legacy method — kept for compatibility."""
        ts  = candle.get("timestamp")
        msg = json.dumps({
            "type":      "candle_closed",
            "symbol":    symbol,
            "timeframe": timeframe,
            "candle": {
                "time":   int(ts.timestamp()) if hasattr(ts, "timestamp") else ts,
                "open":   float(candle["open"]),
                "high":   float(candle["high"]),
                "low":    float(candle["low"]),
                "close":  float(candle["close"]),
                "volume": int(candle["volume"]),
            },
        })
        await self._send_to_subscribers(symbol, msg)

    async def _send_to_subscribers(self, symbol: str, msg: str, timeframe: str = None):
        dead = []
        async with self._lock:
            clients = list(self._clients.items())
        for client_id, info in clients:
            # Match symbol (empty set = subscribed to all)
            sym_match = not info["symbols"] or symbol in info["symbols"]
            # Match timeframe (empty set = subscribed to all timeframes)
            tf_match  = (timeframe is None
                         or not info["timeframes"]
                         or timeframe in info["timeframes"])
            if sym_match and tf_match:
                try:
                    await info["ws"].send_text(msg)
                except Exception:
                    dead.append(client_id)
        for cid in dead:
            await self.disconnect(cid)

    async def broadcast_tick_threadsafe(self, symbol: str, price: float,
                                         volume: int, timestamp: datetime):
        """Schedule broadcast from a non-async thread (e.g. KiteTicker callbacks)."""
        asyncio.create_task(self.broadcast_tick(symbol, price, volume, timestamp))

    def get_connection_count(self) -> int:
        return len(self._clients)


ws_manager = ConnectionManager()