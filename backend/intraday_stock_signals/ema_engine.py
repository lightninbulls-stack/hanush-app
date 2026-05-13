from __future__ import annotations

from collections import deque
from typing import Deque, Dict, Optional, Tuple


# -------------------------------------------------------
# 🔹 SMA STATE CLASS
# -------------------------------------------------------
class SMAState:
    """
    Maintains rolling FAST / SLOW SMA for one symbol.

    Note:
    - Signal becomes valid only after enough ticks are collected.
    - FAST SMA = last 50 ticks  (~5 min at 1 tick/6s per symbol)
    - SLOW SMA = last 150 ticks (~15 min at 1 tick/6s per symbol)
    """

    def __init__(self, fast_span: int, slow_span: int) -> None:
        if fast_span <= 0 or slow_span <= 0:
            raise ValueError("SMA spans must be positive integers")
        if fast_span >= slow_span:
            raise ValueError("fast_span should be lower than slow_span")

        self.fast_span = fast_span
        self.slow_span = slow_span

        self.prices: Deque[float] = deque(maxlen=slow_span)

        self.fast_sma: Optional[float] = None
        self.slow_sma: Optional[float] = None

        self.prev_fast_sma: Optional[float] = None
        self.prev_slow_sma: Optional[float] = None

    def update(self, price: float) -> None:
        price = float(price)

        self.prev_fast_sma = self.fast_sma
        self.prev_slow_sma = self.slow_sma

        self.prices.append(price)

        if len(self.prices) >= self.fast_span:
            fast_window = list(self.prices)[-self.fast_span:]
            self.fast_sma = sum(fast_window) / self.fast_span
        else:
            self.fast_sma = None

        if len(self.prices) >= self.slow_span:
            slow_window = list(self.prices)[-self.slow_span:]
            self.slow_sma = sum(slow_window) / self.slow_span
        else:
            self.slow_sma = None

    def bullish_crossover(self) -> bool:
        if None in (
            self.prev_fast_sma,
            self.prev_slow_sma,
            self.fast_sma,
            self.slow_sma,
        ):
            return False

        return (
            self.prev_fast_sma <= self.prev_slow_sma
            and self.fast_sma > self.slow_sma
        )

    def bearish_crossover(self) -> bool:
        if None in (
            self.prev_fast_sma,
            self.prev_slow_sma,
            self.fast_sma,
            self.slow_sma,
        ):
            return False

        return (
            self.prev_fast_sma >= self.prev_slow_sma
            and self.fast_sma < self.slow_sma
        )


# -------------------------------------------------------
# 🔹 GLOBAL SMA STORE (ONE PER SYMBOL)
# -------------------------------------------------------
sma_store: Dict[str, SMAState] = {}


# -------------------------------------------------------
# 🔹 PUBLIC SMA FUNCTIONS
# -------------------------------------------------------
def update_sma(
    symbol: str,
    price: float,
    fast_span: int = 500,
    slow_span: int = 1500,
) -> Tuple[Optional[float], Optional[float]]:
    """
    Updates rolling SMA for one symbol.

    Returns:
        (fast_sma, slow_sma)
    """
    clean_symbol = str(symbol).strip().upper()

    if clean_symbol not in sma_store:
        sma_store[clean_symbol] = SMAState(
            fast_span=fast_span,
            slow_span=slow_span,
        )

    state = sma_store[clean_symbol]
    state.update(float(price))

    return state.fast_sma, state.slow_sma


def is_bullish(symbol: str) -> bool:
    clean_symbol = str(symbol).strip().upper()
    state = sma_store.get(clean_symbol)
    return state.bullish_crossover() if state else False


def is_bearish(symbol: str) -> bool:
    clean_symbol = str(symbol).strip().upper()
    state = sma_store.get(clean_symbol)
    return state.bearish_crossover() if state else False


def is_bullish_confirmed(symbol: str, min_separation_pct: float = 0.15) -> bool:
    """Bullish crossover AND fast SMA is at least min_separation_pct% above slow SMA."""
    clean_symbol = str(symbol).strip().upper()
    state = sma_store.get(clean_symbol)
    if not state or state.fast_sma is None or state.slow_sma is None or state.slow_sma == 0:
        return False
    separation = (state.fast_sma - state.slow_sma) / state.slow_sma * 100
    return state.bullish_crossover() and separation >= min_separation_pct


def is_bearish_confirmed(symbol: str, min_separation_pct: float = 0.15) -> bool:
    """Bearish crossover AND fast SMA is at least min_separation_pct% below slow SMA."""
    clean_symbol = str(symbol).strip().upper()
    state = sma_store.get(clean_symbol)
    if not state or state.fast_sma is None or state.slow_sma is None or state.slow_sma == 0:
        return False
    separation = (state.slow_sma - state.fast_sma) / state.slow_sma * 100
    return state.bearish_crossover() and separation >= min_separation_pct


def is_index_bullish(symbol: str = "NIFTY_INDEX") -> bool:
    """True when index fast SMA is currently above slow SMA — market in uptrend."""
    clean_symbol = str(symbol).strip().upper()
    state = sma_store.get(clean_symbol)
    if not state or state.fast_sma is None or state.slow_sma is None:
        return False
    return state.fast_sma > state.slow_sma


def is_index_bearish(symbol: str = "NIFTY_INDEX") -> bool:
    """True when index fast SMA is currently below slow SMA — market in downtrend."""
    clean_symbol = str(symbol).strip().upper()
    state = sma_store.get(clean_symbol)
    if not state or state.fast_sma is None or state.slow_sma is None:
        return False
    return state.fast_sma < state.slow_sma


def get_tick_count(symbol: str) -> int:
    clean_symbol = str(symbol).strip().upper()
    state = sma_store.get(clean_symbol)
    return len(state.prices) if state else 0


def reset_sma_for_symbols(symbols: list) -> None:
    """Clear SMA state for the given symbols. Call at the start of each trading session."""
    for sym in symbols:
        sma_store.pop(str(sym).strip().upper(), None)


# -------------------------------------------------------
# 🔹 BACKWARD-COMPATIBILITY ALIAS
# -------------------------------------------------------
# Existing strategy files earlier imported update_ema from this module.
# Keep this alias so older imports do not crash during deployment.
def update_ema(
    symbol: str,
    price: float,
    fast_span: int = 500,
    slow_span: int = 1500,
) -> Tuple[Optional[float], Optional[float]]:
    return update_sma(symbol, price, fast_span=fast_span, slow_span=slow_span)
