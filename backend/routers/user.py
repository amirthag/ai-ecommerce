# backend/routers/user.py
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session, select
from jose import jwt, JWTError
import re

from database import engine
from models import User, UserCreate, UserLogin
from auth import hash_password, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from security import bearer_scheme

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long"
        )

    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one uppercase letter"
        )

    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one lowercase letter"
        )

    if not re.search(r"\d", password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one number"
        )

    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=/\\[\]]", password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one special character"
        )

# ✅ Get current logged-in user
@router.get("/me")
def me(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "is_admin": user.role == "admin",
        "is_staff": user.role == "staff",
    }

@router.post("/signup")
def signup(user: UserCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == user.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    validate_password(user.password)

    hashed = hash_password(user.password)

    new_user = User(
        username=user.username,
        email=user.email,
        password=hashed,
        role="user"
    )

    session.add(new_user)
    session.commit()

    return {"message": "User created successfully"}

@router.post("/login")
def login(data: UserLogin, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.email)).first()

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token(user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
    }

@router.put("/change-password")
def change_password(
    body: dict,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    old_password = body.get("old_password")
    new_password = body.get("new_password")

    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="old_password and new_password required")

    validate_password(new_password)

    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(old_password, user.password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    user.password = hash_password(new_password)
    session.add(user)
    session.commit()

    return {"message": "Password updated successfully"}