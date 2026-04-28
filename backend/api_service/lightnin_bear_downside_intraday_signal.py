from __future__ import annotations

from intraday_stock_signals.downside_strategy import main as _downside_strategy_main

STRATEGY_NAME = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL"


def main() -> None:
    _downside_strategy_main()


if __name__ == "__main__":
    main()
