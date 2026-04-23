from __future__ import annotations

import csv
import logging
import os
import threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from api_service import auth_routes, intraday_spreads_routes, portfolio_routes


from bullcallspread.sensex_bull_call_signal import main as bull_call_sensex_main

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

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
LOGIN_EVENTS_FILE = DATA_DIR / "login_events.csv"

_bull_call_strategy_thread: threading.Thread | None = None
_bull_call_strategy_lock = threading.Lock()

_bull_call_sensex_strategy_thread: threading.Thread | None = None
_bull_call_sensex_strategy_lock = threading.Lock()

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


def start_bull_call_sensex_strategy() -> bool:
    global _bull_call_sensex_strategy_thread

    with _bull_call_sensex_strategy_lock:
        if (
            _bull_call_sensex_strategy_thread is not None
            and _bull_call_sensex_strategy_thread.is_alive()
        ):
            logger.info("⚠️ Bull Call SENSEX strategy thread already running.")
            return False

        def run() -> None:
            try:
                logger.info("✅ Bull Call SENSEX strategy thread started.")
                bull_call_sensex_main()
            except Exception as exc:
                logger.error("❌ Bull Call SENSEX strategy crashed: %s", exc, exc_info=True)
            finally:
                logger.info("ℹ️ Bull Call SENSEX strategy thread finished.")

        _bull_call_sensex_strategy_thread = threading.Thread(
            target=run,
            daemon=True,
            name="bull-call-sensex-strategy-thread",
        )
        _bull_call_sensex_strategy_thread.start()
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
    return (
        _bull_call_strategy_thread is not None
        and _bull_call_strategy_thread.is_alive()
    )


def is_bull_call_sensex_strategy_running() -> bool:
    return (
        _bull_call_sensex_strategy_thread is not None
        and _bull_call_sensex_strategy_thread.is_alive()
    )


def is_bear_put_strategy_running() -> bool:
    return (
        _bear_put_strategy_thread is not None
        and _bear_put_strategy_thread.is_alive()
    )


def is_bear_put_sensex_strategy_running() -> bool:
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

    def delayed_start_bear_put() -> None:
        bear_started = start_bear_put_strategy()
        if bear_started:
            logger.info("✅ Bear Put strategy launched from delayed startup.")
        else:
            logger.info("⚠️ Bear Put strategy was already running.")

    def delayed_start_bull_call_sensex() -> None:
        bull_sensex_started = start_bull_call_sensex_strategy()
        if bull_sensex_started:
            logger.info("✅ Bull Call SENSEX strategy launched from delayed startup.")
        else:
            logger.info("⚠️ Bull Call SENSEX strategy was already running.")

    def delayed_start_bear_put_sensex() -> None:
        bear_sensex_started = start_bear_put_sensex_strategy()
        if bear_sensex_started:
            logger.info("✅ Bear Put SENSEX strategy launched from delayed startup.")
        else:
            logger.info("⚠️ Bear Put SENSEX strategy was already running.")

    threading.Timer(10.0, delayed_start_bear_put).start()
    threading.Timer(20.0, delayed_start_bull_call_sensex).start()
    threading.Timer(30.0, delayed_start_bear_put_sensex).start()

    logger.info("⏳ Delayed startup scheduling completed.")


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


def get_admin_secret() -> str:
    secret = os.getenv("ADMIN_SECRET")
    if not secret:
        raise RuntimeError("ADMIN_SECRET not configured")
    return secret.strip()


def verify_admin_secret(secret: str) -> None:
    provided = (secret or "").strip()
    expected = get_admin_secret()

    if provided != expected:
        raise HTTPException(status_code=403, detail="Unauthorized")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    raw = value.strip()
    if not raw:
        return None

    try:
        if raw.endswith("Z"):
            raw = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def load_login_events() -> list[dict[str, str]]:
    if not LOGIN_EVENTS_FILE.exists():
        return []

    with LOGIN_EVENTS_FILE.open("r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        return list(reader)


def build_login_dates_by_user() -> dict[int, set]:
    login_dates_by_user: dict[int, set] = defaultdict(set)

    for row in load_login_events():
        try:
            user_id = int(str(row.get("user_id", "")).strip())
        except Exception:
            continue

        event_at = parse_iso_datetime(row.get("event_at"))
        if event_at is None:
            continue

        login_dates_by_user[user_id].add(event_at.date())

    return login_dates_by_user


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
        "bull_call_sensex_strategy_running": is_bull_call_sensex_strategy_running(),
        "bear_put_strategy_running": is_bear_put_strategy_running(),
        "bear_put_sensex_strategy_running": is_bear_put_sensex_strategy_running(),
    }


@app.get("/admin/secret-status")
def admin_secret_status():
    secret = get_admin_secret()
    return {
        "admin_secret_configured": bool(secret),
        "admin_secret_length": len(secret),
    }


