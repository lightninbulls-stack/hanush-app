from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from typing import Any

import bcrypt
from jose import ExpiredSignatureError, JWTError, jwt

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
    if not secret or not secret.strip():
        raise RuntimeError(
            "JWT secret is not configured. Set JWT_SECRET or SECRET_KEY."
        )
    return secret.strip()


JWT_SECRET = get_jwt_secret()


def normalize_subject(subject: str) -> str:
    value = subject.strip().lower()
    if not value:
        raise ValueError("Token subject cannot be empty")
    return value


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    expires_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: dict[str, Any] = dict(additional_claims or {})
    payload["sub"] = normalize_subject(subject)
    payload["exp"] = expires_at

    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if not isinstance(payload, dict):
            raise RuntimeError("Invalid token payload")
        return payload
    except ExpiredSignatureError as exc:
        raise RuntimeError("Token expired") from exc
    except JWTError as exc:
        raise RuntimeError("Invalid token") from exc


def get_token_subject(payload: dict[str, Any]) -> str:
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise RuntimeError("Token subject is missing")
    return normalize_subject(subject)
