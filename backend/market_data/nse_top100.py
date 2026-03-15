"""
NSE Top 100 symbols — used ONLY as the initial DB seed on first startup.
After first run, the `symbols` DB table is the source of truth.
Add/remove stocks via POST/DELETE /admin/symbols API or the /admin dashboard.
"""

NSE_TOP_100_SYMBOLS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK",
    "LT", "BAJFINANCE", "WIPRO", "HCLTECH", "MARUTI",
    "ASIANPAINT", "AXISBANK", "TITAN", "ULTRACEMCO", "ONGC",
    "NTPC", "POWERGRID", "SUNPHARMA", "TECHM", "NESTLEIND",
    "TATAMOTORS", "JSWSTEEL", "TATASTEEL", "INDUSINDBK", "ADANIPORTS",
    "BAJAJ-AUTO", "HDFCLIFE", "SBILIFE", "DIVISLAB", "GRASIM",
    "CIPLA", "DRREDDY", "EICHERMOT", "HEROMOTOCO", "BPCL",
    "COALINDIA", "BRITANNIA", "ADANIENT", "UPL", "APOLLOHOSP",
    "BAJAJFINSV", "TATACONSUM", "HINDALCO", "VEDL", "SHREECEM",
    "AMBUJACEM", "DABUR", "COLPAL", "MARICO", "PIDILITIND",
    "BERGEPAINT", "GODREJCP", "SIEMENS", "HAVELLS", "TATAPOWER",
    "ADANIGREEN", "ADANITRANS", "ICICIGI", "MCDOWELL-N", "TORNTPHARM",
    "LUPIN", "BIOCON", "AUROPHARMA", "ALKEM",
    "MUTHOOTFIN", "CHOLAFIN", "SBICARD", "HDFCAMC", "PAGEIND",
    "NAUKRI", "IRCTC", "DMART", "ZOMATO", "NYKAA",
    "ABB", "ACC", "APLAPOLLO", "ASTRAL", "BALKRISIND",
    "BANDHANBNK", "BEL", "BOSCHLTD", "CANBK", "CUMMINSIND",
    "DLF", "EXIDEIND", "FEDERALBNK", "GAIL", "GODREJPROP",
    "HAL", "IDFCFIRSTB", "INDIANB", "IOC", "JUBLFOOD",
]

SUPPORTED_EXCHANGES = ["NSE", "BSE", "NFO", "MCX"]

TIMEFRAME_CONFIGS = {
    "1min":   {"kite_interval": "minute",   "retention_days": 60},
    "5min":   {"kite_interval": "5minute",  "retention_days": 90},
    "15min":  {"kite_interval": "15minute", "retention_days": 180},
    "1hour":  {"kite_interval": "60minute", "retention_days": 365},
    "1day":   {"kite_interval": "day",      "retention_days": 1825},
    "1week":  {"kite_interval": "day",      "retention_days": None},
    "1month": {"kite_interval": "day",      "retention_days": None},
}

BACKFILL_DAYS = {
    "1min":   60,
    "5min":   90,
    "15min":  180,
    "1hour":  365,
    "1day":   1825,
    "1week":  3650,
    "1month": 3650,
}
