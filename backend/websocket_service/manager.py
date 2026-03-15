"""FastAPI WebSocket manager — broadcasts live ticks and candle events to frontend clients."""

import asyncio
import json
import logging
from typing import Dict, Optional
from datetime import datetime
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._clients: Dict[str, Dict] = {}
        self._lock = asyncio.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        async with self._lock:
            self._clients[client_id] = {"ws": websocket, "symbols": set()}
        logger.info(f"WS client connected: {client_id} (total: {len(self._clients)})")

    async def disconnect(self, client_id: str):
        async with self._lock:
            self._clients.pop(client_id, None)

    async def subscribe(self, client_id: str, symbols: list):
        async with self._lock:
            if client_id in self._clients:
                self._clients[client_id]["symbols"] = set(symbols)

    async def broadcast_tick(self, symbol: str, price: float, volume: int, timestamp: datetime):
        msg = json.dumps({
            "type": "tick", "symbol": symbol, "price": price,
            "volume": volume,
            "timestamp": timestamp.isoformat() if timestamp else None,
        })
        await self._send_to_subscribers(symbol, msg)

    async def broadcast_candle_close(self, symbol: str, timeframe: str, candle: dict):
        ts = candle["timestamp"]
        msg = json.dumps({
            "type": "candle_close", "symbol": symbol, "timeframe": timeframe,
            "candle": {
                "time": int(ts.timestamp()) if hasattr(ts, "timestamp") else ts,
                "open": float(candle["open"]), "high": float(candle["high"]),
                "low": float(candle["low"]),   "close": float(candle["close"]),
                "volume": int(candle["volume"]),
            }
        })
        await self._send_to_subscribers(symbol, msg)

    async def _send_to_subscribers(self, symbol: str, msg: str):
        dead = []
        async with self._lock:
            clients = list(self._clients.items())
        for client_id, info in clients:
            if not info["symbols"] or symbol in info["symbols"]:
                try:
                    await info["ws"].send_text(msg)
                except Exception:
                    dead.append(client_id)
        for cid in dead:
            await self.disconnect(cid)

    def broadcast_tick_threadsafe(self, symbol: str, price: float, volume: int, timestamp: datetime):
        if self._loop and not self._loop.is_closed():
            asyncio.run_coroutine_threadsafe(
                self.broadcast_tick(symbol, price, volume, timestamp), self._loop
            )

    def get_connection_count(self) -> int:
        return len(self._clients)


ws_manager = ConnectionManager()
