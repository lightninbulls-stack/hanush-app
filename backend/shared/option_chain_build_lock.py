from __future__ import annotations

import threading

NIFTY_BULL_CALL_LOCK = threading.Lock()
NIFTY_BEAR_PUT_LOCK = threading.Lock()
SENSEX_BULL_CALL_LOCK = threading.Lock()
SENSEX_BEAR_PUT_LOCK = threading.Lock()
