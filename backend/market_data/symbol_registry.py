"""
DB-driven symbol management. The `symbols` table is the single source of truth.
`nse_top100.py` is used ONLY for the initial seed on first run.
"""

import logging
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from db import SessionLocal
from models.market_data import Symbol
from market_data.nse_top100 import NSE_TOP_100_SYMBOLS, SUPPORTED_EXCHANGES

logger = logging.getLogger(__name__)


def get_active_symbols(db: Session = None) -> List[str]:
    own_db = db is None
    if own_db:
        db = SessionLocal()
    try:
        rows = db.query(Symbol.symbol).filter(Symbol.is_active == True).order_by(Symbol.symbol).all()
        return [r.symbol for r in rows]
    finally:
        if own_db:
            db.close()


def get_active_symbol_objects(db: Session = None) -> List[Symbol]:
    own_db = db is None
    if own_db:
        db = SessionLocal()
    try:
        return db.query(Symbol).filter(Symbol.is_active == True).order_by(Symbol.symbol).all()
    finally:
        if own_db:
            db.close()


def get_symbol(symbol: str, db: Session = None) -> Optional[Symbol]:
    own_db = db is None
    if own_db:
        db = SessionLocal()
    try:
        return db.query(Symbol).filter(Symbol.symbol == symbol.upper()).first()
    finally:
        if own_db:
            db.close()


def seed_initial_symbols():
    db = SessionLocal()
    try:
        if db.query(Symbol).count() > 0:
            logger.info("Symbols table already seeded. Skipping.")
            return
        logger.info(f"Seeding {len(NSE_TOP_100_SYMBOLS)} initial symbols...")
        for sym in NSE_TOP_100_SYMBOLS:
            db.add(Symbol(symbol=sym, exchange="NSE", is_active=True,
                          created_at=datetime.utcnow(), last_updated=datetime.utcnow()))
        db.commit()
        logger.info("Symbols seeded.")
    except Exception as e:
        db.rollback()
        logger.error(f"Seed failed: {e}")
        raise
    finally:
        db.close()


def add_symbol(symbol: str, exchange: str = "NSE", name: str = None,
               sector: str = None, db: Session = None) -> Symbol:
    symbol = symbol.upper().strip()
    exchange = exchange.upper().strip()
    if exchange not in SUPPORTED_EXCHANGES:
        raise ValueError(f"Exchange '{exchange}' not supported. Use: {SUPPORTED_EXCHANGES}")
    own_db = db is None
    if own_db:
        db = SessionLocal()
    try:
        existing = db.query(Symbol).filter(Symbol.symbol == symbol).first()
        if existing:
            if existing.is_active:
                raise ValueError(f"Symbol '{symbol}' is already being tracked.")
            existing.is_active = True
            existing.exchange = exchange
            existing.last_updated = datetime.utcnow()
            if name:
                existing.name = name
            if sector:
                existing.sector = sector
            db.commit()
            db.refresh(existing)
            return existing
        sym_obj = Symbol(symbol=symbol, exchange=exchange, name=name, sector=sector,
                         is_active=True, created_at=datetime.utcnow(), last_updated=datetime.utcnow())
        db.add(sym_obj)
        db.commit()
        db.refresh(sym_obj)
        logger.info(f"Added symbol: {symbol}")
        return sym_obj
    except ValueError:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"add_symbol failed: {e}")
        raise
    finally:
        if own_db:
            db.close()


def remove_symbol(symbol: str, db: Session = None) -> bool:
    symbol = symbol.upper().strip()
    own_db = db is None
    if own_db:
        db = SessionLocal()
    try:
        sym_obj = db.query(Symbol).filter(Symbol.symbol == symbol).first()
        if not sym_obj:
            return False
        sym_obj.is_active = False
        sym_obj.last_updated = datetime.utcnow()
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"remove_symbol failed: {e}")
        raise
    finally:
        if own_db:
            db.close()


def update_symbol_token(symbol: str, instrument_token: int, name: str = None, db: Session = None):
    own_db = db is None
    if own_db:
        db = SessionLocal()
    try:
        sym_obj = db.query(Symbol).filter(Symbol.symbol == symbol).first()
        if sym_obj:
            sym_obj.instrument_token = instrument_token
            sym_obj.last_updated = datetime.utcnow()
            if name:
                sym_obj.name = name
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"update_symbol_token failed: {e}")
    finally:
        if own_db:
            db.close()
