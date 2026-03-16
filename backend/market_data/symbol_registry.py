"""
DB-driven symbol management. The `symbols` table is the single source of truth.
`nse_top100.py` is used ONLY for the initial seed on first run.
"""

import logging
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from models.market_data import Symbol
from market_data.nse_top100 import NSE_TOP_100_SYMBOLS, SUPPORTED_EXCHANGES

logger = logging.getLogger(__name__)


async def get_active_symbols(db: AsyncSession) -> List[str]:
    stmt = select(Symbol.symbol).where(Symbol.is_active == True).order_by(Symbol.symbol)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return rows


async def get_active_symbol_objects(db: AsyncSession) -> List[Symbol]:
    stmt = select(Symbol).where(Symbol.is_active == True).order_by(Symbol.symbol)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_symbol(symbol: str, db: AsyncSession) -> Optional[Symbol]:
    stmt = select(Symbol).where(Symbol.symbol == symbol.upper())
    result = await db.execute(stmt)
    return result.scalars().first()


async def seed_initial_symbols(db: AsyncSession):
    try:
        count_stmt = select(func.count()).select_from(Symbol)
        count = (await db.execute(count_stmt)).scalar_one()
        if count > 0:
            logger.info("Symbols table already seeded. Skipping.")
            return
        logger.info(f"Seeding {len(NSE_TOP_100_SYMBOLS)} initial symbols...")
        for sym in NSE_TOP_100_SYMBOLS:
            db.add(Symbol(
                symbol=sym,
                exchange="NSE",
                is_active=True,
                created_at=datetime.utcnow(),
                last_updated=datetime.utcnow()
            ))
        await db.commit()
        logger.info("Symbols seeded.")
    except Exception as e:
        await db.rollback()
        logger.error(f"Seed failed: {e}")
        raise


async def add_symbol(symbol: str, exchange: str = "NSE", name: str = None,
                     sector: str = None, db: AsyncSession = None) -> Symbol:
    symbol = symbol.upper().strip()
    exchange = exchange.upper().strip()
    if exchange not in SUPPORTED_EXCHANGES:
        raise ValueError(f"Exchange '{exchange}' not supported. Use: {SUPPORTED_EXCHANGES}")
    try:
        stmt = select(Symbol).where(Symbol.symbol == symbol)
        result = await db.execute(stmt)
        existing = result.scalars().first()
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
            await db.commit()
            await db.refresh(existing)
            return existing
        sym_obj = Symbol(
            symbol=symbol,
            exchange=exchange,
            name=name,
            sector=sector,
            is_active=True,
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )
        db.add(sym_obj)
        await db.commit()
        await db.refresh(sym_obj)
        logger.info(f"Added symbol: {symbol}")
        return sym_obj
    except ValueError:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"add_symbol failed: {e}")
        raise


async def remove_symbol(symbol: str, db: AsyncSession) -> bool:
    symbol = symbol.upper().strip()
    try:
        stmt = select(Symbol).where(Symbol.symbol == symbol)
        result = await db.execute(stmt)
        sym_obj = result.scalars().first()
        if not sym_obj:
            return False
        sym_obj.is_active = False
        sym_obj.last_updated = datetime.utcnow()
        await db.commit()
        return True
    except Exception as e:
        await db.rollback()
        logger.error(f"remove_symbol failed: {e}")
        raise


async def update_symbol_token(symbol: str, instrument_token: int, name: str = None, db: AsyncSession = None):
    try:
        stmt = select(Symbol).where(Symbol.symbol == symbol)
        result = await db.execute(stmt)
        sym_obj = result.scalars().first()
        if sym_obj:
            sym_obj.instrument_token = instrument_token
            sym_obj.last_updated = datetime.utcnow()
            if name:
                sym_obj.name = name
            await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"update_symbol_token failed: {e}")
