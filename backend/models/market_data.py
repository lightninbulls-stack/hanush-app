from sqlalchemy import (
    Column, String, BigInteger, Integer,
    DateTime, Boolean, Index, UniqueConstraint, Text, Numeric
)
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

# Use declarative base for async engine
Base = declarative_base()


class Symbol(Base):
    __tablename__ = "symbols"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    instrument_token = Column(Integer, nullable=True)
    exchange = Column(String(10), default="NSE")
    name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    last_updated = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


def _ohlcv_table(tablename: str):
    class OHLCVBase(Base):
        __abstract__ = True
        id = Column(BigInteger, primary_key=True, autoincrement=True)
        symbol = Column(String(20), nullable=False)
        timestamp = Column(DateTime, nullable=False)
        open = Column(Numeric(12, 4), nullable=False)
        high = Column(Numeric(12, 4), nullable=False)
        low = Column(Numeric(12, 4), nullable=False)
        close = Column(Numeric(12, 4), nullable=False)
        volume = Column(BigInteger, default=0)
        oi = Column(BigInteger, default=0)
        is_partial = Column(Boolean, default=False)

    return type(
        f"OHLCV_{tablename}",
        (OHLCVBase,),
        {
            "__tablename__": tablename,
            "__table_args__": (
                UniqueConstraint("symbol", "timestamp", name=f"uq_{tablename}_sym_ts"),
                Index(f"ix_{tablename}_sym_ts", "symbol", "timestamp"),
                Index(f"ix_{tablename}_ts", "timestamp"),
            ),
        }
    )


Candle1Min   = _ohlcv_table("ohlcv_1min")
Candle5Min   = _ohlcv_table("ohlcv_5min")
Candle15Min  = _ohlcv_table("ohlcv_15min")
Candle1Hour  = _ohlcv_table("ohlcv_1hour")
Candle1Day   = _ohlcv_table("ohlcv_1day")
Candle1Week  = _ohlcv_table("ohlcv_1week")
Candle1Month = _ohlcv_table("ohlcv_1month")

TIMEFRAME_MODEL_MAP = {
    "1min":   Candle1Min,
    "5min":   Candle5Min,
    "15min":  Candle15Min,
    "1hour":  Candle1Hour,
    "1day":   Candle1Day,
    "1week":  Candle1Week,
    "1month": Candle1Month,
}


class LiveTick(Base):
    __tablename__ = "live_ticks"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    instrument_token = Column(Integer, nullable=True)
    timestamp = Column(DateTime, nullable=False)
    last_price = Column(Numeric(12, 4), nullable=False)
    volume = Column(BigInteger, default=0)
    oi = Column(BigInteger, default=0)
    bid = Column(Numeric(12, 4), nullable=True)
    ask = Column(Numeric(12, 4), nullable=True)
    received_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("ix_live_ticks_sym_ts", "symbol", "timestamp"),)


class KiteSession(Base):
    __tablename__ = "kite_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    access_token = Column(Text, nullable=False)
    request_token = Column(Text, nullable=True)
    public_token = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)


class BackfillJob(Base):
    __tablename__ = "backfill_jobs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False)
    timeframe = Column(String(10), nullable=False)
    status = Column(String(20), default="pending")
    from_date = Column(DateTime, nullable=True)
    to_date = Column(DateTime, nullable=True)
    records_inserted = Column(Integer, default=0)
    error_msg = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", name="uq_backfill_sym_tf"),
        Index("ix_backfill_status", "status"),
    )
