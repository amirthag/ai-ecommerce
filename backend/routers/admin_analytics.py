from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session, select
from sqlalchemy import func
from database import engine
from models import Order, OrderItem, Product, User
from security import bearer_scheme
from jose import jwt, JWTError
from auth import SECRET_KEY, ALGORITHM

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

def ensure_admin(token_str: str, session: Session):
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")

        user = session.exec(select(User).where(User.email == email)).first()
        if not user or user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/summary")
def summary(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    ensure_admin(token.credentials, session)

    users_count = session.exec(select(func.count()).select_from(User)).one()
    orders_count = session.exec(select(func.count()).select_from(Order)).one()

    sales = session.exec(
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.payment_status == "PAID")
    ).one()

    return {
        "users": int(users_count),
        "orders": int(orders_count),
        "sales_paid": float(sales),
    }

@router.get("/top-products")
def top_products(
    limit: int = 5,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    ensure_admin(token.credentials, session)

    rows = session.exec(
        select(
            OrderItem.product_id,
            func.sum(OrderItem.quantity).label("qty")
        )
        .group_by(OrderItem.product_id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    ).all()

    result = []
    for product_id, qty in rows:
        p = session.get(Product, product_id)
        result.append({
            "product_id": product_id,
            "name": p.name if p else "Deleted product",
            "quantity_sold": int(qty),
        })

    return result