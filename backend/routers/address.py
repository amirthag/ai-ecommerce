from fastapi import APIRouter, Depends, Security, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session, select
from jose import jwt, JWTError

from database import engine
from models import Address
from security import bearer_scheme

SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

def get_user_email(token: str):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Token missing sub")
    return email

@router.get("/my")
def my_addresses(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    return session.exec(
        select(Address).where(Address.user_email == email).order_by(Address.created_at.desc())
    ).all()

@router.post("/add")
def add_address(
    body: dict,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    required = ["full_name", "phone", "line1", "city", "state", "pincode"]
    for k in required:
        if not (body.get(k) or "").strip():
            raise HTTPException(status_code=400, detail=f"{k} is required")

    addr = Address(
        user_email=email,
        full_name=body["full_name"].strip(),
        phone=body["phone"].strip(),
        line1=body["line1"].strip(),
        city=body["city"].strip(),
        state=body["state"].strip(),
        pincode=body["pincode"].strip(),
    )
    session.add(addr)
    session.commit()
    session.refresh(addr)
    return addr

@router.delete("/delete/{address_id}")
def delete_address(
    address_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    addr = session.get(Address, address_id)
    if not addr or addr.user_email != email:
        raise HTTPException(status_code=404, detail="Address not found")

    session.delete(addr)
    session.commit()
    return {"message": "Address deleted"}