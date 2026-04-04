from datetime import datetime, timedelta
import os

import bcrypt
from jose import jwt

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def _get_jwt_secret() -> str:
    """
    Read the JWT signing secret from environment.

    Supports both JWT_SECRET and SECRET_KEY so deployment stays flexible
    across Render and Cloudflare.
    """
    secret = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError(
            "JWT secret is not configured. Set JWT_SECRET or SECRET_KEY."
        )
    return secret


SECRET_KEY = _get_jwt_secret()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
