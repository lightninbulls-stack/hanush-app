"""
APScheduler — daily market tasks (IST, Mon-Fri unless noted).
08:45  Pre-market 1min refresh
08:50  Reload instrument tokens
09:00  Auth check warning
15:35  Post-market EOD backup
02:00  Nightly live_ticks purge
Sun 06:00  Weekly failed backfill retry
"""

import logging
from datetime import datetime, timedelta

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")


def _pre_market_refresh():
    try:
        from kite_service.auth import kite_auth
        from market_data.backfill import refresh_recent_1min
        if kite_auth.is_authenticated():
            logger.info("[Scheduler] Pre-market 1min refresh...")
            refresh_recent_1min()
        else:
            logger.warning("[Scheduler] Skipped — Kite not authenticated")
    except Exception as e:
        logger.error(f"[Scheduler] Pre-market refresh: {e}")


def _reload_instruments():
    try:
        from kite_service.auth import kite_auth
        from kite_service.instrument_manager import instrument_manager
        if kite_auth.is_authenticated():
            instrument_manager.load_instruments(force_refresh=True)
    except Exception as e:
        logger.error(f"[Scheduler] Instrument reload: {e}")


def _auth_check():
    try:
        from kite_service.auth import kite_auth
        if not kite_auth.is_authenticated():
            logger.critical("[Scheduler] ⚠️  KITE NOT AUTHENTICATED — market opens in 15 min! Visit /kite/login")
        else:
            logger.info("[Scheduler] Kite auth OK")
    except Exception as e:
        logger.error(f"[Scheduler] Auth check: {e}")


def _post_market_aggregate():
    try:
        from websocket_service.aggregator import aggregator
        from kite_service.auth import kite_auth
        if kite_auth.is_authenticated():
            logger.info("[Scheduler] Post-market EOD (backup)...")
            aggregator.finalize_eod_candles()
    except Exception as e:
        logger.error(f"[Scheduler] Post-market: {e}")


def _purge_live_ticks():
    try:
        from db import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        cutoff = datetime.utcnow() - timedelta(days=2)
        result = db.execute(text("DELETE FROM live_ticks WHERE received_at < :cutoff"), {"cutoff": cutoff})
        db.commit()
        db.close()
        logger.info(f"[Scheduler] Purged {result.rowcount} live_ticks rows")
    except Exception as e:
        logger.error(f"[Scheduler] Tick purge: {e}")


def _weekly_backfill_retry():
    try:
        from kite_service.auth import kite_auth
        from market_data.backfill import run_full_backfill
        from db import SessionLocal
        from models.market_data import BackfillJob
        if not kite_auth.is_authenticated():
            return
        db = SessionLocal()
        failed = db.query(BackfillJob).filter(BackfillJob.status == "failed").all()
        db.close()
        if failed:
            run_full_backfill(symbols=list({j.symbol for j in failed}),
                              timeframes=list({j.timeframe for j in failed}), force=True)
    except Exception as e:
        logger.error(f"[Scheduler] Weekly retry: {e}")


class MarketScheduler:
    def __init__(self):
        self._scheduler = BackgroundScheduler(timezone=IST)
        self._running = False

    def start(self):
        if self._running:
            return
        jobs = [
            ("pre_market_refresh",    _pre_market_refresh,    dict(hour=8,  minute=45, day_of_week="mon-fri")),
            ("reload_instruments",    _reload_instruments,    dict(hour=8,  minute=50, day_of_week="mon-fri")),
            ("auth_check",            _auth_check,            dict(hour=9,  minute=0,  day_of_week="mon-fri")),
            ("post_market_aggregate", _post_market_aggregate, dict(hour=15, minute=35, day_of_week="mon-fri")),
            ("purge_live_ticks",      _purge_live_ticks,      dict(hour=2,  minute=0)),
            ("weekly_backfill_retry", _weekly_backfill_retry, dict(day_of_week="sun", hour=6, minute=0)),
        ]
        for job_id, func, cron_kwargs in jobs:
            self._scheduler.add_job(func, CronTrigger(**cron_kwargs, timezone=IST),
                                    id=job_id, replace_existing=True)
        self._scheduler.start()
        self._running = True
        logger.info(f"MarketScheduler started ({len(jobs)} tasks)")

    def stop(self):
        if self._running:
            self._scheduler.shutdown(wait=False)
            self._running = False

    def get_jobs(self):
        return [{"id": j.id, "next_run": j.next_run_time.isoformat() if j.next_run_time else None}
                for j in self._scheduler.get_jobs()]


market_scheduler = MarketScheduler()
