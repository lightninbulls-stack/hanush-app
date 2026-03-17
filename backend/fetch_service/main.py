import os
import pandas as pd
import numpy as np
import yfinance as yf
import redis
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Optional

# ─────────────────────────────────────────────────────────────────────────────
# Excel / Google Sheets
# ─────────────────────────────────────────────────────────────────────────────
async def fetch_from_excel(category: str) -> List[Dict]:
    base_dir   = Path(__file__).resolve().parent.parent
    excel_path = Path(os.getenv("EXCEL_PATH", str(base_dir / "data" / "trading_bull.xlsx")))

    sheet_map = {
        "Momentum":                      "Momentum",
        "Low Vol":                        "Low_vol",
        "Value":                          "Value",
        "Quality":                        "Quality",
        "Trending Upside":                "Technical_analysis_upside",
        "Trending Downside":              "Technical_analysis_downside",
        "Aggressive Call Option Stocks":  "Derivaties_trading_ce",
        "Aggressive Put Option Stocks":   "Derivartives_trading_pe",
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
                "rank":      i + 1,
                "symbol":    str(symbol),
                "sector":    str(row.get("Sector", "N/A")),
                "score":     int(row.get("Score", 0)),
                "return_3m": float(row.get("3M Return", 0)),
                "return_6m": float(row.get("6M Return", 0)),
            })
        return stocks
    except Exception as e:
        print(f"Excel read error: {e}")
        return []


async def fetch_from_google_sheets(category: str) -> List[Dict]:
    return await fetch_from_excel(category)


# ─────────────────────────────────────────────────────────────────────────────
# Historical OHLCV — normalised to lowercase keys + unix timestamp
# ─────────────────────────────────────────────────────────────────────────────
def _safe_float(v) -> Optional[float]:
    try:
        f = float(v)
        return None if np.isnan(f) else f
    except Exception:
        return None


async def fetch_historical_data(symbol: str, interval: str = "1d") -> List[Dict]:
    yf_symbol  = symbol if "." in symbol else f"{symbol}.NS"
    period_map = {"1m": "5d", "5m": "5d", "15m": "5d", "1h": "1mo",
                  "1d": "1y", "1wk": "max", "1mo": "max"}
    period = period_map.get(interval, "1y")

    try:
        stock = yf.Ticker(yf_symbol)
        hist  = await asyncio.to_thread(stock.history, period=period, interval=interval)
        if hist.empty:
            return []

        # ── Technical indicators ─────────────────────────────────────────────
        hist["ema_20"] = hist["Close"].ewm(span=20, adjust=False).mean()
        hist["sma_50"] = hist["Close"].rolling(window=50).mean()

        # RSI
        delta = hist["Close"].diff()
        gain  = delta.clip(lower=0).rolling(14).mean()
        loss  = (-delta.clip(upper=0)).rolling(14).mean()
        rs    = gain / loss.replace(0, np.nan)
        hist["rsi"] = 100 - (100 / (1 + rs))

        # MACD
        ema12         = hist["Close"].ewm(span=12, adjust=False).mean()
        ema26         = hist["Close"].ewm(span=26, adjust=False).mean()
        hist["macd"]        = ema12 - ema26
        hist["macd_signal"] = hist["macd"].ewm(span=9, adjust=False).mean()
        hist["macd_hist"]   = hist["macd"] - hist["macd_signal"]

        # ── Normalise to lowercase keys + unix timestamp ─────────────────────
        records = []
        for ts, row in hist.iterrows():
            # ts is a pandas Timestamp — convert to unix int
            try:
                time_val = int(ts.timestamp())
            except Exception:
                continue

            records.append({
                "time":        time_val,
                "open":        _safe_float(row.get("Open"))   or 0.0,
                "high":        _safe_float(row.get("High"))   or 0.0,
                "low":         _safe_float(row.get("Low"))    or 0.0,
                "close":       _safe_float(row.get("Close"))  or 0.0,
                "volume":      int(row.get("Volume", 0) or 0),
                "rsi":         _safe_float(row.get("rsi")),
                "macd":        _safe_float(row.get("macd")),
                "macd_signal": _safe_float(row.get("macd_signal")),
                "macd_hist":   _safe_float(row.get("macd_hist")),
                "ema_20":      _safe_float(row.get("ema_20")),
                "sma_50":      _safe_float(row.get("sma_50")),
            })
        return records

    except Exception as e:
        print(f"Error fetching {yf_symbol}: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Stock info
# ─────────────────────────────────────────────────────────────────────────────
async def fetch_stock_info(symbol: str) -> Optional[Dict]:
    yf_symbol = symbol if "." in symbol else f"{symbol}.NS"
    try:
        stock = yf.Ticker(yf_symbol)
        info  = await asyncio.to_thread(lambda: stock.info)
        return {
            "symbol":     symbol,
            "name":       info.get("longName"),
            "sector":     info.get("sector"),
            "market_cap": info.get("marketCap"),
            "pe_ratio":   info.get("trailingPE"),
            "high_52w":   info.get("fiftyTwoWeekHigh"),
            "low_52w":    info.get("fiftyTwoWeekLow"),
            "summary":    info.get("longBusinessSummary"),
            "price":      info.get("currentPrice") or info.get("regularMarketPrice"),
            "change_pct": info.get("regularMarketChangePercent"),
        }
    except Exception as e:
        print(f"Error fetching info for {yf_symbol}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# DataService — Redis cache
# ─────────────────────────────────────────────────────────────────────────────
class DataService:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL") or os.getenv("REDIS_HOST", "localhost")
        try:
            if redis_url.startswith("redis://") or redis_url.startswith("rediss://"):
                self.redis_client = redis.from_url(redis_url, socket_timeout=5)
            else:
                self.redis_client = redis.Redis(host=redis_url, port=6379, db=0, socket_timeout=5)
            self.redis_client.ping()
        except Exception:
            self.redis_client = None

    async def get_cached_stock_list(self, category: str) -> Optional[List[Dict]]:
        if not self.redis_client:
            return None
        try:
            raw = await asyncio.to_thread(self.redis_client.get, f"stocks:{category}")
            return json.loads(raw) if raw else None
        except Exception:
            return None

    async def cache_stock_list(self, category: str, data: List[Dict]):
        if not self.redis_client:
            return
        try:
            await asyncio.to_thread(
                self.redis_client.set, f"stocks:{category}", json.dumps(data), 86400
            )
        except Exception:
            pass