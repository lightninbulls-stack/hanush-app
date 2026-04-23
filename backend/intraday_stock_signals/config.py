from __future__ import annotations

import warnings

import pytz

warnings.simplefilter(action="ignore", category=FutureWarning)

IST = pytz.timezone("Asia/Kolkata")

INDEX_NAME = "STOCKS"
SPREAD_TYPE = "intraday_stock_signal"

FAST_EMA_SPAN = 500
SLOW_EMA_SPAN = 1500

MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

UPSIDE_LOG_FILE_NAME = "lightnin_bull_upside_intraday_signal.log"
DOWNSIDE_LOG_FILE_NAME = "lightnin_bear_downside_intraday_signal.log"

REGIME_UPSIDE_FILE_PATH = "backend/data/regime_upside_latest.csv"
REGIME_DOWNSIDE_FILE_PATH = "backend/data/regime_downside_latest.csv"

INSTRUMENT_FILE_CANDIDATES = [
    "backend/data/inst_zerodha_eq.csv",
    "backend/data/inst_zerodha_nse.csv",
    "backend/data/inst_zerodha.csv",
    "backend/data/inst_zerodha_nfo.csv",
]

UPSIDE_CONFIG = {
    "strategy_name": "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL",
    "side": "UPSIDE",
    "regime_file_path": REGIME_UPSIDE_FILE_PATH,
    "fast_span": FAST_EMA_SPAN,
    "slow_span": SLOW_EMA_SPAN,
    "log_file_name": UPSIDE_LOG_FILE_NAME,
}

DOWNSIDE_CONFIG = {
    "strategy_name": "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL",
    "side": "DOWNSIDE",
    "regime_file_path": REGIME_DOWNSIDE_FILE_PATH,
    "fast_span": FAST_EMA_SPAN,
    "slow_span": SLOW_EMA_SPAN,
    "log_file_name": DOWNSIDE_LOG_FILE_NAME,
}
