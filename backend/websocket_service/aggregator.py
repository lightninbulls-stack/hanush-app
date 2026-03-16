"""Real-time tick aggregator. Builds 1min/5min/15min/1hour candles in memory, flushes to DB."""

import logging
import asyncio
import calendar
from collections import defaultdict
from datetime import datetime, time as dtime, date, timedelta
from typing import Dict, List

import pytz
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.market_data import TIMEFRAME_MODEL_MAP, Candle1Day, Candle1Week, Candle1Month

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")
REALTIME_TIMEFRAMES = {"1min": 1, "5min": 5, "15min": 15, "1hour": 60}


class LiveCandle:
    __slots__ = ("symbol", "timeframe", "open_time", "open", "high", "low", "close", "volume", "oi")

    def __init__(self, symbol, timeframe, open_time, first_price):
        self.symbol = symbol
        self.timeframe = timeframe
        self.open_time = open_time
        self.open = self.high = self.low = self.close = first_price
        self.volume = self.oi = 0

    def update(self, price, oi=0):
        self.high = max(self.high, price)
        self.low = min(self.low, price)
        self.close = price
        self.oi = oi

    def to_dict(self):
        return {
            "symbol": self.symbol,
            "timestamp": self.open_time,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "oi": self.oi,
            "is_partial": False,
        }


