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
MARKET_CLOSE_HOUR = 22
MARKET_CLOSE_MINUTE = 30

UPSIDE_LOG_FILE_NAME = "lightnin_bull_upside_intraday_signal.log"
DOWNSIDE_LOG_FILE_NAME = "lightnin_bear_downside_intraday_signal.log"

# IMPORTANT:
# Render working directory is already /opt/render/project/src/backend
# So use data/... not backend/data/...
REGIME_UPSIDE_FILE_PATH = "data/regime_upside_latest.csv"
REGIME_DOWNSIDE_FILE_PATH = "data/regime_downside_latest.csv"

INSTRUMENT_FILE_CANDIDATES = [
    "data/inst_zerodha_eq.csv",
    "data/inst_zerodha_nse.csv",
    "data/inst_zerodha.csv",
    "data/inst_zerodha_nfo.csv",
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
