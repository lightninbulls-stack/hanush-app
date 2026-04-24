from __future__ import annotations

import logging
import os
import sys
import time
from datetime import datetime
from typing import Optional

from .config import (
    IST,
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    MARKET_CLOSE_HOUR,
    MARKET_CLOSE_MINUTE,
)


def setup_logger(logger_name: str, log_file_name: str) -> logging.Logger:
    logger = logging.getLogger(logger_name)

    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

    file_handler = logging.FileHandler(log_file_name, mode="a", encoding="utf-8")
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    logger.propagate = False
    return logger


def build_log_and_print(logger: logging.Logger):
    def log_and_print(msg: str, level: str = "info") -> None:
        stamp = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{stamp}] {msg}"
        print(line)
        getattr(logger, level if level in {"info", "warning", "error", "debug"} else "info")(line)

    return log_and_print


def current_ist() -> datetime:
    return datetime.now(IST)


def get_market_open_close_ist(ref: Optional[datetime] = None) -> tuple[datetime, datetime]:
    now_ist = ref or current_ist()
    market_open = now_ist.replace(
        hour=MARKET_OPEN_HOUR,
        minute=MARKET_OPEN_MINUTE,
        second=0,
        microsecond=0,
    )
    market_close = now_ist.replace(
        hour=MARKET_CLOSE_HOUR,
        minute=MARKET_CLOSE_MINUTE,
        second=0,
        microsecond=0,
    )
    return market_open, market_close


def is_weekday_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    return now_ist.weekday() < 5


def is_after_market_close_ist(ref: Optional[datetime] = None) -> bool:
    now_ist = ref or current_ist()
    _, market_close = get_market_open_close_ist(now_ist)
    return now_ist > market_close


def wait_until_market_open(publish_wait_state) -> None:
    now_ist = current_ist()
    market_open, market_close = get_market_open_close_ist(now_ist)

    if now_ist > market_close:
        publish_wait_state(
            ui_state="STOPPED",
            message="Trading window closed for the day.",
            progress_text=None,
            is_loading=False,
        )
        raise SystemExit

    if now_ist >= market_open:
        return

    sleep_seconds = int((market_open - now_ist).total_seconds())

    for remaining in range(sleep_seconds, 0, -1):
        if remaining % 5 == 0 or remaining <= 10:
            publish_wait_state(
                ui_state="WAITING_START_TIME",
                message=f"Waiting until {market_open.strftime('%H:%M:%S')} IST.",
                progress_text=f"Start in {remaining} seconds",
                is_loading=True,
            )
        time.sleep(2)


def load_creds() -> dict:
    return {
        "z_api_key": os.environ["Z_API_KEY"].strip(),
        "z_access_token": os.environ["Z_ACCESS_TOKEN"].strip(),
    }
