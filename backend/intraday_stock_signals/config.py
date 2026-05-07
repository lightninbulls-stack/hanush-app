from __future__ import annotations

import warnings

import pytz

warnings.simplefilter(action="ignore", category=FutureWarning)

IST = pytz.timezone("Asia/Kolkata")

INDEX_NAME = "STOCKS"
SPREAD_TYPE = "intraday_stock_signal"

# Each symbol gets ~1 tick every 6 seconds (35-40 symbols, ~1s sleep per cycle).
# 50 ticks × 6s = 300s = 5-min fast SMA; 150 ticks × 6s = 900s = 15-min slow SMA.
# Old values (500/1500) required 50 min / 2.5 hr of warmup — SMAs never computed.
FAST_EMA_SPAN = 50
SLOW_EMA_SPAN = 150

MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
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

# ── Risk parameters ───────────────────────────────────────────────────────────
STOCK_TARGET_PCT    = 1.0   # +1.0% per stock target
STOCK_SL_PCT        = 1.5   # -1.5% per stock stop loss
PORTFOLIO_SL_PCT    = 2.5   # -2.5% portfolio-level circuit breaker

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
