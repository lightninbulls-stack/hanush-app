import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.market_data import TIMEFRAME_MODEL_MAP

logger = logging.getLogger(__name__)

IST        = timezone(timedelta(hours=5, minutes=30))
MARKET_OPEN_OFFSET = timedelta(hours=9, minutes=15)   # 09:15 IST

# Timeframes where candle timestamp = midnight IST (needs +9h15m adjustment)
EOD_TIMEFRAMES = {"1day", "1week", "1month"}

DEFAULT_CANDLE_LIMITS = {
    "1min": 390, "5min": 390, "15min": 500,
    "1hour": 500, "1day": 500, "1week": 260, "1month": 120,
}


def _adjust_timestamp(ts: datetime, timeframe: str) -> int:
    """
    Convert DB timestamp to Unix int for TradingView.

    Zerodha stores daily/weekly/monthly candles at midnight IST (00:00 IST = 18:30 UTC prev day).
    TradingView needs the market open time (09:15 IST) for correct x-axis display.

    Intraday candles (1min, 5min, 15min, 1hour) are already at the correct bar open time.
    """
    # Make timezone-aware if naive (DB stores UTC-naive)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    if timeframe in EOD_TIMEFRAMES:
        # Convert to IST date, then set to 09:15 IST
        ts_ist  = ts.astimezone(IST)
        ts_ist  = ts_ist.replace(
            hour=9, minute=15, second=0, microsecond=0
        )
        return int(ts_ist.timestamp())

    # Intraday — already correct, just return unix
    return int(ts.timestamp())


async def get_candles(
    db: AsyncSession,
    symbol: str,
    timeframe: str,
    from_ts: Optional[datetime] = None,
    to_ts: Optional[datetime] = None,
    limit: Optional[int] = None,
    include_partial: bool = True,
) -> List[Dict]:
    Model = TIMEFRAME_MODEL_MAP.get(timeframe)
    if not Model:
        return []
    limit = limit or DEFAULT_CANDLE_LIMITS.get(timeframe, 500)

    stmt = select(Model).where(Model.symbol == symbol)
    if not include_partial:
        stmt = stmt.where(Model.is_partial == False)
    if from_ts:
        stmt = stmt.where(Model.timestamp >= from_ts)
    if to_ts:
        stmt = stmt.where(Model.timestamp <= to_ts)
    stmt = stmt.order_by(Model.timestamp.desc()).limit(limit)

    try:
        result = await db.execute(stmt)
        rows   = result.scalars().all()
        logger.info(f"Fetched {len(rows)} candles for {symbol} [{timeframe}]")
    except Exception as e:
        logger.error(f"DB query failed for {symbol} [{timeframe}]: {e}", exc_info=True)
        return []

    rows.reverse()
    return [
        {
            "time":       _adjust_timestamp(row.timestamp, timeframe),
            "open":       float(row.open),
            "high":       float(row.high),
            "low":        float(row.low),
            "close":      float(row.close),
            "volume":     int(row.volume),
            "is_partial": row.is_partial,
        }
        for row in rows
    ]


async def get_latest_price(db: AsyncSession, symbol: str) -> Optional[Dict]:
    for tf in ["1min", "5min", "1day"]:
        Model  = TIMEFRAME_MODEL_MAP[tf]
        stmt   = select(Model).where(Model.symbol == symbol).order_by(
                     Model.timestamp.desc()).limit(1)
        result = await db.execute(stmt)
        row    = result.scalars().first()
        if row:
            return {
                "symbol":    symbol,
                "price":     float(row.close),
                "timestamp": row.timestamp.isoformat(),
                "timeframe": tf,
            }
    return None


async def get_multi_symbol_latest(
    db: AsyncSession, symbols: List[str]
) -> Dict[str, Dict]:
    results: Dict[str, Dict] = {}
    for sym in symbols:
        latest = await get_latest_price(db, sym)
        if latest:
            results[sym] = latest
    return results


async def get_available_range(
    db: AsyncSession, symbol: str, timeframe: str
) -> Optional[Tuple[datetime, datetime]]:
    Model = TIMEFRAME_MODEL_MAP.get(timeframe)
    if not Model:
        return None
    stmt   = select(func.min(Model.timestamp), func.max(Model.timestamp)).where(
                 Model.symbol == symbol)
    result = await db.execute(stmt)
    min_ts, max_ts = result.first() or (None, None)
    return (min_ts, max_ts) if min_ts else None


async def get_data_stats(db: AsyncSession) -> Dict:
    stats: Dict[str, int] = {}
    for tf, Model in TIMEFRAME_MODEL_MAP.items():
        try:
            stmt        = select(func.count()).select_from(Model)
            result      = await db.execute(stmt)
            stats[tf]   = result.scalar_one()
        except Exception as e:
            logger.error(f"Stats query failed for {tf}: {e}")
            stats[tf]   = -1
    return stats