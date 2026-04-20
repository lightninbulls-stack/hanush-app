from __future__ import annotations

import threading
from typing import Callable, Optional


_strategy_thread: Optional[threading.Thread] = None
_strategy_lock = threading.Lock()
_strategy_running = False


def _run_strategy_once(strategy_func: Callable[[], None]) -> None:
    global _strategy_running

    with _strategy_lock:
        if _strategy_running:
            print("⚠️ Strategy is already running. Duplicate launch skipped.")
            return
        _strategy_running = True

    try:
        print("✅ Strategy background thread started.")
        strategy_func()
    except Exception as exc:
        print(f"❌ Strategy thread crashed: {exc}")
    finally:
        with _strategy_lock:
            _strategy_running = False
        print("ℹ️ Strategy background thread finished.")


def start_strategy_background(strategy_func: Callable[[], None]) -> bool:
    global _strategy_thread

    with _strategy_lock:
        if _strategy_thread is not None and _strategy_thread.is_alive():
            print("⚠️ Strategy thread already alive.")
            return False

        _strategy_thread = threading.Thread(
            target=_run_strategy_once,
            args=(strategy_func,),
            daemon=True,
            name="nifty-bull-call-strategy-thread",
        )
        _strategy_thread.start()
        return True


def is_strategy_running() -> bool:
    global _strategy_thread
    return _strategy_thread is not None and _strategy_thread.is_alive()
