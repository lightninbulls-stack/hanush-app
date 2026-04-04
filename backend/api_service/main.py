from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
from shared.models import StockData, StockListResponse, HistoricalData, StockInfo
from fetch_service.main import DataService, fetch_from_google_sheets, fetch_historical_data, fetch_stock_info
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
import logging
from api_service import auth_routes, portfolio_routes
from db import Base, engine, SessionLocal
from models import user  # ✅ must be imported before create_all so table is registered


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)  # ✅ now creates users table correctly

app = FastAPI(title="Trading Bible API")

# ✅ ADD THIS HERE (below app creation)
from api_service import portfolio_routes
app.include_router(portfolio_routes.router, prefix="/portfolio", tags=["portfolio"])

# existing auth router
app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])



# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )

data_service = DataService()

# ✅ Temporary debug endpoint — remove after verifying users table
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
        columns = conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        """)).fetchall()
    return {
        "alembic_version": version[0] if version else None,
        "users_columns": [{"name": c[0], "type": c[1]} for c in columns]
    }


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
                except: pass
                return StockListResponse(category=category, stocks=stocks)
        except Exception as e:
            logger.error(f"Fetch failed: {e}")

        logger.warning(f"No data found for category: {category} in Excel or Google Sheets.")
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

if __name__ == "__main__":
    import uvicorn, os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
