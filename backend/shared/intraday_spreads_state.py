from __future__ import annotations

from fastapi import APIRouter
from shared.intraday_spreads_state import spread_state

router = APIRouter()


@router.get("/intraday-spreads/all")
def get_all_intraday_spreads():
    return {
        "status": "ok",
        "data": spread_state.get_all(),
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
