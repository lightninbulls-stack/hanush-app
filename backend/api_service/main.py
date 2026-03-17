"""
BullsEye Quant API — fully async
- symbol_registry functions are all async and need AsyncSession
- market_data queries (get_candles etc.) are async → use AsyncSession directly
- Backfill is async natively (run_full_backfill_async)
- Scheduler uses AsyncIOScheduler
- KiteTicker uses threaded=True (twisted in own thread)
"""

import asyncio
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

import pytz
from fastapi import (
    FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect,
    Depends, Query, BackgroundTasks
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from db import engine, get_db, get_async_db, AsyncSessionLocal, Base
import models  # noqa: registers User + all market tables on Base
from models.market_data import TIMEFRAME_MODEL_MAP, Symbol, BackfillJob
from kite_service.auth import kite_auth
from kite_service.instrument_manager import instrument_manager
from market_data.backfill import run_full_backfill_async as run_full_backfill, \
                                  refresh_recent_1min_async as refresh_recent_1min, \
                                  refresh_recent_all_async  as refresh_recent_all
from market_data.query import (
    get_candles, get_latest_price, get_multi_symbol_latest,
    get_data_stats, get_available_range
)
from market_data.symbol_registry import (
    seed_initial_symbols, get_active_symbols, get_active_symbol_objects,
    add_symbol, remove_symbol, get_symbol
)
from websocket_service.ticker import ticker_service
from websocket_service.manager import ws_manager
from scheduler import market_scheduler
from shared.models import StockListResponse, HistoricalData, StockInfo
from fetch_service.main import DataService, fetch_from_google_sheets, fetch_historical_data, fetch_stock_info
from api_service import auth_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")
data_service = DataService()

# Thread pool for blocking sync functions (market_data queries, yfinance, kite sync calls)
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="bullseye")


