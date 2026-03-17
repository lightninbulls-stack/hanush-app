from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from db import get_async_db
from models.user import User
from auth import hash_password, verify_password, create_access_token

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str





@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_async_db)):
    stmt = select(User).where(User.email == body.email)
    result = await db.execute(stmt)
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password)
    )
    db.add(user)
    await db.commit()
    return {"msg": "User registered successfully"}


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_async_db)):
    stmt = select(User).where(User.email == body.email)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}