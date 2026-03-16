"""
kite_service/auth.py — Kite Connect authentication
Tokens stored encrypted in DB. Re-authenticate daily.

Requires env vars:
    ZERODHA_API_KEY         — from developers.kite.trade
    ZERODHA_API_SECRET      — from developers.kite.trade
    TOKEN_ENCRYPTION_KEY    — generate once:
                              python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Optional (env-var based daily auth — no browser needed):
    KITE_REQUEST_TOKEN      — paste fresh request_token each morning, then redeploy on Render
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
        api_key    = os.environ.get("ZERODHA_API_KEY")
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

        self.api_key    = api_key
        self.api_secret = api_secret
        self.fernet     = Fernet(fernet_key.encode())
        self._kite: Optional[KiteConnect] = None
        self._access_token: Optional[str] = None

        # Auto-consume KITE_REQUEST_TOKEN if set as env var on Render
        self._consume_env_request_token()

    def _consume_env_request_token(self):
        """
        If KITE_REQUEST_TOKEN is set as an env var, consume it on startup to
        generate and store a fresh access_token in the DB.

        Daily workflow on Render:
          1. Open /kite/login in browser → log in → copy request_token from redirect URL
          2. Set KITE_REQUEST_TOKEN = <that value> in Render env vars
          3. Click Save Changes → Render redeploys → this method runs automatically
        """
        request_token = os.environ.get("KITE_REQUEST_TOKEN", "").strip()
        if not request_token:
            return

        logger.info("KITE_REQUEST_TOKEN found in environment — consuming on startup...")
        try:
            self.generate_session(request_token)
            logger.info(
                "Successfully authenticated via KITE_REQUEST_TOKEN. "
                "You can remove it from Render env vars after deployment."
            )
        except Exception as e:
            logger.error(
                f"Failed to consume KITE_REQUEST_TOKEN: {e}\n"
                "The token may have expired (valid only a few minutes after Zerodha login).\n"
                "Get a fresh token from /kite/login, update KITE_REQUEST_TOKEN, and redeploy."
            )

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
            db.add(KiteSession(
                access_token  = encrypted,
                request_token = request_token,
                public_token  = data.get("public_token"),
                is_active     = True,
                expires_at    = datetime.utcnow() + timedelta(hours=18),
            ))
            db.commit()
        finally:
            db.close()

        self._access_token = access_token
        self._kite = KiteConnect(api_key=self.api_key)
        self._kite.set_access_token(access_token)
        logger.info("Kite session created and stored in DB.")
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
                logger.warning(
                    "No active Kite session. To authenticate:\n"
                    "  Option 1 — Visit /kite/login in browser\n"
                    "  Option 2 — Set KITE_REQUEST_TOKEN in Render env vars and redeploy"
                )
                return None

            access_token       = self.fernet.decrypt(session.access_token.encode()).decode()
            self._kite         = KiteConnect(api_key=self.api_key)
            self._kite.set_access_token(access_token)
            self._access_token = access_token
            return self._kite

        except Exception as e:
            logger.error(f"Failed to load Kite session from DB: {e}")
            return None
        finally:
            db.close()

    def is_authenticated(self) -> bool:
        return self.get_kite() is not None

    def get_access_token(self) -> Optional[str]:
        self.get_kite()
        return self._access_token


kite_auth = KiteAuthManager()
