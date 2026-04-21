from __future__ import annotations

import logging

from fastapi import APIRouter
from shared.intraday_spreads_state import spread_state

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/intraday-spreads/all")
def get_all_intraday_spreads():
    payload = spread_state.get_all()

    try:
        logger.info("INTRADAY_SPREADS total=%s", len(payload))

        for spread_key, spread in payload.items():
            logger.info(
                (
                    "SPREAD key=%s index=%s spread_type=%s strategy=%s "
                    "status=%s ui_state=%s net_pnl=%s stop_loss=%s target=%s updated_at=%s"
                ),
                spread_key,
                spread.get("index"),
                spread.get("spread_type"),
                spread.get("strategy_name"),
                spread.get("status"),
                spread.get("ui_state"),
                spread.get("net_pnl"),
                spread.get("stop_loss"),
                spread.get("target"),
                spread.get("updated_at"),
            )

            legs = spread.get("legs", [])
            for i, leg in enumerate(legs, start=1):
                logger.info(
                    (
                        "LEG spread=%s leg_no=%s side=%s symbol=%s "
                        "avg_price=%s ltp=%s pnl=%s entry_time=%s"
                    ),
                    spread_key,
                    i,
                    leg.get("side"),
                    leg.get("trading_symbol"),
                    leg.get("avg_price"),
                    leg.get("ltp"),
                    leg.get("pnl"),
                    leg.get("entry_time"),
                )

            pnl_curve = spread.get("pnl_curve", [])
            if pnl_curve:
                last_point = pnl_curve[-1]
                logger.info(
                    "LAST_PNL spread=%s time=%s pnl=%s drawdown=%s stop_loss=%s target=%s",
                    spread_key,
                    last_point.get("time"),
                    last_point.get("pnl"),
                    last_point.get("drawdown"),
                    last_point.get("stop_loss"),
                    last_point.get("target"),
                )
            else:
                logger.info("LAST_PNL spread=%s empty_curve", spread_key)

    except Exception as exc:
        logger.exception("Failed to log intraday spreads payload: %s", exc)

    return {
        "status": "ok",
        "data": payload,
    }


@router.get("/intraday-spreads/{strategy_name}")
def get_intraday_spread(strategy_name: str):
    payload = spread_state.get_one(strategy_name)
    if payload is None:
        return {
            "status": "not_found",
            "data": None,
        }
    return {
        "status": "ok",
        "data": payload,
    }
