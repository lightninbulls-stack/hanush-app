import os
import json
from typing import List, Dict

import pandas as pd
import redis
import yfinance as yf

from fetch_service.main_momentum import fetch_from_momentum_csv
from fetch_service.main_regime import fetch_from_regime_csv


def fetch_from_excel(category: str) -> List[Dict]:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_PATH = os.path.join(BASE_DIR, "..", "data", "trading_bull.xlsx")

    excel_path = os.getenv("EXCEL_PATH", DATA_PATH)

    sheet_map = {
        "Value": "Value",
        "Quality": "Quality",
        "Trending Upside": "Technical_analysis_upside",
        "Trending Downside": "Technical_analysis_downside",
        "Aggressive Call Option Stocks": "Derivaties_trading_ce",
        "Aggressive Put Option Stocks": "Derivartives_trading_pe",
    }

    sheet_name = sheet_map.get(category, category)

    try:
        if not os.path.exists(excel_path):
            print(f"Excel file not found at {excel_path}")
            return []

        df = pd.read_excel(excel_path, sheet_name=sheet_name)
        print(f"Successfully read sheet '{sheet_name}'. Found {len(df)} rows.")

        stocks: List[Dict] = []

        def get_val(row, keys, default=None):
            for key in keys:
                if key in row:
                    val = row[key]
                    return val if not pd.isna(val) else default
            return default

        for i, row in df.iterrows():
            symbol = get_val(row, ["Symbol", "SYMBOL", "symbol"])
            if symbol is None:
                continue

            sector = get_val(row, ["Sector", "SECTOR", "sector"], "N/A")
            score = get_val(row, ["Score", "SCORE", "score"], 0)
            ret1w = get_val(
                row,
                ["1W Return", "1W RETURN", "return_1w", "1w_return", "1W return"],
                None,
            )
            ret1m = get_val(
                row,
                ["1M Return", "1M RETURN", "return_1m", "1m_return", "1M return"],
                None,
            )
            ret3m = get_val(
                row,
                ["3M Return", "3M RETURN", "return_3m", "3m_return", "3M return"],
                None,
            )
            ret6m = get_val(
                row,
                ["6M Return", "6M RETURN", "return_6m", "6m_return", "6M return"],
                None,
            )
            vol6m = get_val(
                row,
                ["6M Volatility", "6M VOLATILITY", "volatility_6m", "6m_volatility"],
                None,
            )
            vol_bucket = get_val(
                row,
                ["Volatility Bucket", "VOLATILITY BUCKET", "volatility_bucket"],
                None,
            )

            stocks.append(
                {
                    "rank": int(get_val(row, ["Rank", "RANK", "rank"], i + 1)),
                    "symbol": str(symbol),
                    "sector": str(sector),
                    "score": int(float(score)) if score is not None else 0,
                    "return_1w": float(ret1w) if ret1w is not None else None,
                    "return_1m": float(ret1m) if ret1m is not None else None,
                    "return_3m": float(ret3m) if ret3m is not None else None,
                    "return_6m": float(ret6m) if ret6m is not None else None,
                    "volatility_6m": float(vol6m) if vol6m is not None else None,
                    "volatility_bucket": str(vol_bucket) if vol_bucket is not None else None,
                }
            )

        print(f"Mapped {len(stocks)} valid stock records for {category}")
        return stocks

    except Exception as e:
        print(f"Error reading Excel {excel_path} sheet {sheet_name}: {e}")
        return []


def fetch_from_low_vol_csv() -> List[Dict]:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "..", "data", "low_vol_latest.csv")

    try:
        if not os.path.exists(csv_path):
            print(f"Low Vol CSV not found at {csv_path}")
            return []

        df = pd.read_csv(csv_path)
        print(f"Successfully read low vol CSV. Found {len(df)} rows.")

        stocks: List[Dict] = []

        for i, row in df.iterrows():
            symbol = row.get("Symbol")
            if pd.isna(symbol):
                continue

            sector = row.get("Sector", "N/A")
            score = row.get("Score", 0)
            ret1w = row.get("1W Return", 0)
            ret1m = row.get("1M Return", 0)
            ret3m = row.get("3M Return", 0)
            ret6m = row.get("6M Return", 0)
            vol6m = row.get("6M Volatility", 0)
            vol_bucket = row.get("Volatility Bucket", "N/A")

            stocks.append(
                {
                    "rank": int(row.get("Rank", i + 1)),
                    "symbol": str(symbol),
                    "sector": str(sector) if not pd.isna(sector) else "N/A",
                    "score": int(float(score)) if not pd.isna(score) else 0,
                    "return_1w": float(ret1w) if not pd.isna(ret1w) else 0.0,
                    "return_1m": float(ret1m) if not pd.isna(ret1m) else 0.0,
                    "return_3m": float(ret3m) if not pd.isna(ret3m) else 0.0,
                    "return_6m": float(ret6m) if not pd.isna(ret6m) else 0.0,
                    "volatility_6m": float(vol6m) if not pd.isna(vol6m) else 0.0,
                    "volatility_bucket": str(vol_bucket) if not pd.isna(vol_bucket) else "N/A",
                }
            )

        print(f"Mapped {len(stocks)} low vol CSV records")
        return stocks

    except Exception as e:
        print(f"Error reading low vol CSV {csv_path}: {e}")
        return []


