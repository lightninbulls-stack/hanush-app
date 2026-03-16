"""Historical data backfill from Kite API. Rate-limited to 3 req/sec."""

import logging
import asyncio
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from kite_service.auth import kite_auth
from kite_service.instrument_manager import instrument_manager
from models.market_data import TIMEFRAME_MODEL_MAP, BackfillJob
from market_data.nse_top100 import BACKFILL_DAYS, TIMEFRAME_CONFIGS
from market_data.symbol_registry import get_active_symbols
from db import SessionLocal

logger = logging.getLogger(__name__)

REQUEST_DELAY = 1.0 / 3
MAX_DAYS_PER_REQUEST = {
    "1min": 60, "5min": 60, "15min": 60, "1hour": 60,
    "1day": 2000, "1week": 2000, "1month": 2000,
}


def fetch_kite_historical(symbol: str, timeframe: str,
                          from_date: datetime, to_date: datetime, kite) -> List[Dict]:
    token = instrument_manager.get_token(symbol)
    if not token:
        return []
    interval = TIMEFRAME_CONFIGS[timeframe]["kite_interval"]
    if timeframe in ("1week", "1month"):
        interval = "day"
    try:
        return kite.historical_data(
            instrument_token=token,
            from_date=from_date,
            to_date=to_date,
            interval=interval,
            continuous=False,
            oi=True
        )
    except Exception as e:
        logger.error(f"Kite fetch error {symbol}/{timeframe}: {e}")
        return []


def resample_to_timeframe(records: List[Dict], timeframe: str) -> List[Dict]:
    if not records or timeframe not in ("1week", "1month"):
        return records
    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    df.set_index("date", inplace=True)
    rule = "W-FRI" if timeframe == "1week" else "MS"
    agg = df.resample(rule).agg({
        "open": "first", "high": "max", "low": "min",
        "close": "last", "volume": "sum", "oi": "last"
    }).dropna(subset=["open"])
    return [
        {"date": ts.to_pydatetime(),
         "open": float(r["open"]), "high": float(r["high"]),
         "low": float(r["low"]), "close": float(r["close"]),
         "volume": int(r["volume"]), "oi": int(r.get("oi", 0))}
        for ts, r in agg.iterrows()
    ]


def upsert_candles(db: Session, timeframe: str, symbol: str, records: List[Dict]) -> int:
    if not records:
        return 0
    Model = TIMEFRAME_MODEL_MAP[timeframe]
    rows = []
    for r in records:
        ts = r["date"] if isinstance(r["date"], datetime) else pd.to_datetime(r["date"]).to_pydatetime()
        rows.append({
            "symbol": symbol, "timestamp": ts,
            "open": float(r["open"]), "high": float(r["high"]),
            "low": float(r["low"]), "close": float(r["close"]),
            "volume": int(r.get("volume", 0)), "oi": int(r.get("oi", 0)),
            "is_partial": False
        })
    try:
        stmt = pg_insert(Model.__table__).values(rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=["symbol", "timestamp"])
        result = db.execute(stmt)
        db.commit()
        return result.rowcount
    except Exception as e:
        db.rollback()
        logger.error(f"Upsert error {symbol}/{timeframe}: {e}")
        return 0


def backfill_symbol(symbol: str, timeframe: str, force: bool = False) -> int:
    """Synchronous backfill for one symbol/timeframe."""
    db = SessionLocal()
    kite = kite_auth.get_kite()
    if not kite:
        db.close()
        return 0
    job = db.query(BackfillJob).filter(
        BackfillJob.symbol == symbol,
        BackfillJob.timeframe == timeframe
    ).first()
    if job and job.status == "done" and not force:
        db.close()
        return 0
    if not job:
        job = BackfillJob(symbol=symbol, timeframe=timeframe)
        db.add(job)
        db.commit()
        db.refresh(job)
    job.status = "running"
    job.started_at = datetime.utcnow()
    db.commit()
    total = 0
    days_back = BACKFILL_DAYS[timeframe]
    max_days = MAX_DAYS_PER_REQUEST[timeframe]
    to_date = datetime.now()
    from_date = to_date - timedelta(days=days_back)
    try:
        current_to = to_date
        current_from = max(from_date, current_to - timedelta(days=max_days))
        while current_to >= from_date:
            records = fetch_kite_historical(symbol, timeframe, current_from, current_to, kite)
            if timeframe in ("1week", "1month"):
                records = resample_to_timeframe(records, timeframe)
            if records:
                total += upsert_candles(db, timeframe, symbol, records)
            time.sleep(REQUEST_DELAY)
            current_to = current_from - timedelta(seconds=1)
            current_from = max(from_date, current_to - timedelta(days=max_days))
            if current_to < from_date:
                break
        job.status = "done"
        job.records_inserted = total
        job.completed_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        job.status = "failed"
        job.error_msg = str(e)
        db.commit()
        logger.error(f"Backfill failed {symbol}/{timeframe}: {e}")
    finally:
        db.close()
    return total


# --- Async wrappers for safe use in FastAPI/Uvicorn ---

async def backfill_symbol_async(symbol: str, timeframe: str, force: bool = False) -> int:
    return await asyncio.to_thread(backfill_symbol, symbol, timeframe, force)


async def run_full_backfill_async(timeframes: List[str] = None,
                                  symbols: List[str] = None,
                                  force: bool = False):
    if not instrument_manager.is_loaded():
        instrument_manager.load_instruments()
    symbols = symbols or get_active_symbols()
    timeframes = timeframes or ["1day", "1week", "1month", "1hour", "15min", "5min", "1min"]
    logger.info(f"Backfill start: {len(symbols)} symbols × {len(timeframes)} timeframes")
    for tf in timeframes:
        for symbol in symbols:
            await backfill_symbol_async(symbol, tf, force=force)
            await asyncio.sleep(0.1)
    logger.info("Backfill complete")


async def refresh_recent_1min_async(symbols: List[str] = None):
    if not instrument_manager.is_loaded():
        instrument_manager.load_instruments()
    kite = kite_auth.get_kite()
    if not kite:
        return
    symbols = symbols or get_active_symbols()
    to_date = datetime.now()
    from_date = to_date - timedelta(days=2)

    async def refresh_one(symbol: str):
        db = SessionLocal()
        try:
            records = fetch_kite_historical(symbol, "1min", from_date, to_date, kite)
            if records:
                upsert_candles(db, "1min", symbol, records)
        finally:
            db.close()

    for symbol in symbols:
        await asyncio.to_thread(refresh_one, symbol)
        await asyncio.sleep(REQUEST_DELAY)