import logging
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func

from models.market_data import TIMEFRAME_MODEL_MAP

logger = logging.getLogger(__name__)

DEFAULT_CANDLE_LIMITS = {
    "1min": 390, "5min": 390, "15min": 500,
    "1hour": 500, "1day": 500, "1week": 260, "1month": 120,
}


def get_candles(db: Session, symbol: str, timeframe: str,
                from_ts: Optional[datetime] = None, to_ts: Optional[datetime] = None,
                limit: Optional[int] = None, include_partial: bool = True) -> List[Dict]:
    Model = TIMEFRAME_MODEL_MAP.get(timeframe)
    if not Model:
        return []
    limit = limit or DEFAULT_CANDLE_LIMITS.get(timeframe, 500)
    query = db.query(Model).filter(Model.symbol == symbol)
    if not include_partial:
        query = query.filter(Model.is_partial == False)
    if from_ts:
        query = query.filter(Model.timestamp >= from_ts)
    if to_ts:
        query = query.filter(Model.timestamp <= to_ts)
    rows = query.order_by(Model.timestamp.desc()).limit(limit).all()
    try:
        rows = query.order_by(Model.timestamp.desc()).limit(limit).all()
        print(f"Fetched {len(rows)} candles for {symbol} [{timeframe}]")
    except Exception as e:
        print(f"DB query failed for {symbol} [{timeframe}]: {e}", exc_info=True)
        return []
    rows.reverse()
    return [
        {"time": int(row.timestamp.timestamp()), "open": float(row.open),
         "high": float(row.high), "low": float(row.low), "close": float(row.close),
         "volume": int(row.volume), "is_partial": row.is_partial}
        for row in rows
    ]


def get_latest_price(db: Session, symbol: str) -> Optional[Dict]:
    for tf in ["1min", "5min", "1day"]:
        Model = TIMEFRAME_MODEL_MAP[tf]
        row = db.query(Model).filter(Model.symbol == symbol).order_by(Model.timestamp.desc()).first()
        if row:
            return {"symbol": symbol, "price": float(row.close),
                    "timestamp": row.timestamp.isoformat(), "timeframe": tf}
    return None


def get_multi_symbol_latest(db: Session, symbols: List[str]) -> Dict[str, Dict]:
    return {sym: p for sym in symbols if (p := get_latest_price(db, sym))}


def get_available_range(db: Session, symbol: str, timeframe: str) -> Optional[Tuple[datetime, datetime]]:
    Model = TIMEFRAME_MODEL_MAP.get(timeframe)
    if not Model:
        return None
    result = db.query(func.min(Model.timestamp), func.max(Model.timestamp)).filter(Model.symbol == symbol).first()
    return (result[0], result[1]) if result and result[0] else None


def get_data_stats(db: Session) -> Dict:
    stats = {}
    for tf, Model in TIMEFRAME_MODEL_MAP.items():
        try:
            stats[tf] = db.query(Model).count()
        except Exception:
            stats[tf] = -1
    return stats
