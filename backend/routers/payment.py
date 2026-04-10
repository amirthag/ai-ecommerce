from fastapi import APIRouter, Depends, HTTPException, Security
from sqlmodel import Session
from database import engine
from models import Order
from security import bearer_scheme
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt, JWTError
import razorpay
from dotenv import load_dotenv
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")

load_dotenv(env_path)

router = APIRouter()

SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"


def get_session():
    with Session(engine) as session:
        yield session


def get_user_email(token: str):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload.get("sub")


# ✅ Create client safely (keys trimmed + validated)
def get_rp_client():
    key = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
    secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()

    # ✅ Debug (optional) - remove later
    print("KEY=", key)
    print("SECRET_LOADED=", bool(secret))

    if not key or not secret:
        raise HTTPException(status_code=500, detail="Razorpay keys not loaded from .env")

    return razorpay.Client(auth=(key, secret))


# ---------------------------
# VERIFY PAYMENT
# ---------------------------
@router.post("/razorpay/verify")
def verify_payment(
    data: dict,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        user_email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    client = get_rp_client()

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": data["razorpay_order_id"],
            "razorpay_payment_id": data["razorpay_payment_id"],
            "razorpay_signature": data["razorpay_signature"],
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    order = session.get(Order, data["app_order_id"])
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_email != user_email:
        raise HTTPException(status_code=403, detail="Not your order")

    order.payment_method = "RAZORPAY"
    order.payment_status = "PAID"
    order.payment_ref = data["razorpay_payment_id"]
    order.status = "Processing"

    session.add(order)
    session.commit()
    session.refresh(order)

    return {"message": "Payment verified successfully"}


# ---------------------------
# CREATE RAZORPAY ORDER
# ---------------------------
@router.post("/razorpay/create-order/{order_id}")
def create_razorpay_order(
    order_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        user_email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_email != user_email:
        raise HTTPException(status_code=403, detail="Not your order")

    amount_paise = int(float(order.total_amount) * 100)
    if amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Invalid order amount")
    if (order.payment_status or "").upper() == "PAID":
        raise HTTPException(status_code=400, detail="Order already paid")

    client = get_rp_client()

    try:
        rp_order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {"order_id": str(order.id), "user_email": user_email},
        })
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to connect to Razorpay right now. Please try again or use Cash on Delivery."
        )
    order.payment_method = "RAZORPAY"
    order.payment_status = "PENDING"
    order.payment_ref = rp_order["id"]
    session.add(order)
    session.commit()

    return {
        "app_order_id": order.id,
        "razorpay_order_id": rp_order["id"],
        "amount": rp_order["amount"],
        "currency": rp_order["currency"],
        "key_id": (os.getenv("RAZORPAY_KEY_ID") or "").strip(),
    }
