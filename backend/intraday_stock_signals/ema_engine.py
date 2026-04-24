from __future__ import annotations

from typing import Optional


class EMAState:
    def __init__(self, fast_span: int, slow_span: int) -> None:
        self.fast_span = fast_span
        self.slow_span = slow_span

        self.fast_alpha = 2 / (fast_span + 1)
        self.slow_alpha = 2 / (slow_span + 1)

        self.fast_ema: Optional[float] = None
        self.slow_ema: Optional[float] = None
        self.prev_fast_ema: Optional[float] = None
        self.prev_slow_ema: Optional[float] = None

    def update(self, price: float) -> None:
        if self.fast_ema is None:
            self.fast_ema = price
        else:
            self.prev_fast_ema = self.fast_ema
            self.fast_ema = (price * self.fast_alpha) + (self.fast_ema * (1 - self.fast_alpha))
            # 

        if self.slow_ema is None:
            self.slow_ema = price
        else:
            self.prev_slow_ema = self.slow_ema
            self.slow_ema = (price * self.slow_alpha) + (self.slow_ema * (1 - self.slow_alpha))

    def bullish_crossover(self) -> bool:
        if None in (self.prev_fast_ema, self.prev_slow_ema, self.fast_ema, self.slow_ema):
            return False

        return (
            self.prev_fast_ema <= self.prev_slow_ema
            and self.fast_ema > self.slow_ema
        )

    def bearish_crossover(self) -> bool:
        if None in (self.prev_fast_ema, self.prev_slow_ema, self.fast_ema, self.slow_ema):
            return False

        return (
            self.prev_fast_ema >= self.prev_slow_ema
            and self.fast_ema < self.slow_ema
        )