@app.get("/admin/users")
def admin_users(
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin_secret(secret)

    from models.user import User

    users = db.query(User).order_by(User.created_at.desc()).all()

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "created_at": (
                u.created_at.isoformat()
                if getattr(u, "created_at", None)
                else None
            ),
        }
        for u in users
    ]


@app.get("/admin/analytics/summary")
def admin_analytics_summary(
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin_secret(secret)

    from models.user import User

    now = utc_now()
    today = now.date()
    last_1_day = today - timedelta(days=1)
    last_7_days = today - timedelta(days=7)
    last_30_days = today - timedelta(days=30)

    users = db.query(User).all()
    login_dates_by_user = build_login_dates_by_user()

    signups_today = 0
    signups_last_7_days = 0
    signups_last_30_days = 0

    active_1d = 0
    active_7d = 0
    active_30d = 0

    for user in users:
        created_at = user.created_at
        if created_at is not None:
            created_date = created_at.date()
            if created_date == today:
                signups_today += 1
            if created_date >= last_7_days:
                signups_last_7_days += 1
            if created_date >= last_30_days:
                signups_last_30_days += 1

        login_dates = login_dates_by_user.get(user.id, set())

        if any(d >= last_1_day for d in login_dates):
            active_1d += 1
        if any(d >= last_7_days for d in login_dates):
            active_7d += 1
        if any(d >= last_30_days for d in login_dates):
            active_30d += 1

    return {
        "total_users": len(users),
        "signups_today": signups_today,
        "signups_last_7_days": signups_last_7_days,
        "signups_last_30_days": signups_last_30_days,
        "active_users_1d": active_1d,
        "active_users_7d": active_7d,
        "active_users_30d": active_30d,
        "note": "Retention becomes more accurate after login_events.csv starts collecting login history from this deployment onward.",
    }


@app.get("/admin/analytics/daily-signups")
def admin_daily_signups(
    secret: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    verify_admin_secret(secret)

    from models.user import User

    today = utc_now().date()
    start_date = today - timedelta(days=days - 1)

    signups_map: dict[str, int] = {}
    current = start_date
    while current <= today:
        signups_map[current.isoformat()] = 0
        current += timedelta(days=1)

    users = db.query(User).all()
    for user in users:
        if user.created_at is None:
            continue

        created_date = user.created_at.date()
        if start_date <= created_date <= today:
            key = created_date.isoformat()
            signups_map[key] = signups_map.get(key, 0) + 1

    return {
        "days": days,
        "series": [
            {"date": date_str, "signups": count}
            for date_str, count in signups_map.items()
        ],
    }


@app.get("/admin/analytics/active-users")
def admin_active_users(
    secret: str = Query(...),
):
    verify_admin_secret(secret)

    today = utc_now().date()
    login_dates_by_user = build_login_dates_by_user()

    active_1d_users = 0
    active_7d_users = 0
    active_30d_users = 0

    last_1_day = today - timedelta(days=1)
    last_7_days = today - timedelta(days=7)
    last_30_days = today - timedelta(days=30)

    for login_dates in login_dates_by_user.values():
        if any(d >= last_1_day for d in login_dates):
            active_1d_users += 1
        if any(d >= last_7_days for d in login_dates):
            active_7d_users += 1
        if any(d >= last_30_days for d in login_dates):
            active_30d_users += 1

    return {
        "active_users_1d": active_1d_users,
        "active_users_7d": active_7d_users,
        "active_users_30d": active_30d_users,
    }


@app.get("/admin/analytics/retention")
def admin_retention(
    secret: str = Query(...),
    db: Session = Depends(get_db),
):
    verify_admin_secret(secret)

    from models.user import User

    today = utc_now().date()
    users = db.query(User).all()
    login_dates_by_user = build_login_dates_by_user()

    def compute_retention(day_n: int) -> dict:
        eligible = 0
        retained = 0

        for user in users:
            if user.created_at is None:
                continue

            signup_date = user.created_at.date()
            target_date = signup_date + timedelta(days=day_n)

            if target_date > today:
                continue

            eligible += 1
            if target_date in login_dates_by_user.get(user.id, set()):
                retained += 1

        rate = round((retained / eligible) * 100, 2) if eligible > 0 else 0.0

        return {
            "eligible_users": eligible,
            "retained_users": retained,
            "retention_rate_pct": rate,
        }

    return {
        "d1": compute_retention(1),
        "d7": compute_retention(7),
        "d30": compute_retention(30),
        "note": "This uses exact-day retention based on login_events.csv. Historical cohorts before login event tracking started may understate retention.",
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


@app.post("/api/bull-call-sensex-strategy/start")
def start_bull_call_sensex():
    started = start_bull_call_sensex_strategy()
    return {
        "started": started,
        "strategy_running": is_bull_call_sensex_strategy_running(),
        "message": (
            "Bull call SENSEX strategy started."
            if started
            else "Bull call SENSEX strategy already running."
        ),
    }


@app.get("/api/bull-call-sensex-strategy/status")
def bull_call_sensex_strategy_status():
    return {
        "strategy_running": is_bull_call_sensex_strategy_running(),
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
