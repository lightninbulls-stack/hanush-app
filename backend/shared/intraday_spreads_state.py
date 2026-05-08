from __future__ import annotations

from threading import Lock
from typing import Dict, Any


class IntradaySpreadState:
    def __init__(self) -> None:
        self._lock = Lock()
        self._state: Dict[str, Dict[str, Any]] = {}

    def update(self, strategy_name: str, payload: dict) -> None:
        with self._lock:
            self._state[strategy_name] = payload
        try:
            from shared.signal_broadcaster import broadcaster
            broadcaster.notify()
        except Exception:
            pass

    def get_all(self) -> dict:
        with self._lock:
            return dict(self._state)

    def get_one(self, strategy_name: str) -> dict | None:
        with self._lock:
            return self._state.get(strategy_name)


spread_state = IntradaySpreadState()
