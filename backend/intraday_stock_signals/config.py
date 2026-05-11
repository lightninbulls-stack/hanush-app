from __future__ import annotations

import warnings

import pytz

warnings.simplefilter(action="ignore", category=FutureWarning)

IST = pytz.timezone("Asia/Kolkata")

INDEX_NAME = "STOCKS"
SPREAD_TYPE = "intraday_stock_signal"

# Each symbol gets ~1 tick per second (batch LTP fetch).
# 500 ticks  = ~8.3 min fast SMA  (short-term price pressure)
# 1500 ticks = ~25 min slow SMA   (medium-term baseline)
# First entry possible at ~9:40 AM IST (market open 9:15 + 25 min warmup).
FAST_EMA_SPAN = 500
SLOW_EMA_SPAN = 1500

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
STOCK_TARGET_PCT        = 1.0       # +1.0% per stock target
STOCK_SL_PCT            = 1.5       # -1.5% per stock stop loss
PORTFOLIO_SL_PCT        = 2.5       # -2.5% portfolio-level stop loss
PORTFOLIO_TARGET_PCT    = 2.5       # +2.5% portfolio-level target — stop all entries
MAX_STOCK_PRICE         = 5000.0    # skip stocks at or above this price

# ── Capital & leverage ────────────────────────────────────────────────────────
CAPITAL_PER_STOCK       = 10_000    # ₹10,000 margin allocated per stock
INTRADAY_LEVERAGE       = 5         # 5x intraday margin from broker
MAX_STOCKS_PER_STRATEGY = 10        # max concurrent positions
# Effective buying power per stock = CAPITAL_PER_STOCK × INTRADAY_LEVERAGE = ₹50,000
# Total capital deployed           = CAPITAL_PER_STOCK × MAX_STOCKS        = ₹1,00,000

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
