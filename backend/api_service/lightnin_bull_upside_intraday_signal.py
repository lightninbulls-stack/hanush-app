from __future__ import annotations

import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

import pytz

from intraday_stock_signals.config import (
    INDEX_NAME,
    SPREAD_TYPE,
    INSTRUMENT_FILE_CANDIDATES,
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    MARKET_CLOSE_HOUR,
    MARKET_CLOSE_MINUTE,
)
from intraday_stock_signals.upside_strategy import main as _upside_strategy_main
from intraday_stock_signals.utils import load_creds

STRATEGY_NAME = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
FAST_SMA_WINDOW = 500
SLOW_SMA_WINDOW = 1500
MIN_TICKS_FOR_SIGNAL = SLOW_SMA_WINDOW
IST = pytz.timezone("Asia/Kolkata")

_logger = logging.getLogger(STRATEGY_NAME)
if not _logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")


def current_ist() -> datetime:
    return datetime.now(IST)


def is_weekday_ist(ref: Optional[datetime] = None) -> bool:
    now = ref or current_ist()
    return now.weekday() < 5


def get_market_open_close_ist(ref: Optional[datetime] = None) -> tuple[datetime, datetime]:
    now = ref or current_ist()
    return (
        now.replace(hour=MARKET_OPEN_HOUR, minute=MARKET_OPEN_MINUTE, second=0, microsecond=0),
        now.replace(hour=MARKET_CLOSE_HOUR, minute=MARKET_CLOSE_MINUTE, second=0, microsecond=0),
    )


def market_status_ist(ref: Optional[datetime] = None) -> str:
    now = ref or current_ist()
    if not is_weekday_ist(now):
        return "CLOSED"
    market_open, market_close = get_market_open_close_ist(now)
    if now < market_open:
        return "BEFORE_OPEN"
    if now > market_close:
        return "CLOSED"
    return "OPEN"


def wait_until_market_open() -> bool:
    while True:
        status = market_status_ist()
        now = current_ist()
        market_open, market_close = get_market_open_close_ist(now)
        log_and_print(f"WAIT CHECK | now_ist={now} | market_open={market_open} | market_close={market_close} | status={status}")
        if status == "OPEN":
            return True
        if status == "CLOSED":
            log_and_print("Trading window closed. Strategy will not run now.", "warning")
            return False
        time.sleep(5)


def resolve_existing_file(candidates: Iterable[str], label: str = "file") -> str:
    checked: list[str] = []
    for candidate in candidates:
        path = Path(candidate)
        checked.append(str(path))
        if path.exists():
            return str(path)
        backend_path = Path("backend") / path
        checked.append(str(backend_path))
        if backend_path.exists():
            return str(backend_path)
    raise FileNotFoundError(f"Could not find {label}. Checked: {checked}")


def log_and_print(message: str, level: str = "info") -> None:
    stamp = current_ist().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] {message}"
    print(line)
    log_level = level if level in {"debug", "info", "warning", "error"} else "info"
    getattr(_logger, log_level)(line)


def main() -> None:
    _upside_strategy_main()


if __name__ == "__main__":
    main()
