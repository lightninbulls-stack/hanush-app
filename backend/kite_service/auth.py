"""
Kite authentication. Tokens stored encrypted in DB. Re-authenticate daily via /kite/login.
Requires env vars: ZERODHA_API_KEY, ZERODHA_API_SECRET, TOKEN_ENCRYPTION_KEY
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from kiteconnect import KiteConnect
from cryptography.fernet import Fernet
from models.market_data import KiteSession
from db import SessionLocal

logger = logging.getLogger(__name__)


class KiteAuthManager:
    def __init__(self):
        api_key = os.environ.get("ZERODHA_API_KEY")
        api_secret = os.environ.get("ZERODHA_API_SECRET")
        fernet_key = os.environ.get("TOKEN_ENCRYPTION_KEY")
        if not api_key or not api_secret:
            raise RuntimeError(
                "ZERODHA_API_KEY and ZERODHA_API_SECRET must be set as environment variables. "
                "Get these from https://developers.kite.trade/apps"
            )
        if not fernet_key:
            raise RuntimeError(
                "TOKEN_ENCRYPTION_KEY must be set. Generate with:\n"
                "  python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        self.api_key = api_key
        self.api_secret = api_secret
        self.fernet = Fernet(fernet_key.encode())
        self._kite: Optional[KiteConnect] = None
        self._access_token: Optional[str] = None

    def get_login_url(self) -> str:
        return KiteConnect(api_key=self.api_key).login_url()

    def generate_session(self, request_token: str) -> str:
        kite = KiteConnect(api_key=self.api_key)
        data = kite.generate_session(request_token, api_secret=self.api_secret)
        access_token = data["access_token"]
        encrypted = self.fernet.encrypt(access_token.encode()).decode()
        db = SessionLocal()
        try:
            db.query(KiteSession).update({"is_active": False})
            db.add(KiteSession(access_token=encrypted, request_token=request_token,
                               public_token=data.get("public_token"), is_active=True,
                               expires_at=datetime.utcnow() + timedelta(hours=18)))
            db.commit()
        finally:
            db.close()
        self._access_token = access_token
        self._kite = KiteConnect(api_key=self.api_key)
        self._kite.set_access_token(access_token)
        logger.info("Kite session created")
        return access_token

    def get_kite(self) -> Optional[KiteConnect]:
        if self._kite and self._access_token:
            return self._kite
        db = SessionLocal()
        try:
            session = (db.query(KiteSession)
                       .filter(KiteSession.is_active == True)
                       .filter(KiteSession.expires_at > datetime.utcnow())
                       .order_by(KiteSession.created_at.desc()).first())
            if not session:
                logger.warning("No active Kite session. Visit /kite/login to authenticate.")
                return None
            access_token = self.fernet.decrypt(session.access_token.encode()).decode()
            self._kite = KiteConnect(api_key=self.api_key)
            self._kite.set_access_token(access_token)
            self._access_token = access_token
            return self._kite
        except Exception as e:
            logger.error(f"Failed to load Kite session: {e}")
            return None
        finally:
            db.close()

    def is_authenticated(self) -> bool:
        return self.get_kite() is not None

    def get_access_token(self) -> Optional[str]:
        self.get_kite()
        return self._access_token


kite_auth = KiteAuthManager()