def fetch_from_google_sheets(category: str) -> List[Dict]:
    if category == "Momentum":
        return fetch_from_momentum_csv()

    if category == "Low Vol":
        return fetch_from_low_vol_csv()

    if category in {"Regime Upside", "Regime Downside"}:
        return fetch_from_regime_csv(category)

    return fetch_from_excel(category)


def fetch_historical_data(symbol: str, interval: str = "1d"):
    yf_symbol = symbol if "." in symbol else f"{symbol}.NS"
    period_map = {
        "5m": "5d",
        "15m": "5d",
        "1h": "1mo",
        "1d": "1y",
        "1wk": "max",
        "1mo": "max",
    }
    period = period_map.get(interval, "1y")

    try:
        stock = yf.Ticker(yf_symbol)
        hist = stock.history(period=period, interval=interval)

        if hist.empty:
            return []

        if len(hist) > 50:
            delta = hist["Close"].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            hist["rsi"] = 100 - (100 / (1 + rs))

            exp1 = hist["Close"].ewm(span=12, adjust=False).mean()
            exp2 = hist["Close"].ewm(span=26, adjust=False).mean()
            hist["macd"] = exp1 - exp2
            hist["macd_signal"] = hist["macd"].ewm(span=9, adjust=False).mean()
            hist["macd_hist"] = hist["macd"] - hist["macd_signal"]

            hist["ema_20"] = hist["Close"].ewm(span=20, adjust=False).mean()
            hist["sma_50"] = hist["Close"].rolling(window=50).mean()

        data = []
        for index, row in hist.iterrows():
            if interval in ["5m", "15m", "1h"]:
                item_time = int(index.timestamp())
            else:
                item_time = index.strftime("%Y-%m-%d")

            data.append(
                {
                    "time": item_time,
                    "open": round(float(row["Open"]), 2),
                    "high": round(float(row["High"]), 2),
                    "low": round(float(row["Low"]), 2),
                    "close": round(float(row["Close"]), 2),
                    "volume": int(row["Volume"]),
                    "rsi": round(float(row.get("rsi", 0)), 2)
                    if not pd.isna(row.get("rsi"))
                    else None,
                    "macd": round(float(row.get("macd", 0)), 2)
                    if not pd.isna(row.get("macd"))
                    else None,
                    "macd_signal": round(float(row.get("macd_signal", 0)), 2)
                    if not pd.isna(row.get("macd_signal"))
                    else None,
                    "macd_hist": round(float(row.get("macd_hist", 0)), 2)
                    if not pd.isna(row.get("macd_hist"))
                    else None,
                    "ema_20": round(float(row.get("ema_20", 0)), 2)
                    if not pd.isna(row.get("ema_20"))
                    else None,
                    "sma_50": round(float(row.get("sma_50", 0)), 2)
                    if not pd.isna(row.get("sma_50"))
                    else None,
                }
            )

        return data

    except Exception as e:
        print(f"Error fetching {yf_symbol}: {e}")
        return []


def fetch_stock_info(symbol: str):
    yf_symbol = symbol if "." in symbol else f"{symbol}.NS"

    try:
        stock = yf.Ticker(yf_symbol)
        info = stock.info

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
            "change_pct": info.get("regularMarketChangePercent"),
        }

    except Exception as e:
        print(f"Error fetching info for {yf_symbol}: {e}")
        return None


class DataService:
    def __init__(self):
        redis_host = os.getenv("REDIS_HOST", "localhost")

        try:
            self.redis_client = redis.Redis(
                host=redis_host,
                port=6379,
                db=0,
                socket_timeout=5,
            )
            self.redis_client.ping()
        except Exception:
            self.redis_client = None

    def cache_stock_list(self, category: str, data: List[Dict]):
        if category in {"Momentum", "Low Vol", "Regime Upside", "Regime Downside"}:
            return

        if self.redis_client:
            self.redis_client.set(f"stocks:{category}", json.dumps(data), ex=86400)

    def get_cached_stock_list(self, category: str):
        if category in {"Momentum", "Low Vol", "Regime Upside", "Regime Downside"}:
            return None

        if self.redis_client:
            try:
                data = self.redis_client.get(f"stocks:{category}")
                return json.loads(data) if data else None
            except Exception:
                return None

        return None

    def cache_historical_data(self, symbol: str, interval: str, data: List[Dict]):
        if self.redis_client:
            self.redis_client.set(
                f"history:{symbol}:{interval}",
                json.dumps(data, default=str),
                ex=300,
            )

    def get_cached_historical_data(self, symbol: str, interval: str):
        if self.redis_client:
            try:
                raw = self.redis_client.get(f"history:{symbol}:{interval}")
                return json.loads(raw) if raw else None
            except Exception:
                return None

        return None

    def cache_stock_info(self, symbol: str, data: Dict):
        if self.redis_client:
            try:
                self.redis_client.set(f"info:{symbol}", json.dumps(data), ex=3600)
            except Exception:
                pass

    def get_cached_stock_info(self, symbol: str):
        if self.redis_client:
            try:
                raw = self.redis_client.get(f"info:{symbol}")
                return json.loads(raw) if raw else None
            except Exception:
                return None

        return None
