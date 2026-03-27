from pydantic import BaseModel
from typing import List, Optional, Union


class StockData(BaseModel):
    rank: int
    symbol: str
    sector: str
    score: int

    return_1w: Optional[float] = None
    return_1m: Optional[float] = None
    return_3m: Optional[float] = None
    return_6m: Optional[float] = None

    volatility_6m: Optional[float] = None
    volatility_bucket: Optional[str] = None


class StockListResponse(BaseModel):
    category: str
    stocks: List[StockData]


class HistoricalData(BaseModel):
    time: Union[str, int]
    open: float
    high: float
    low: float
    close: float
    volume: int
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    ema_20: Optional[float] = None
    sma_50: Optional[float] = None


class StockInfo(BaseModel):
    symbol: str
    name: Optional[str] = None
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    high_52w: Optional[float] = None
    low_52w: Optional[float] = None
    summary: Optional[str] = None
    price: Optional[float] = None
    change_pct: Optional[float] = None