async def _run_in_thread(func, *args, **kwargs):
    """Run a blocking sync function in thread pool without blocking the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, lambda: func(*args, **kwargs))


# ─────────────────────────────────────────────────────────────────────────────
# LIFESPAN
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Application startup ===")

    # Create DB tables (sync call → thread)
    await _run_in_thread(Base.metadata.create_all, engine)
    logger.info("DB tables verified")

    # Seed symbols — async, needs AsyncSession
    async with AsyncSessionLocal() as db:
        await seed_initial_symbols(db)

    # Wire live tick → WebSocket broadcast (fully async via asyncio.create_task)
    def on_tick(symbol: str, tick: dict):
        ws_manager.broadcast_tick_threadsafe(
            symbol, tick.get("last_price"),
            tick.get("volume_traded", 0),
            tick.get("exchange_timestamp"),
        )
    ticker_service.on_tick_callback = on_tick

    # ── Kite data pipeline (fully automatic) ────────────────────────────────
    if kite_auth.is_authenticated():
        logger.info("Kite authenticated — starting full data pipeline...")

        # Step 1: Load instrument tokens (needed before backfill and ticker)
        await instrument_manager.load_instruments()

        # Step 2: Refresh recent data for ALL timeframes synchronously
        # This fills any gap since last deploy (today's candles, last 3 days)
        # Must complete BEFORE ticker starts so no duplicate candles
        logger.info("Refreshing recent data (last 3 days)...")
        await refresh_recent_all()
        logger.info("Recent data refresh complete — starting ticker...")

        # Step 3: Start live WebSocket ticker (streams real-time ticks)
        await ticker_service.start()

        # Step 4: Full historical backfill in background (non-blocking)
        # Does not re-fetch recent data already loaded in Step 2
        asyncio.create_task(
            run_full_backfill(["1day", "1week", "1month", "1hour", "15min", "5min"])
        )
        logger.info("Historical backfill started in background")
    else:
        logger.warning("Kite not authenticated. Visit /kite/login to authenticate.")

    market_scheduler.start()

    yield  # ── app is running ──

    logger.info("Shutting down...")
    await ticker_service.stop()
    market_scheduler.stop()
    _executor.shutdown(wait=False)


# ─────────────────────────────────────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="BullsEye Quant API", version="2.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN / HEALTH
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def admin_dashboard():
    from api_service.admin_dashboard import ADMIN_DASHBOARD_HTML
    return HTMLResponse(content=ADMIN_DASHBOARD_HTML)


@app.get("/healthz", tags=["admin"])
async def health_check():
    return {
        "status": "ok",
        "ticker": ticker_service.is_running(),
        "kite_auth": kite_auth.is_authenticated(),
        "ts": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# KITE AUTH
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/kite/login", tags=["kite-auth"])
async def kite_login():
    return RedirectResponse(url=kite_auth.get_login_url())


@app.get("/kite/callback", tags=["kite-auth"])
async def kite_callback(request_token: str, background_tasks: BackgroundTasks):
    try:
        await _run_in_thread(kite_auth.generate_session, request_token)
        background_tasks.add_task(_post_auth_startup)
        return {"status": "ok", "message": "Kite authenticated. Data pipeline starting..."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")


async def _post_auth_startup():
    await instrument_manager.load_instruments()
    await refresh_recent_all()
    if not ticker_service.is_running():
        await ticker_service.start()
    asyncio.create_task(
        run_full_backfill(["1day", "1week", "1month", "1hour", "15min", "5min"])
    )




async def _auto_add_and_backfill(symbol: str):
    """
    If symbol is not tracked but exists in Zerodha instruments,
    auto-add it and trigger backfill. Called lazily on first data request.
    """
    try:
        token = instrument_manager._all_instruments.get(symbol.upper())
        if not token:
            logger.warning(f"Auto-add skipped: {symbol} not in Zerodha instrument list")
            return False
        async with AsyncSessionLocal() as db:
            existing = await get_symbol(symbol, db)
            if existing and existing.is_active:
                return True  # already tracked
            await add_symbol(symbol, "NSE", db=db)
        await instrument_manager.add_symbol_to_tracking(symbol)
        await ticker_service.resubscribe()
        asyncio.create_task(run_full_backfill(
            ["1day", "1week", "1month", "1hour", "15min", "5min"], [symbol]
        ))
        logger.info(f"Auto-added and backfilling: {symbol}")
        return True
    except Exception as e:
        logger.warning(f"Auto-add failed for {symbol}: {e}")
        return False

@app.get("/kite/status", tags=["kite-auth"])
async def kite_status():
    return {
        "authenticated": kite_auth.is_authenticated(),
        "ticker_running": ticker_service.is_running(),
        "instruments_loaded": instrument_manager.is_loaded(),
        "instrument_count": len(instrument_manager.get_token_map()),
        "ws_clients": ws_manager.get_connection_count(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# MARKET DATA  (sync DB queries → thread pool, sync get_db)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/chart/{symbol}", tags=["market-data"])
async def get_chart_data(
    symbol: str,
    timeframe: str = Query("1day"),
    limit: Optional[int] = Query(None),
    from_ts: Optional[int] = Query(None),
    to_ts: Optional[int] = Query(None),
    include_partial: bool = Query(True),
    db: AsyncSession = Depends(get_async_db),
):
    symbol = symbol.upper()
    if timeframe not in TIMEFRAME_MODEL_MAP:
        raise HTTPException(status_code=400,
            detail=f"Invalid timeframe. Use: {list(TIMEFRAME_MODEL_MAP.keys())}")
    from_dt = datetime.fromtimestamp(from_ts) if from_ts else None
    to_dt   = datetime.fromtimestamp(to_ts)   if to_ts   else None
    candles = await get_candles(db, symbol, timeframe, from_dt, to_dt, limit, include_partial)
    if not candles and kite_auth.is_authenticated():
        added = await _auto_add_and_backfill(symbol)
        if added:
            logger.info(f"Auto-added {symbol} — backfill running, data available shortly")
    return {"symbol": symbol, "timeframe": timeframe, "data": candles, "count": len(candles)}


@app.get("/api/price/{symbol}", tags=["market-data"])
async def get_price(symbol: str, db: AsyncSession = Depends(get_async_db)):
    price = await get_latest_price(db, symbol.upper())
    if not price:
        raise HTTPException(status_code=404, detail="No price data found")
    return price


@app.post("/api/prices", tags=["market-data"])
async def get_prices_bulk(symbols: List[str], db: AsyncSession = Depends(get_async_db)):
    return await get_multi_symbol_latest(db, [s.upper() for s in symbols])


@app.get("/api/symbols", tags=["market-data"])
async def get_symbols_list(db: AsyncSession = Depends(get_async_db)):
    syms = await get_active_symbol_objects(db)
    return {
        "symbols": [
            {"symbol": s.symbol, "exchange": s.exchange, "name": s.name,
             "sector": s.sector, "instrument_token": s.instrument_token}
            for s in syms
        ],
        "count": len(syms),
    }


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET
# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    client_id = str(uuid.uuid4())
    await ws_manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "subscribe":
                symbols    = [s.upper() for s in data.get("symbols", [])]
                timeframes = data.get("timeframes", [])
                await ws_manager.subscribe(client_id, symbols, timeframes)
                await websocket.send_json({
                    "type": "subscribed", "symbols": symbols, "timeframes": timeframes
                })
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await ws_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WS error {client_id}: {e}")
        await ws_manager.disconnect(client_id)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — STATS / BACKFILL  (sync queries → thread pool)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/admin/stats", tags=["admin"])
async def get_stats(db: AsyncSession = Depends(get_async_db)):
    stats = await get_data_stats(db)
    symbols_tracked = len(await get_active_symbols(db))
    return {
        "tables": stats,
        "kite_authenticated": kite_auth.is_authenticated(),
        "ticker_running": ticker_service.is_running(),
        "ws_clients_connected": ws_manager.get_connection_count(),
        "symbols_tracked": symbols_tracked,
        "scheduled_jobs": market_scheduler.get_jobs(),
    }


@app.post("/admin/refresh-recent", tags=["admin"])
async def trigger_refresh_recent(
    days: int = 3,
    symbols: Optional[List[str]] = None,
    background_tasks: BackgroundTasks = None,
):
    """Refresh recent N days of data for all timeframes. Use after market hours or on gap."""
    if not kite_auth.is_authenticated():
        raise HTTPException(status_code=401, detail="Kite not authenticated")
    background_tasks.add_task(refresh_recent_all, symbols, days)
    return {"status": "started", "message": f"Refreshing last {days} days in background"}


@app.post("/admin/backfill", tags=["admin"])
async def trigger_backfill(
    timeframes: Optional[List[str]] = None,
    symbols: Optional[List[str]] = None,
    force: bool = False,
    background_tasks: BackgroundTasks = None,
):
    background_tasks.add_task(run_full_backfill, timeframes, symbols, force)
    return {"status": "started", "message": "Backfill running in background"}


@app.get("/admin/backfill/status", tags=["admin"])
async def backfill_status(db: AsyncSession = Depends(get_async_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(BackfillJob).order_by(BackfillJob.symbol, BackfillJob.timeframe)
    )
    jobs = result.scalars().all()
    summary: dict = {}
    for j in jobs:
        summary[j.status] = summary.get(j.status, 0) + 1
    return {
        "summary": summary,
        "jobs": [
            {"symbol": j.symbol, "timeframe": j.timeframe, "status": j.status,
             "records": j.records_inserted, "error": j.error_msg,
             "completed_at": j.completed_at.isoformat() if j.completed_at else None}
            for j in jobs
        ],
        "total": len(jobs),
    }


@app.post("/admin/reload-instruments", tags=["admin"])
async def reload_instruments():
    if not kite_auth.is_authenticated():
        raise HTTPException(status_code=401, detail="Kite not authenticated")
    success = await instrument_manager.load_instruments(force_refresh=True)
    return {"status": "ok" if success else "failed", "count": len(instrument_manager.get_token_map())}




@app.get("/admin/symbols/search", tags=["symbol-management"])
async def search_symbol(q: str = Query(..., description="Partial symbol or company name")):
    """
    Search Zerodha instrument list for matching symbols.
    Use this to find the exact NSE tradingsymbol before adding via POST /admin/symbols.
    """
    if not instrument_manager._all_instruments:
        raise HTTPException(status_code=503,
            detail="Instrument list not loaded. Call /admin/reload-instruments first.")
    q_upper = q.upper()
    matches = [
        sym for sym in instrument_manager._all_instruments
        if q_upper in sym
    ]
    return {
        "query": q,
        "matches": sorted(matches)[:20],
        "count": len(matches),
        "hint": "Use the exact symbol from matches[] in POST /admin/symbols"
    }

# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — SYMBOL MANAGEMENT  (async symbol_registry → AsyncSession)
# ─────────────────────────────────────────────────────────────────────────────
class AddSymbolRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"
    name: Optional[str] = None
    sector: Optional[str] = None
    backfill: bool = True
    timeframes: Optional[List[str]] = None


@app.post("/admin/symbols", tags=["symbol-management"])
async def add_new_symbol(req: AddSymbolRequest, background_tasks: BackgroundTasks,
                         db: AsyncSession = Depends(get_async_db)):
    symbol = req.symbol.upper().strip()
    try:
        await add_symbol(symbol, req.exchange, req.name, req.sector, db=db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    token = await instrument_manager.add_symbol_to_tracking(symbol)
    if not token:
        # Find close matches to help user
        suggestions = []
        if instrument_manager._all_instruments:
            suggestions = sorted([
                s for s in instrument_manager._all_instruments
                if symbol[:4] in s or s[:4] in symbol
            ])[:10]
        raise HTTPException(status_code=422, detail={
            "error": f"'{symbol}' not found in Zerodha NSE instruments.",
            "suggestions": suggestions,
            "hint": f"Try GET /admin/symbols/search?q={symbol[:4]} to find the exact name"
        })
    await ticker_service.resubscribe()

    if req.backfill:
        tfs = req.timeframes or ["1day", "1week", "1month", "1hour", "15min", "5min", "1min"]
        background_tasks.add_task(run_full_backfill, tfs, [symbol])
        bf_msg = f"Backfilling {len(tfs)} timeframes in background"
    else:
        bf_msg = "Skipped"

    return {"status": "ok", "symbol": symbol, "instrument_token": token,
            "ticker_resubscribed": ticker_service.is_running(), "backfill": bf_msg}


@app.delete("/admin/symbols/{symbol}", tags=["symbol-management"])
async def deactivate_symbol(symbol: str, db: AsyncSession = Depends(get_async_db)):
    symbol = symbol.upper()
    instrument_manager.remove_symbol_from_tracking(symbol)
    await ticker_service.resubscribe()
    success = await remove_symbol(symbol, db)
    if not success:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")
    return {"status": "ok", "symbol": symbol, "message": "Deactivated. Historical data preserved."}


@app.post("/admin/symbols/{symbol}/reactivate", tags=["symbol-management"])
async def reactivate_symbol(symbol: str, background_tasks: BackgroundTasks,
                            backfill: bool = True, db: AsyncSession = Depends(get_async_db)):
    symbol = symbol.upper()
    try:
        await add_symbol(symbol, db=db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    token = await instrument_manager.add_symbol_to_tracking(symbol)
    await ticker_service.resubscribe()
    if backfill:
        background_tasks.add_task(run_full_backfill, None, [symbol], False)
    return {"status": "ok", "symbol": symbol, "instrument_token": token}


@app.get("/admin/symbols", tags=["symbol-management"])
async def list_all_symbols(include_inactive: bool = False,
                           db: AsyncSession = Depends(get_async_db)):
    from sqlalchemy import select
    stmt = select(Symbol)
    if not include_inactive:
        stmt = stmt.where(Symbol.is_active == True)
    stmt = stmt.order_by(Symbol.symbol)
    result = await db.execute(stmt)
    syms = result.scalars().all()
    return {
        "symbols": [
            {"symbol": s.symbol, "exchange": s.exchange, "name": s.name,
             "sector": s.sector, "instrument_token": s.instrument_token,
             "is_active": s.is_active,
             "created_at": s.created_at.isoformat() if s.created_at else None,
             "last_updated": s.last_updated.isoformat() if s.last_updated else None}
            for s in syms
        ],
        "count": len(syms),
    }


@app.get("/admin/symbols/{symbol}", tags=["symbol-management"])
async def get_symbol_detail(symbol: str, db: AsyncSession = Depends(get_async_db)):
    symbol  = symbol.upper()
    sym_obj = await get_symbol(symbol, db)
    if not sym_obj:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")

    ranges = {}
    for tf in TIMEFRAME_MODEL_MAP:
        r = await get_available_range(db, symbol, tf)
        ranges[tf] = {"from": r[0].isoformat(), "to": r[1].isoformat()} if r else None

    return {
        "symbol": sym_obj.symbol, "exchange": sym_obj.exchange, "name": sym_obj.name,
        "sector": sym_obj.sector, "instrument_token": sym_obj.instrument_token,
        "is_active": sym_obj.is_active,
        "in_live_feed": symbol in instrument_manager.get_token_map(),
        "data_ranges": ranges,
    }


@app.delete("/admin/symbols/{symbol}/data", tags=["symbol-management"])
async def delete_symbol_data(symbol: str, db: AsyncSession = Depends(get_async_db)):
    symbol  = symbol.upper()
    sym_obj = await get_symbol(symbol, db)
    if sym_obj and sym_obj.is_active:
        raise HTTPException(status_code=409,
            detail=f"Deactivate '{symbol}' first: DELETE /admin/symbols/{symbol}")

    total = 0
    for tf, Model in TIMEFRAME_MODEL_MAP.items():
        result = await db.execute(
            text(f"DELETE FROM {Model.__tablename__} WHERE symbol = :sym"), {"sym": symbol})
        total += result.rowcount
    await db.execute(text("DELETE FROM backfill_jobs WHERE symbol = :sym"), {"sym": symbol})
    if sym_obj:
        await db.delete(sym_obj)
    await db.commit()
    return {"status": "ok", "symbol": symbol, "rows_deleted": total}


# ─────────────────────────────────────────────────────────────────────────────
# ORIGINAL ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/stocks/{category}", response_model=StockListResponse)
async def get_stocks(category: str):
    logger.info(f"Fetching stocks for category: {category}")
    try:
        cached = await data_service.get_cached_stock_list(category)
        if cached:
            return StockListResponse(category=category, stocks=cached)
        stocks = await fetch_from_google_sheets(category)
        if stocks:
            try:
                await data_service.cache_stock_list(category, stocks)
            except Exception:
                pass
            return StockListResponse(category=category, stocks=stocks)
        return StockListResponse(category=category, stocks=[])
    except Exception as e:
        logger.critical(f"Critical failure in get_stocks: {e}", exc_info=True)
        return StockListResponse(category=category, stocks=[])


@app.get("/stocks/history/{symbol}", response_model=List[HistoricalData])
async def get_history(symbol: str, interval: str = "1d", db: AsyncSession = Depends(get_async_db)):
    logger.info(f"History: {symbol}, interval={interval}")
    interval_map = {
        "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1hour",
        "1d": "1day", "1wk": "1week", "1mo": "1month",
    }
    timeframe = interval_map.get(interval)
    sym       = symbol.upper().replace(".NS", "")

    if timeframe:
        try:
            db_candles = await get_candles(db, sym, timeframe)
            if db_candles:
                return [HistoricalData(time=c["time"], open=c["open"], high=c["high"],
                                       low=c["low"], close=c["close"], volume=c["volume"])
                        for c in db_candles]
            # No DB data — auto-add symbol and trigger backfill if it exists in Zerodha
            if kite_auth.is_authenticated():
                added = await _auto_add_and_backfill(sym)
                if added:
                    logger.info(f"Auto-added {sym} — backfill triggered, returning yfinance data for now")
        except Exception as e:
            logger.warning(f"DB chart fetch failed {sym}/{timeframe}: {e}")

    try:
        history = await fetch_historical_data(symbol, interval)
        return history or []
    except Exception as e:
        logger.warning(f"yfinance fallback failed for {symbol}: {e}")
        return []


@app.get("/stocks/info/{symbol}", response_model=StockInfo)
async def get_info(symbol: str, db: AsyncSession = Depends(get_async_db)):
    logger.info(f"Info: {symbol}")
    try:
        sym      = symbol.upper().replace(".NS", "")
        db_price = await get_latest_price(db, sym)
        cached   = None  # get_cached_stock_info removed in new DataService
        if cached:
            if db_price:
                cached["price"] = db_price["price"]
            return cached
        try:
            info = await fetch_stock_info(symbol)
        except Exception as e:
            logger.warning(f"yfinance fetch failed for {symbol}: {e}")
            info = None

        if info:
            if db_price:
                info["price"] = db_price["price"]
            return info

        # Return minimal info from DB price if yfinance unavailable
        if db_price:
            return {"symbol": sym, "name": None, "sector": None, "market_cap": None,
                    "pe_ratio": None, "high_52w": None, "low_52w": None,
                    "summary": None, "price": db_price["price"], "change_pct": None}

        raise HTTPException(status_code=404, detail=f"Stock info not found for {symbol}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_service.main:app", host="0.0.0.0",
                port=int(os.environ.get("PORT", 8000)), reload=False)