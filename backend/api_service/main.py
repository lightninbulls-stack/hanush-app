from __future__ import annotations

import logging
import os
import threading
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from api_service import auth_routes, portfolio_routes, intraday_spreads_routes
from bullcallspread.nifty_bull_call_signal import main as bull_call_main
from bearputspread.nifty_bear_put_signal import main as bear_put_main
from bearputspread.sensex_bear_put_signal import main as bear_put_sensex_main
from db import Base, SessionLocal, engine
from fetch_service.main import (
    DataService,
    fetch_from_google_sheets,
    fetch_historical_data,
    fetch_stock_info,
)
from shared.models import HistoricalData, StockInfo, StockListResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trading Bible API")
data_service = DataService()

# =========================================================
# ================= Strategy Threads ======================
# =========================================================
_bull_call_strategy_thread: threading.Thread | None = None
_bull_call_strategy_lock = threading.Lock()

_bear_put_strategy_thread: threading.Thread | None = None
_bear_put_strategy_lock = threading.Lock()

_bear_put_sensex_strategy_thread: threading.Thread | None = None
_bear_put_sensex_strategy_lock = threading.Lock()


def start_bull_call_strategy() -> bool:
    global _bull_call_strategy_thread

    with _bull_call_strategy_lock:
        if (
            _bull_call_strategy_thread is not None
            and _bull_call_strategy_thread.is_alive()
        ):
            logger.info("⚠️ Bull Call strategy thread already running.")
            return False

        def run() -> None:
            try:
                logger.info("✅ Bull Call strategy thread started.")
                bull_call_main()
            except Exception as exc:
                logger.error("❌ Bull call strategy crashed: %s", exc, exc_info=True)
            finally:
                logger.info("ℹ️ Bull Call strategy thread finished.")

        _bull_call_strategy_thread = threading.Thread(
            target=run,
            daemon=True,
            name="bull-call-strategy-thread",
        )
        _bull_call_strategy_thread.start()
        return True


def start_bear_put_strategy() -> bool:
    global _bear_put_strategy_thread

    with _bear_put_strategy_lock:
        if (
            _bear_put_strategy_thread is not None
            and _bear_put_strategy_thread.is_alive()
        ):
            logger.info("⚠️ Bear Put strategy thread already running.")
            return False

        def run() -> None:
            try:
                logger.info("✅ Bear Put strategy thread started.")
                bear_put_main()
            except Exception as exc:
                logger.error("❌ Bear put strategy crashed: %s", exc, exc_info=True)
            finally:
                logger.info("ℹ️ Bear Put strategy thread finished.")

        _bear_put_strategy_thread = threading.Thread(
            target=run,
            daemon=True,
            name="bear-put-strategy-thread",
        )
        _bear_put_strategy_thread.start()
        return True


def start_bear_put_sensex_strategy() -> bool:
    global _bear_put_sensex_strategy_thread

    with _bear_put_sensex_strategy_lock:
        if (
            _bear_put_sensex_strategy_thread is not None
            and _bear_put_sensex_strategy_thread.is_alive()
        ):
            logger.info("⚠️ Bear Put SENSEX strategy thread already running.")
            return False

        def run() -> None:
            try:
                logger.info("✅ Bear Put SENSEX strategy thread started.")
                bear_put_sensex_main()
            except Exception as exc:
                logger.error("❌ Bear Put SENSEX strategy crashed: %s", exc, exc_info=True)
            finally:
                logger.info("ℹ️ Bear Put SENSEX strategy thread finished.")

        _bear_put_sensex_strategy_thread = threading.Thread(
            target=run,
            daemon=True,
            name="bear-put-sensex-strategy-thread",
        )
        _bear_put_sensex_strategy_thread.start()
        return True


def is_strategy_running() -> bool:
    global _bull_call_strategy_thread
    return (
        _bull_call_strategy_thread is not None
        and _bull_call_strategy_thread.is_alive()
    )


def is_bear_put_strategy_running() -> bool:
    global _bear_put_strategy_thread
    return (
        _bear_put_strategy_thread is not None
        and _bear_put_strategy_thread.is_alive()
    )


def is_bear_put_sensex_strategy_running() -> bool:
    global _bear_put_sensex_strategy_thread
    return (
        _bear_put_sensex_strategy_thread is not None
        and _bear_put_sensex_strategy_thread.is_alive()
    )


@app.on_event("startup")
def startup_event() -> None:
    logger.info("✅ FastAPI startup triggered.")

    bull_started = start_bull_call_strategy()
    if bull_started:
        logger.info("✅ Bull Call strategy launched from startup.")
    else:
        logger.info("⚠️ Bull Call strategy was already running.")

    bear_started = start_bear_put_strategy()
    if bear_started:
        logger.info("✅ Bear Put strategy launched from startup.")
    else:
        logger.info("⚠️ Bear Put strategy was already running.")

    bear_sensex_started = start_bear_put_sensex_strategy()
    if bear_sensex_started:
        logger.info("✅ Bear Put SENSEX strategy launched from startup.")
    else:
        logger.info("⚠️ Bear Put SENSEX strategy was already running.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])
app.include_router(portfolio_routes.router, prefix="/portfolio", tags=["portfolio"])
app.include_router(intraday_spreads_routes.router, prefix="/api", tags=["intraday_spreads"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Global error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


@app.get("/")
def root():
    return {"status": "ok", "message": "Trading Bible API is running"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "strategy_running": is_strategy_running(),
        "bull_call_strategy_running": is_strategy_running(),
        "bear_put_strategy_running": is_bear_put_strategy_running(),
        "bear_put_sensex_strategy_running": is_bear_put_sensex_strategy_running(),
    }


@app.post("/api/strategy/start")
def start_strategy():
    started = start_bull_call_strategy()
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


@app.post("/api/bear-put-strategy/start")
def start_bear_put():
    started = start_bear_put_strategy()
    return {
        "started": started,
        "strategy_running": is_bear_put_strategy_running(),
        "message": (
            "Bear put strategy started."
            if started
            else "Bear put strategy already running."
        ),
    }


@app.get("/api/bear-put-strategy/status")
def bear_put_strategy_status():
    return {
        "strategy_running": is_bear_put_strategy_running(),
    }


@app.post("/api/bear-put-sensex-strategy/start")
def start_bear_put_sensex():
    started = start_bear_put_sensex_strategy()
    return {
        "started": started,
        "strategy_running": is_bear_put_sensex_strategy_running(),
        "message": (
            "Bear put SENSEX strategy started."
            if started
            else "Bear put SENSEX strategy already running."
        ),
    }


@app.get("/api/bear-put-sensex-strategy/status")
def bear_put_sensex_strategy_status():
    return {
        "strategy_running": is_bear_put_sensex_strategy_running(),
    }


@app.get("/debug/users")
def list_users(db: Session = Depends(get_db)):
    from models.user import User

    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": getattr(u, "phone", None),
            "created_at": getattr(u, "created_at", None),
        }
        for u in users
    ]


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

        logger.warning("No data found for category: %s", category)
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

    except Exception as exc:
        logger.error("Error in get_info: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
