"""
BullsEye Quant API — asyncio version
Keeps all original endpoints (stocks/history/info) and adds:
- Zerodha Kite data pipeline (historical backfill + live WebSocket)
- Dynamic symbol management (/admin/symbols)
- Real-time WebSocket feed (/ws/live)
- User auth (/auth/register, /auth/login)
- Admin dashboard (/admin)
- Health check (/healthz)
"""

import asyncio
import logging
import os
import uuid
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
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import async_engine, get_async_db, Base
import models  # noqa
from models.market_data import TIMEFRAME_MODEL_MAP, Symbol, BackfillJob
from kite_service.auth import kite_auth
from kite_service.instrument_manager import instrument_manager
from market_data.backfill import run_full_backfill_async, refresh_recent_1min_async
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Application startup ===")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("DB tables verified")
    await asyncio.to_thread(seed_initial_symbols)
    ws_manager.set_event_loop(asyncio.get_event_loop())

    def on_tick(symbol: str, tick: dict):
        ws_manager.broadcast_tick_threadsafe(
            symbol, tick.get("last_price"), tick.get("volume_traded", 0),
            tick.get("exchange_timestamp"),
        )
    ticker_service.on_tick_callback = on_tick

    if kite_auth.is_authenticated():
        logger.info("Kite authenticated — loading instruments and starting ticker...")
        await asyncio.to_thread(instrument_manager.load_instruments)
        await asyncio.to_thread(ticker_service.start)
        asyncio.create_task(run_full_backfill_async(
            timeframes=["1day", "1week", "1month", "1hour", "15min", "5min"]
        ))
    else:
        logger.warning("Kite not authenticated. Visit /kite/login to start the data pipeline.")

    market_scheduler.start()
    yield
    logger.info("Shutting down...")
    ticker_service.stop()
    market_scheduler.stop()


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
    return JSONResponse(status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"})

# ─── Admin & Kite endpoints ───────────────────────────────────────────────

@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def admin_dashboard():
    from api_service.admin_dashboard import ADMIN_DASHBOARD_HTML
    return HTMLResponse(content=ADMIN_DASHBOARD_HTML)

@app.get("/healthz", tags=["admin"])
async def health_check():
    return {"status": "ok", "ticker": ticker_service.is_running(),
            "kite_auth": kite_auth.is_authenticated(), "ts": datetime.utcnow().isoformat()}

@app.get("/kite/login", tags=["kite-auth"])
async def kite_login():
    return RedirectResponse(url=kite_auth.get_login_url())

@app.get("/kite/callback", tags=["kite-auth"])
async def kite_callback(request_token: str):
    try:
        kite_auth.generate_session(request_token)
        asyncio.create_task(_post_auth_startup())
        return {"status": "ok", "message": "Kite authenticated. Data pipeline starting..."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")

async def _post_auth_startup():
    await asyncio.to_thread(instrument_manager.load_instruments)
    if not ticker_service.is_running():
        await asyncio.to_thread(ticker_service.start)
    asyncio.create_task(refresh_recent_1min_async())

@app.get("/kite/status", tags=["kite-auth"])
async def kite_status():
    return {"authenticated": kite_auth.is_authenticated(), "ticker_running": ticker_service.is_running(),
            "instruments_loaded": instrument_manager.is_loaded(),
            "instrument_count": len(instrument_manager.get_token_map()),
            "ws_clients": ws_manager.get_connection_count()}

# ─── Market data endpoints ───────────────────────────────────────────────

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
        raise HTTPException(status_code=400, detail=f"Invalid timeframe. Use: {list(TIMEFRAME_MODEL_MAP.keys())}")
    from_dt = datetime.fromtimestamp(from_ts) if from_ts else None
    to_dt = datetime.fromtimestamp(to_ts) if to_ts else None
    candles = await get_candles(db, symbol, timeframe, from_dt, to_dt, limit, include_partial)
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
    return {"symbols": [{"symbol": s.symbol, "exchange": s.exchange,
                          "name": s.name, "sector": s.sector,
                          "instrument_token": s.instrument_token} for s in syms],
            "count": len(syms)}

# ─── WebSocket feed ──────────────────────────────────────────────────────

@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    client_id = str(uuid.uuid4())
    await ws_manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "subscribe":
                symbols = [s.upper() for s in data.get("symbols", [])]
                await ws_manager.subscribe(client_id, symbols)
                await websocket.send_json({"type": "subscribed", "symbols": symbols})
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await ws_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WS error {client_id}: {e}")
        await ws_manager.disconnect(client_id)

# ─── Stocks endpoints (unchanged but async) ──────────────────────────────

@app.get("/stocks/{category}", response_model=StockListResponse)
async def get_stocks(category: str):
    logger.info(f"Fetching stocks for category: {category}")
    try:
        cached = data_service.get_cached_stock_list(category)
        if cached:
            return StockListResponse(category=category, stocks=cached)
        stocks = await asyncio.to_thread(fetch_from_google_sheets, category)
        if stocks:
            try:
                data_service.cache_stock_list(category, stocks)
