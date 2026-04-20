from __future__ import annotations

import logging
import os
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from api_service import auth_routes
from db import Base, SessionLocal, engine
from fetch_service.main import (
    DataService,
    fetch_from_google_sheets,
    fetch_historical_data,
    fetch_stock_info,
)
from models import user  # noqa: F401  # required before create_all
from shared.intraday_spreads_state import spread_state
from shared.models import HistoricalData, StockInfo, StockListResponse
from strategy_runner import is_strategy_running, start_strategy_background

# Adjust this import only if your strategy file lives somewhere else.
from nifty_bull_call_spread_signal import main as bull_call_strategy_main


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trading Bible API")

app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten later for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

data_service = DataService()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def startup_event() -> None:
    logger.info("✅ FastAPI app startup triggered.")

    # Auto-start strategy on backend boot.
    started = start_strategy_background(bull_call_strategy_main)

    if started:
        logger.info("✅ Bull call strategy launched from FastAPI startup.")
    else:
        logger.info("⚠️ Bull call strategy already running.")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Global error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "error": str(exc),
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "strategy_running": is_strategy_running(),
        "service": "api_service",
    }


@app.post("/api/strategy/start")
def start_strategy():
    started = start_strategy_background(bull_call_strategy_main)
    return {
        "started": started,
        "strategy_running": is_strategy_running(),
        "message": "Strategy started." if started else "Strategy already running.",
    }


@app.get("/api/strategy/status")
def strategy_status():
    return {
        "strategy_running": is_strategy_running(),
    }


@app.get("/api/intraday-spreads/all")
def get_all_intraday_spreads():
    return spread_state.get_all()


@app.get("/api/intraday-spreads/{strategy_name}")
def get_one_intraday_spread(strategy_name: str):
    payload = spread_state.get_one(strategy_name)
    if payload is None:
        raise HTTPException(status_code=404, detail="Strategy state not found")
    return payload


@app.get("/debug/users")
def list_users(db: Session = Depends(get_db)):
    from models.user import User

    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email} for u in users]


@app.get("/debug/migrations")
def check_migrations():
    from sqlalchemy import text

    with engine.connect() as conn:
        version = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
        columns = conn.execute(
            text(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'users'
                """
            )
        ).fetchall()

    return {
        "alembic_version": version[0] if version else None,
        "users_columns": [{"name": c[0], "type": c[1]} for c in columns],
    }


@app.get("/stocks/{category}", response_model=StockListResponse)
async def get_stocks(category: str):
    logger.info("Fetching stocks for category: %s", category)

    try:
        try:
            cached_data = data_service.get_cached_stock_list(category)
            if cached_data:
                logger.info("Returning cached data for %s", category)
                return StockListResponse(category=category, stocks=cached_data)
        except Exception as exc:
            logger.warning("Cache miss or error: %s", exc)

        try:
            stocks = fetch_from_google_sheets(category)
            if stocks:
                try:
                    data_service.cache_stock_list(category, stocks)
                except Exception:
                    pass
                return StockListResponse(category=category, stocks=stocks)
        except Exception as exc:
            logger.error("Fetch failed: %s", exc)

        logger.warning("No data found for category: %s in Excel or Google Sheets.", category)
        return StockListResponse(category=category, stocks=[])

    except Exception as exc:
        logger.critical("Critical failure in get_stocks: %s", exc, exc_info=True)
        return StockListResponse(category=category, stocks=[])


@app.get("/stocks/history/{symbol}", response_model=List[HistoricalData])
async def get_history(symbol: str, interval: str = "1d"):
    logger.info("Fetching history for symbol: %s, interval: %s", symbol, interval)

    try:
        cached_data = data_service.get_cached_historical_data(symbol, interval)
        if cached_data:
            return cached_data

        history = fetch_historical_data(symbol, interval)
        if history:
            data_service.cache_historical_data(symbol, interval, history)
            return history

        return []

    except Exception as exc:
        logger.error("Error in get_history: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/stocks/info/{symbol}", response_model=StockInfo)
async def get_info(symbol: str):
    logger.info("Fetching info for: %s", symbol)

    try:
        cached_info = data_service.get_cached_stock_info(symbol)
        if cached_info:
            return cached_info

        info = fetch_stock_info(symbol)
        if info:
            data_service.cache_stock_info(symbol, info)
            return info

        raise HTTPException(status_code=404, detail="Stock info not found")

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in get_info: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