def get_candle_open_time(tick_time: datetime, minutes: int) -> datetime:
    ist = tick_time.astimezone(IST)
    return ist.replace(minute=(ist.minute // minutes) * minutes, second=0, microsecond=0)


class TickAggregator:
    def __init__(self):
        self.candles: Dict[str, Dict[str, LiveCandle]] = defaultdict(dict)
        self._lock = asyncio.Lock()
        self._queue: List[dict] = []
        self._queue_lock = asyncio.Lock()

    async def process_tick(self, symbol: str, tick: dict):
        price = tick.get("last_price")
        if not price:
            return
        oi = tick.get("oi", 0) or 0
        tick_time = tick.get("exchange_timestamp") or datetime.now(IST)
        if not tick_time.tzinfo:
            tick_time = IST.localize(tick_time)
        async with self._lock:
            for tf_name, minutes in REALTIME_TIMEFRAMES.items():
                candle_open = get_candle_open_time(tick_time, minutes)
                existing = self.candles[symbol].get(tf_name)
                if existing is None or existing.open_time != candle_open:
                    if existing is not None:
                        async with self._queue_lock:
                            self._queue.append({"timeframe": tf_name, "data": existing.to_dict()})
                    self.candles[symbol][tf_name] = LiveCandle(symbol, tf_name, candle_open, price)
                else:
                    existing.update(price, oi=oi)

    async def flush_db_queue(self, db: AsyncSession):
        async with self._queue_lock:
            if not self._queue:
                return
            batch = self._queue.copy()
            self._queue.clear()
        by_tf: Dict[str, List] = defaultdict(list)
        for item in batch:
            by_tf[item["timeframe"]].append(item["data"])
        try:
            for tf, rows in by_tf.items():
                Model = TIMEFRAME_MODEL_MAP[tf]
                stmt = pg_insert(Model.__table__).values(rows)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["symbol", "timestamp"],
                    set_={k: stmt.excluded[k] for k in ["open", "high", "low", "close", "volume", "oi", "is_partial"]}
                )
                await db.execute(stmt)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"DB flush error: {e}")

    async def flush_partial_candles(self, db: AsyncSession):
        rows_by_tf: Dict[str, List] = defaultdict(list)
        async with self._lock:
            for symbol, tf_candles in self.candles.items():
                for tf, candle in tf_candles.items():
                    row = candle.to_dict()
                    row["is_partial"] = True
                    rows_by_tf[tf].append(row)
        if not rows_by_tf:
            return
        try:
            for tf, rows in rows_by_tf.items():
                Model = TIMEFRAME_MODEL_MAP[tf]
                stmt = pg_insert(Model.__table__).values(rows)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["symbol", "timestamp"],
                    set_={
                        "high": stmt.excluded.high,
                        "low": stmt.excluded.low,
                        "close": stmt.excluded.close,
                        "volume": stmt.excluded.volume,
                        "oi": stmt.excluded.oi,
                        "is_partial": True,
                    }
                )
                await db.execute(stmt)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Partial flush error: {e}")

    async def finalize_eod_candles(self, db: AsyncSession):
        logger.info("EOD finalization started")
        async with self._lock:
            for symbol, tf_candles in self.candles.items():
                for tf, candle in tf_candles.items():
                    async with self._queue_lock:
                        self._queue.append({"timeframe": tf, "data": candle.to_dict()})
            self.candles.clear()
        await self.flush_db_queue(db)
        today = date.today()
        await self._build_daily_candle(db, today)
        if today.weekday() == 4:
            await self._build_weekly_candle(db, today)
        if self._is_last_trading_day_of_month(today):
            await self._build_monthly_candle(db, today)
        logger.info("EOD finalization complete")

    async def _build_daily_candle(self, db: AsyncSession, for_date: date):
        from market_data.symbol_registry import get_active_symbols
        try:
            for symbol in await get_active_symbols(db):
                result = await db.execute(
                    text("""SELECT (array_agg(open ORDER BY timestamp))[1], MAX(high), MIN(low),
                            (array_agg(close ORDER BY timestamp DESC))[1], SUM(volume)
                            FROM ohlcv_1min WHERE symbol = :sym AND timestamp::date = :d AND is_partial = false"""),
                    {"sym": symbol, "d": for_date}
                )
                row = result.fetchone()
                if row and row[0]:
                    candle_row = {
                        "symbol": symbol,
                        "timestamp": datetime.combine(for_date, dtime(9, 15)),
                        "open": float(row[0]),
                        "high": float(row[1]),
                        "low": float(row[2]),
                        "close": float(row[3]),
                        "volume": int(row[4] or 0),
                        "oi": 0,
                        "is_partial": False,
                    }
                    stmt = pg_insert(Candle1Day.__table__).values([candle_row])
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["symbol", "timestamp"],
                        set_={k: stmt.excluded[k] for k in ["open", "high", "low", "close", "volume"]}
                    )
                    await db.execute(stmt)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Daily candle build error: {e}")

    async def _build_weekly_candle(self, db: AsyncSession, friday: date):
        await self._aggregate_higher_tf(db, Candle1Day, Candle1Week, friday - timedelta(days=4), friday, "1week")

    async def _build_monthly_candle(self, db: AsyncSession, last_day: date):
        await self._aggregate_higher_tf(db, Candle1Day, Candle1Month, last_day.replace(day=1), last_day, "1month")

    async def _aggregate_higher_tf(self, db: AsyncSession, source_model, target_model, from_date, to_date, label: str):
        from market_data.symbol_registry import get_active_symbols
        try:
            for symbol in await get_active_symbols(db):
                result = await db.execute(
                    text(f"""SELECT (array_agg(open ORDER BY timestamp))[1], MAX(high), MIN(low),
                             (array_agg(close ORDER BY timestamp DESC))[1], SUM(volume)
                             FROM {source_model.__tablename__}
                             WHERE symbol = :sym AND timestamp::date BETWEEN :from_d AND :to_d AND is_partial = false"""),
                    {"sym": symbol, "from_d": from_date, "to_d": to_date}
                )
                row = result.fetchone()
                if row and row[0]:
                    candle_row = {
                        "symbol": symbol,
                        "timestamp": datetime.combine(from_date, dtime(9, 15)),
                        "open": float(row[0]),
                        "high": float(row[1]),
                        "low": float(row[2]),
                        "close": float(row[3]),
                        "volume": int(row[4] or 0),
                        "oi": 0,
                        "is_partial": False,
                    }
                    stmt = pg_insert(target_model.__table__).values([candle_row])
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["symbol", "timestamp"],
                        set_={k: stmt.excluded[k] for k in ["open", "high", "low", "close", "volume"]}
                    )
                    await db.execute(stmt)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"{label} candle build error: {e}")

    @staticmethod
    def _is_last_trading_day_of_month(today: date) -> bool:
        last_day = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
        while last_day.weekday() >= 5:
            last_day -= timedelta(days=1)
        return today == last_day


aggregator = TickAggregator()