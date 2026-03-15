import os
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime, date

from kite_service.auth import kite_auth
from market_data.symbol_registry import get_active_symbols, update_symbol_token

logger = logging.getLogger(__name__)
INSTRUMENT_CACHE_FILE = "/tmp/nse_instruments_cache.json"


class InstrumentManager:
    def __init__(self):
        self._token_map: Dict[str, int] = {}
        self._symbol_map: Dict[int, str] = {}
        self._loaded_date: Optional[date] = None
        self._all_instruments: Dict[str, int] = {}

    def _load_from_cache(self) -> bool:
        try:
            if os.path.exists(INSTRUMENT_CACHE_FILE):
                with open(INSTRUMENT_CACHE_FILE) as f:
                    cache = json.load(f)
                if cache.get("date") == str(date.today()):
                    self._token_map = cache["token_map"]
                    self._symbol_map = {int(v): k for k, v in self._token_map.items()}
                    self._all_instruments = cache.get("all_instruments", {})
                    self._loaded_date = date.today()
                    return True
        except Exception as e:
            logger.warning(f"Cache load failed: {e}")
        return False

    def _save_to_cache(self):
        try:
            with open(INSTRUMENT_CACHE_FILE, "w") as f:
                json.dump({"date": str(date.today()), "token_map": self._token_map,
                           "all_instruments": self._all_instruments}, f)
        except Exception as e:
            logger.warning(f"Cache save failed: {e}")

    def load_instruments(self, force_refresh: bool = False) -> bool:
        if not force_refresh and self._load_from_cache():
            self._sync_token_map_from_db()
            return True
        kite = kite_auth.get_kite()
        if not kite:
            return False
        try:
            instruments = kite.instruments("NSE")
            self._all_instruments = {inst["tradingsymbol"]: inst["instrument_token"] for inst in instruments}
            active = get_active_symbols()
            token_map = {sym: self._all_instruments[sym] for sym in active if sym in self._all_instruments}
            self._token_map = token_map
            self._symbol_map = {v: k for k, v in token_map.items()}
            self._loaded_date = date.today()
            self._save_to_cache()
            for inst in instruments:
                if inst["tradingsymbol"] in token_map:
                    update_symbol_token(inst["tradingsymbol"], inst["instrument_token"], name=inst.get("name"))
            logger.info(f"Token map: {len(token_map)}/{len(active)} symbols mapped")
            return True
        except Exception as e:
            logger.error(f"Failed to load instruments: {e}")
            return False

    def _sync_token_map_from_db(self):
        if not self._all_instruments:
            return
        active = get_active_symbols()
        token_map = {sym: self._all_instruments[sym] for sym in active if sym in self._all_instruments}
        self._token_map = token_map
        self._symbol_map = {v: k for k, v in token_map.items()}

    def resolve_token_for_symbol(self, symbol: str) -> Optional[int]:
        if self._all_instruments:
            token = self._all_instruments.get(symbol.upper())
            if token:
                return token
        if self.load_instruments(force_refresh=True):
            return self._all_instruments.get(symbol.upper())
        return None

    def add_symbol_to_tracking(self, symbol: str) -> Optional[int]:
        symbol = symbol.upper()
        token = self.resolve_token_for_symbol(symbol)
        if token:
            self._token_map[symbol] = token
            self._symbol_map[token] = symbol
            update_symbol_token(symbol, token)
            return token
        return None

    def remove_symbol_from_tracking(self, symbol: str):
        symbol = symbol.upper()
        token = self._token_map.pop(symbol, None)
        if token:
            self._symbol_map.pop(token, None)

    def get_token(self, symbol: str) -> Optional[int]:
        return self._token_map.get(symbol)

    def get_symbol(self, token: int) -> Optional[str]:
        return self._symbol_map.get(token)

    def get_all_tokens(self) -> List[int]:
        return list(self._token_map.values())

    def get_token_map(self) -> Dict[str, int]:
        return dict(self._token_map)

    def is_loaded(self) -> bool:
        return bool(self._token_map) and self._loaded_date == date.today()


instrument_manager = InstrumentManager()
