import threading
from bullcallspread.nifty_bull_call_signal import main as bull_call_main
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import os
import logging

from api_service import auth_routes, portfolio_routes, intraday_spreads_routes
from shared.models import StockListResponse, HistoricalData, StockInfo
from fetch_service.main import (
    DataService,
    fetch_from_google_sheets,
    fetch_historical_data,
    fetch_stock_info,
)
from db import Base, engine, SessionLocal


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trading Bible API")

# =========================
# Middleware
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# =========================
# Routers
# =========================
app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])
app.include_router(portfolio_routes.router, prefix="/portfolio", tags=["portfolio"])
app.include_router(intraday_spreads_routes.router, prefix="/api", tags=["intraday_spreads"])


# =========================
# Database dependency
# =========================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# Global exception handler
# =========================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


data_service = DataService()


# =========================
# Utility / Health routes
# =========================
@app.get("/")
def root():
    return {"status": "ok", "message": "Trading Bible API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# =========================
# Debug routes
# =========================
@app.get("/debug/users")
def list_users(db: Session = Depends(get_db)):
    from models.user import User

    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "created_at": u.created_at,
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


# =========================
# Stock routes
# =========================
@app.get("/stocks/{category}", response_model=StockListResponse)
async def get_stocks(category: str):
    logger.info(f"Fetching stocks for category: {category}")
    try:
        try:
            cached_data = data_service.get_cached_stock_list(category)
            if cached_data:
                logger.info(f"Returning cached data for {category}")
                return StockListResponse(category=category, stocks=cached_data)
        except Exception as e:
            logger.warning(f"Cache miss or error: {e}")

        try:
            stocks = fetch_from_google_sheets(category)
            if stocks:
                try:
                    data_service.cache_stock_list(category, stocks)
                except Exception:
                    pass
                return StockListResponse(category=category, stocks=stocks)
        except Exception as e:
            logger.error(f"Fetch failed: {e}")

        logger.warning(f"No data found for category: {category}")
        return StockListResponse(category=category, stocks=[])

    except Exception as e:
        logger.critical(f"Critical failure in get_stocks: {e}", exc_info=True)
        return StockListResponse(category=category, stocks=[])


@app.get("/stocks/history/{symbol}", response_model=List[HistoricalData])
async def get_history(symbol: str, interval: str = "1d"):
    logger.info(f"Fetching history for symbol: {symbol}, interval: {interval}")
    try:
        cached_data = data_service.get_cached_historical_data(symbol, interval)
        if cached_data:
            return cached_data

        history = fetch_historical_data(symbol, interval)
        if history:
            data_service.cache_historical_data(symbol, interval, history)
            return history

        return []

    except Exception as e:
        logger.error(f"Error in get_history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stocks/info/{symbol}", response_model=StockInfo)
async def get_info(symbol: str):
    logger.info(f"Fetching info for: {symbol}")
    try:
        cached_info = data_service.get_cached_stock_info(symbol)
        if cached_info:
            return cached_info

        info = fetch_stock_info(symbol)
        if info:
            data_service.cache_stock_info(symbol, info)
            return info

        raise HTTPException(status_code=404, detail="Stock info not found")

    except Exception as e:
        logger.error(f"Error in get_info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def main():
    publish_strategy_state(
        strategy_name=STRATEGY_NAME,
        index_name=INDEX_NAME,
        spread_type=SPREAD_TYPE,
        ui_state="BOOTING",
        message="Strategy process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    wait_until(TARGET_HOUR, TARGET_MINUTE)

    try:
        cred = load_creds()

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("Kite API authenticated.")

        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="BOOTING",
            message="Kite API authenticated successfully.",
            progress_text="Preparing strategy objects",
            is_loading=True,
        )

        paper_book = PaperOrderBook()

        nifty_ema = EMACrossover1Min(
            kite=kite,
            cred=cred,
            instrument_token=NIFTY_SPOT_TOKEN,
            preload_days=PRELOAD_DAYS,
        )

        alpha_bull = AlphaBullCall(
            kite=kite,
            cred=cred,
            paper_book=paper_book,
            stop_loss_amount=STOP_LOSS_AMOUNT,
            target_amount=TARGET_AMOUNT,
        )

        log_and_print("Starting NIFTY EMA bullish-entry logic...")
        nifty_ema.start(alpha_bull)

        log_and_print("Main finished.")

    except SystemExit:
        log_and_print("Exited after execution.")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="STOPPED",
            message="Strategy stopped manually.",
            progress_text=None,
            is_loading=False,
        )
    except Exception as e:
        log_and_print(f"An error occurred in main execution: {e}", "error")
        publish_strategy_state(
            strategy_name=STRATEGY_NAME,
            index_name=INDEX_NAME,
            spread_type=SPREAD_TYPE,
            ui_state="ERROR",
            message=f"Strategy failed: {str(e)}",
            progress_text="Check logs",
            is_loading=False,
        )


if __name__ == "__main__":
    main()
