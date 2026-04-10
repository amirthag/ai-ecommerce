from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session, select
from database import engine
from models import Order, OrderItem, Product, User
from security import bearer_scheme
from jose import jwt, JWTError
from auth import SECRET_KEY, ALGORITHM

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

def ensure_staff_or_admin(token_str: str, session: Session):
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")

        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.role not in ["admin", "staff"]:
            raise HTTPException(status_code=403, detail="Staff or Admin only")

        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/all")
def all_orders(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    ensure_staff_or_admin(token.credentials, session)
    return session.exec(select(Order).order_by(Order.created_at.desc())).all()

@router.get("/details/{order_id}")
def admin_order_details(
    order_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    ensure_staff_or_admin(token.credentials, session)

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()
    result = []
    for it in items:
        p = session.get(Product, it.product_id)
        result.append({
            "product_id": it.product_id,
            "name": p.name if p else "Deleted product",
            "price": float(p.price) if p else 0,
            "quantity": it.quantity,
        })
    return result

@router.put("/status/{order_id}")
def admin_update_status(
    order_id: int,
    status: str,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    ensure_staff_or_admin(token.credentials, session)

    allowed = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"]
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status
    session.add(order)
    session.commit()
    session.refresh(order)

    return {"message": "Status updated", "order": order}