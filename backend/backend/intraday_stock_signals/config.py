from __future__ import annotations

import pytz

STRATEGY_NAME = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
INDEX_NAME = "STOCKS"
SPREAD_TYPE = "intraday_stock_signal"

REGIME_FILE_PATH = "backend/data/regime_upside_latest.csv"
INSTRUMENT_FILE_PATH = "backend/data/inst_zerodha_nfo.csv"

FAST_EMA_SPAN = 500
SLOW_EMA_SPAN = 1500

MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

LOG_FILE_NAME = "lightnin_bull_upside_intraday_signal.log"

IST = pytz.timezone("Asia/Kolkata")
