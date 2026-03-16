"""
kite_service/auth.py — Kite Connect authentication

Supports two authentication modes:

Mode 1 — Direct access_token (simplest, like auth_data.json approach):
    Set KITE_ACCESS_TOKEN in Render env vars.
    Get it from kite.zerodha.com → DevTools → Cookies → enctoken
    OR from your local daily_login.py after generate_session().
    Valid for 1 trading day. Update daily.

Mode 2 — request_token exchange (browser login flow):
    Set KITE_REQUEST_TOKEN in Render env vars and redeploy.
    Only consumed once if no valid DB session exists.

Mode 3 — DB session (automatic after first login):
    Once authenticated, session is stored encrypted in DB and
    reused automatically on restarts — no env var needed.

Required env vars always:
    ZERODHA_API_KEY         — from developers.kite.trade
    ZERODHA_API_SECRET      — from developers.kite.trade
    TOKEN_ENCRYPTION_KEY    — generate once:
                              python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
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
                "ZERODHA_API_KEY and ZERODHA_API_SECRET must be set as environment variables."
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

        # Try all auth modes in order
        self._bootstrap()

    def _bootstrap(self):
        """
        Try authentication in this order:
          1. KITE_ACCESS_TOKEN env var  (simplest — just paste token directly)
          2. KITE_REQUEST_TOKEN env var  (exchange for access_token, only if no DB session)
          3. DB session                  (automatic on restarts after first login)
        """
        # Mode 1: Direct access_token from env var
        self._consume_access_token_env()

        # Mode 2: request_token from env var (only if Mode 1 didn't work)
        if not self._kite:
            self._consume_request_token_env()

    def _consume_access_token_env(self):
        """
        Mode 1: KITE_ACCESS_TOKEN env var.
        Equivalent to auth_data.json approach — just set the access_token directly.
        No request_token exchange needed. Update this env var each morning.
        """
        access_token = os.environ.get("KITE_ACCESS_TOKEN", "").strip()
        if not access_token:
            return

        logger.info("KITE_ACCESS_TOKEN found — validating...")
        try:
            kite = KiteConnect(api_key=self.api_key)
            kite.set_access_token(access_token)
            profile = kite.profile()  # validates the token is still alive

            # Save to DB for reuse across restarts
            self._save_access_token_to_db(access_token)

            self._kite         = kite
            self._access_token = access_token
            logger.info(
                f"Authenticated via KITE_ACCESS_TOKEN — {profile.get('user_name')} "
                f"({profile.get('email')})"
            )
        except Exception as e:
            logger.error(
                f"KITE_ACCESS_TOKEN is invalid or expired: {e}\n"
                "Get a fresh access_token and update KITE_ACCESS_TOKEN in Render env vars."
            )

    def _consume_request_token_env(self):
        """
        Mode 2: KITE_REQUEST_TOKEN env var.
        Only consumed if no valid session exists in DB already.
        """
        request_token = os.environ.get("KITE_REQUEST_TOKEN", "").strip()
        if not request_token:
            return

        # Skip if DB already has a valid session
        db = SessionLocal()
        try:
            existing = (
                db.query(KiteSession)
                .filter(KiteSession.is_active == True)
                .filter(KiteSession.expires_at > datetime.utcnow())
                .first()
            )
            if existing:
                logger.info(
                    "KITE_REQUEST_TOKEN set but valid DB session exists — skipping."
                )
                return
        finally:
            db.close()

        logger.info("KITE_REQUEST_TOKEN found — no active DB session, consuming...")
        try:
            self.generate_session(request_token)
            logger.info("Authenticated via KITE_REQUEST_TOKEN. Session stored in DB.")
        except Exception as e:
            logger.error(
                f"Failed to consume KITE_REQUEST_TOKEN: {e}\n"
                "Token may have expired. Use KITE_ACCESS_TOKEN instead — it's simpler."
            )

    def _save_access_token_to_db(self, access_token: str):
        """Encrypt and save access_token to DB for reuse across restarts."""
        encrypted = self.fernet.encrypt(access_token.encode()).decode()
        db = SessionLocal()
        try:
            db.query(KiteSession).update({"is_active": False})
            db.add(KiteSession(
                access_token  = encrypted,
                request_token = "via_env_var",
                public_token  = None,
                is_active     = True,
                expires_at    = datetime.utcnow() + timedelta(hours=18),
            ))
            db.commit()
            logger.info("Access token saved to DB.")
        except Exception as e:
            logger.warning(f"Could not save token to DB: {e}")
        finally:
            db.close()

    def get_login_url(self) -> str:
        return KiteConnect(api_key=self.api_key).login_url()

    def generate_session(self, request_token: str) -> str:
        """Exchange request_token for access_token and store in DB."""
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
        """Return authenticated KiteConnect instance, loading from DB if needed."""
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
                    "No active Kite session. To authenticate set one of:\n"
                    "  KITE_ACCESS_TOKEN   — easiest, get from kite.zerodha.com cookies\n"
                    "  KITE_REQUEST_TOKEN  — from /kite/login redirect URL\n"
                    "Then update Render env vars and redeploy."
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
