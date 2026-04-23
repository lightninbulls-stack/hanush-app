from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class StockSignalState:
    symbol: str
    instrument_token: int
    name: Optional[str] = None

    signal_status: str = "WAITING"   # WAITING / ENTERED
    paper_trade: bool = False

    entry_time: Optional[str] = None
    avg_price: Optional[float] = None
    current_ltp: Optional[float] = None
    max_ltp: Optional[float] = None
    min_ltp: Optional[float] = None

    points_captured: Optional[float] = None
    pct_captured: Optional[float] = None

    fast_ema: Optional[float] = None
    slow_ema: Optional[float] = None
