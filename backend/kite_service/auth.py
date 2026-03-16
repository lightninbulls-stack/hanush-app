import os
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional

from kiteconnect import KiteConnect
from cryptography.fernet import Fernet
from models.market_data import KiteSession
from db import SessionLocal

logger = logging.getLogger(__name__)


class KiteAuthManager:
    def __init__(self):
        api_key    = os.environ.get("ZERODHA_API_KEY")
        api_secret = os.environ.get("ZERODHA_API_SECRET")
        fernet_key = os.environ.get("TOKEN_ENCRYPTION_KEY")

        if not api_key or not api_secret:
            raise RuntimeError("ZERODHA_API_KEY and ZERODHA_API_SECRET must be set.")
        if not fernet_key:
            raise RuntimeError("TOKEN_ENCRYPTION_KEY must be set.")

        self.api_key    = api_key
        self.api_secret = api_secret
        self.fernet     = Fernet(fernet_key.encode())
        self._kite: Optional[KiteConnect] = None
        self._access_token: Optional[str] = None

        # bootstrap synchronously at startup
        self._bootstrap()

    def _bootstrap(self):
        self._consume_access_token_env()
        if not self._kite:
            self._consume_request_token_env()

    def _consume_access_token_env(self):
        access_token = os.environ.get("KITE_ACCESS_TOKEN", "").strip()
        if not access_token:
            return
        try:
            kite = KiteConnect(api_key=self.api_key)
            kite.set_access_token(access_token)
            profile = kite.profile()  # blocking
            self._save_access_token_to_db(access_token)
            self._kite = kite
            self._access_token = access_token
            logger.info(f"Authenticated via KITE_ACCESS_TOKEN — {profile.get('user_name')}")
        except Exception as e:
            logger.error(f"KITE_ACCESS_TOKEN invalid: {e}")

    def _consume_request_token_env(self):
        request_token = os.environ.get("KITE_REQUEST_TOKEN", "").strip()
        if not request_token:
            return
        db = SessionLocal()
        try:
            existing = (
                db.query(KiteSession)
                .filter(KiteSession.is_active == True)
                .filter(KiteSession.expires_at > datetime.utcnow())
                .first()
            )
            if existing:
                logger.info("Valid DB session exists — skipping request_token.")
                return
        finally:
            db.close()
        try:
            self.generate_session(request_token)
        except Exception as e:
            logger.error(f"Failed to consume KITE_REQUEST_TOKEN: {e}")

    def _save_access_token_to_db(self, access_token: str):
        encrypted = self.fernet.encrypt(access_token.encode()).decode()
        db = SessionLocal()
        try:
            db.query(KiteSession).update({"is_active": False})
            db.add(KiteSession(
                access_token=encrypted,
                request_token="via_env_var",
                public_token=None,
                is_active=True,
                expires_at=datetime.utcnow() + timedelta(hours=18),
            ))
            db.commit()
        finally:
            db.close()

    def generate_session(self, request_token: str) -> str:
        kite = KiteConnect(api_key=self.api_key)
        data = kite.generate_session(request_token, api_secret=self.api_secret)
        access_token = data["access_token"]
        encrypted = self.fernet.encrypt(access_token.encode()).decode()
        db = SessionLocal()
        try:
            db.query(KiteSession).update({"is_active": False})
            db.add(KiteSession(
                access_token=encrypted,
                request_token=request_token,
                public_token=data.get("public_token"),
                is_active=True,
                expires_at=datetime.utcnow() + timedelta(hours=18),
            ))
            db.commit()
        finally:
            db.close()
        self._access_token = access_token
        self._kite = KiteConnect(api_key=self.api_key)
        self._kite.set_access_token(access_token)
        return access_token

    def get_kite(self) -> Optional[KiteConnect]:
        if self._kite and self._access_token:
            return self._kite
        db = SessionLocal()
        try:
            session = (
                db.query(KiteSession)
                .filter(KiteSession.is_active == True)
                .filter(KiteSession.expires_at > datetime.utcnow())
                .order_by(KiteSession.created_at.desc())
                .first()
            )
            if not session:
                return None
            access_token = self.fernet.decrypt(session.access_token.encode()).decode()
            self._kite = KiteConnect(api_key=self.api_key)
            self._kite.set_access_token(access_token)
            self._access_token = access_token
            return self._kite
        finally:
            db.close()

    def is_authenticated(self) -> bool:
        return self.get_kite() is not None

    def get_access_token(self) -> Optional[str]:
        self.get_kite()
        return self._access_token


kite_auth = KiteAuthManager()
