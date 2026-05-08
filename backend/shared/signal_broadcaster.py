from __future__ import annotations

import asyncio
import logging
from typing import Set

logger = logging.getLogger(__name__)


class SignalBroadcaster:
    """
    Thread-safe pub/sub notifier.
    Background signal-engine threads call notify(); async WS handlers await queue.get().
    """

    def __init__(self) -> None:
        self._queues: Set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=20)
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._queues.discard(q)

    def notify(self) -> None:
        if not self._loop or not self._queues:
            return

        def _put() -> None:
            for q in list(self._queues):
                try:
                    q.put_nowait(True)
                except asyncio.QueueFull:
                    pass  # slow consumer — skip, they'll get the next tick

        self._loop.call_soon_threadsafe(_put)


broadcaster = SignalBroadcaster()
