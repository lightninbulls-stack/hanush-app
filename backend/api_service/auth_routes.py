from __future__ import annotations

import csv
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    decode_access_token,
    get_token_subject,
    hash_password,
    verify_password,
)
from db import SessionLocal
from models.user import User

router = APIRouter(tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)

EXPORT_FILE = Path(__file__).resolve().parents[1] / "data" / "user_activity.csv"
CSV_FIELDS = [
    "id",
    "name",
    "email",
    "phone",
    "created_at",
    "last_login_at",
    "login_count",
]


class RegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: str


class LoginRequest(BaseModel):
    phone: str
    password: str


class ResetPasswordRequest(BaseModel):
    phone: str
    email: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    email: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_email(email: str) -> str:
    value = email.strip().lower()
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required",
        )

    if "@" not in value or "." not in value.split("@")[-1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid email is required",
        )

    return value


def normalize_phone(phone: str) -> str:
    value = "".join(ch for ch in phone if ch.isdigit())
    if len(value) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid phone number is required",
        )
    return value


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_user_activity_rows() -> list[dict[str, str]]:
    if not EXPORT_FILE.exists():
        return []

    with EXPORT_FILE.open("r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        return list(reader)


def save_user_activity_rows(rows: list[dict[str, str]]) -> None:
    EXPORT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with EXPORT_FILE.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def upsert_user_activity(user: User, *, is_login: bool) -> None:
    rows = load_user_activity_rows()
    now_iso = utc_now_iso()

    target_index = None
    for idx, row in enumerate(rows):
        if str(row.get("id", "")).strip() == str(user.id):
            target_index = idx
            break

    created_at = user.created_at.isoformat() if user.created_at else ""
    existing_login_count = 0
    existing_last_login_at = ""

    if target_index is not None:
        existing_row = rows[target_index]
        try:
            existing_login_count = int(existing_row.get("login_count", "0") or 0)
        except ValueError:
            existing_login_count = 0
        existing_last_login_at = existing_row.get("last_login_at", "") or ""

    updated_row = {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "created_at": created_at,
        "last_login_at": now_iso if is_login else existing_last_login_at,
        "login_count": str(existing_login_count + 1 if is_login else existing_login_count),
    }

    if target_index is not None:
        rows[target_index] = updated_row
    else:
        if is_login:
            updated_row["last_login_at"] = now_iso
            updated_row["login_count"] = "1"
        rows.append(updated_row)

    save_user_activity_rows(rows)


def get_current_email(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        payload = decode_access_token(credentials.credentials)
        return get_token_subject(payload)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


def get_current_user(
    current_email: str = Depends(get_current_email),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.email == current_email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    phone = normalize_phone(body.phone)
    name = body.name.strip()

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required",
        )

    if not body.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required",
        )

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_phone = db.query(User).filter(User.phone == phone).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered",
        )

    new_user = User(
        name=name,
        email=email,
        phone=phone,
        hashed_password=hash_password(body.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    upsert_user_activity(new_user, is_login=False)

    return {
        "message": "User registered successfully",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "phone": new_user.phone,
        },
    }


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(body.phone)

    user = db.query(User).filter(User.phone == phone).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    upsert_user_activity(user, is_login=True)

    token = create_access_token(subject=user.email)
    return TokenResponse(access_token=token)


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(body.phone)
    email = normalize_email(body.email)
    new_password = body.new_password.strip()

    if len(new_password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters",
        )

    user = (
        db.query(User)
        .filter(
            User.phone == phone,
            User.email == email,
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with this phone number and email",
        )

    user.hashed_password = hash_password(new_password)
    db.commit()

    return {
        "message": "Password reset successfully. Please login with your new password."
    }


@router.get("/me", response_model=MeResponse)
def me(current_email: str = Depends(get_current_email)):
    return MeResponse(email=current_email)


@router.get("/users")
def list_registered_users(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    activity_rows = load_user_activity_rows()

    activity_map: dict[str, dict[str, str]] = {
        str(row.get("id", "")).strip(): row for row in activity_rows
    }

    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": activity_map.get(str(user.id), {}).get("last_login_at") or None,
            "login_count": int(activity_map.get(str(user.id), {}).get("login_count") or 0),
        }
        for user in users
    ]


@router.get("/users/export.csv")
def export_registered_users_csv(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    activity_rows = load_user_activity_rows()

    activity_map: dict[str, dict[str, str]] = {
        str(row.get("id", "")).strip(): row for row in activity_rows
    }

    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
    writer.writeheader()

    for user in users:
        activity = activity_map.get(str(user.id), {})
        writer.writerow(
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "phone": user.phone,
                "created_at": user.created_at.isoformat() if user.created_at else "",
                "last_login_at": activity.get("last_login_at", ""),
                "login_count": activity.get("login_count", "0"),
            }
        )

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="registered_users.csv"'
        },
    )


