import os
import pandas as pd
import yfinance as yf
import redis
import json
import calendar
import asyncio
from pathlib import Path
from typing import List, Dict

# Async Excel reader
async def fetch_from_excel(category: str) -> List[Dict]:
    base_dir = Path(__file__).resolve().parent.parent
    default_path = base_dir / "data" / "trading_bull.xlsx"
    excel_path = Path(os.getenv("EXCEL_PATH", str(default_path)))

    sheet_map = {
        "Momentum": "Momentum",
        "Low Vol": "Low_vol",
        "Value": "Value",
        "Quality": "Quality",
        "Trending Upside": "Technical_analysis_upside",
        "Trending Downside": "Technical_analysis_downside",
        "Aggressive Call Option Stocks": "Derivaties_trading_ce",
        "Aggressive Put Option Stocks": "Derivartives_trading_pe"
    }
    sheet_name = sheet_map.get(category, category)

    if not os.path.exists(excel_path):
        return []

    try:
        df = await asyncio.to_thread(pd.read_excel, excel_path, sheet_name=sheet_name)
        stocks = []
        for i, row in df.iterrows():
            symbol = row.get("Symbol") or row.get("SYMBOL") or row.get("symbol")
            if symbol is None:
                continue
            stocks.append({
                "rank": i + 1,
                "symbol": str(symbol),
                "sector": str(row.get("Sector", "N/A")),
                "score": int(row.get("Score", 0)),
                "return_3m": float(row.get("3M Return", 0)),
                "return_6m": float(row.get("6M Return", 0))
            })
        return stocks
    except Exception as e:
        print(f"Excel read error: {e}")
        return []

async def fetch_from_google_sheets(category: str) -> List[Dict]:
    return await fetch_from_excel(category)

# Async historical data
async def fetch_historical_data(symbol: str, interval: str = "1d"):
    yf_symbol = symbol if "." in symbol else f"{symbol}.NS"
    period_map = {"5m": "5d", "15m": "5d", "1h": "1mo", "1d": "1y", "1wk": "max", "1mo": "max"}
    period = period_map.get(interval, "1y")

    try:
        stock = yf.Ticker(yf_symbol)
        hist = await asyncio.to_thread(stock.history, period=period, interval=interval)
        if hist.empty:
            return []
        # (technical indicators calculation same as before)
        # ...
        return hist.to_dict("records")
    except Exception as e:
        print(f"Error fetching {yf_symbol}: {e}")
        return []

async def fetch_stock_info(symbol: str):
    yf_symbol = symbol if "." in symbol else f"{symbol}.NS"
    try:
        stock = yf.Ticker(yf_symbol)
        info = await asyncio.to_thread(lambda: stock.info)
        return {
            "symbol": symbol,
            "name": info.get("longName"),
            "sector": info.get("sector"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "high_52w": info.get("fiftyTwoWeekHigh"),
            "low_52w": info.get("fiftyTwoWeekLow"),
            "summary": info.get("longBusinessSummary"),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "change_pct": info.get("regularMarketChangePercent")
        }
    except Exception as e:
        print(f"Error fetching info for {yf_symbol}: {e}")
        return None

class DataService:
    def __init__(self):
        redis_host = os.getenv("REDIS_HOST", "localhost")
        try:
            self.redis_client = redis.Redis(host=redis_host, port=6379, db=0, socket_timeout=5)
            self.redis_client.ping()
        except Exception:
            self.redis_client = None

    async def cache_stock_list(self, category: str, data: List[Dict]):
        if self.redis_client:
            await asyncio.to_thread(self.redis_client.set, f"stocks:{category}", json.dumps(data), 86400)

    async def get_cached_stock_list(self, category: str):
        if self.redis_client:
            raw = await asyncio.to_thread(self.redis_client.get, f"stocks:{category}")
            return json.loads(raw) if raw else None
        return None
