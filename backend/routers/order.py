from fastapi import APIRouter, Depends, Security, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session, select
from database import engine
from models import Cart, Order, Product, OrderItem, Address  # ✅ Address added
from security import bearer_scheme
from jose import jwt, JWTError

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


@router.post("/place")
def place_order(
    payment_method: str = "COD",
    address_id: int = 0,  # ✅ NEW (required)
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        user_email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # ✅ Validate address
    if address_id <= 0:
        raise HTTPException(status_code=400, detail="Address is required")


    addr = session.get(Address, address_id)
    if not addr or addr.user_email != user_email:
        raise HTTPException(status_code=400, detail="Invalid address")

    cart_items = session.exec(
        select(Cart).where(Cart.user_email == user_email)
    ).all()

    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # ✅ 1) Validate stock first (before creating order)
    for item in cart_items:
        product = session.get(Product, item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="A product in cart was deleted")
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {product.name}"
            )

    try:
        # ✅ 2) Create order
        order = Order(
            user_email=user_email,
            total_amount=0,
            payment_method=payment_method,
            payment_status="PENDING" if payment_method == "RAZORPAY" else "COD",
            status="Placed",
            address_id=address_id,  # ✅ NEW
        )
        session.add(order)
        session.commit()
        session.refresh(order)

        total = 0

        # ✅ 3) Create items, reduce stock, clear cart
        for item in cart_items:
            product = session.get(Product, item.product_id)

            total += float(product.price) * int(item.quantity)

            session.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=item.quantity,
            ))

            product.stock -= item.quantity
            session.add(product)

            session.delete(item)

        # ✅ 4) Save final total
        order.total_amount = total
        session.add(order)
        session.commit()
        session.refresh(order)

        return {
            "message": "Order placed",
            "order_id": order.id,
            "total": total,
            "address_id": address_id,  # ✅ helpful in frontend
        }

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Order failed: {str(e)}")


@router.get("/my")
def my_orders(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        user_email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    orders = session.exec(
        select(Order)
        .where(Order.user_email == user_email)
        .order_by(Order.created_at.desc())
    ).all()

    return orders


@router.get("/details/{order_id}")
def order_details(
    order_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        user_email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    order = session.get(Order, order_id)
    if not order or order.user_email != user_email:
        raise HTTPException(status_code=404, detail="Order not found")

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()

    result = []
    for item in items:
        product = session.get(Product, item.product_id)
        if not product:
            result.append({
                "name": f"Deleted product (ID: {item.product_id})",
                "price": 0,
                "quantity": item.quantity
            })
            continue

        result.append({
            "name": product.name,
            "price": product.price,
            "quantity": item.quantity
        })

    return result


@router.put("/status/{order_id}")
def update_order_status(
    order_id: int,
    status: str,
    session: Session = Depends(get_session),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"]
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")

    order.status = status
    session.add(order)
    session.commit()
    session.refresh(order)
    return {"message": "Status updated", "order": order}


@router.delete("/delete/{order_id}")
def delete_order(
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

    items = session.exec(
        select(OrderItem).where(OrderItem.order_id == order_id)
    ).all()

    for item in items:
        session.delete(item)

    session.delete(order)
    session.commit()

    return {"message": "Order deleted successfully"}


@router.put("/cancel/{order_id}")
def cancel_order(
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

    blocked = ["Shipped", "Delivered"]
    if (order.status or "").strip() in blocked:
        raise HTTPException(status_code=400, detail=f"Cannot cancel after {order.status}")

    if (order.status or "").strip() == "Cancelled":
        return {"message": "Order already cancelled"}

    if (order.payment_status or "").strip().upper() == "PAID":
        raise HTTPException(status_code=400, detail="Paid orders cannot be cancelled (demo rule)")

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()

    for it in items:
        product = session.get(Product, it.product_id)
        if product:
            product.stock += int(it.quantity)
            session.add(product)

    order.status = "Cancelled"
    order.payment_status = "CANCELLED" if order.payment_method == "RAZORPAY" else order.payment_status
    session.add(order)
    session.commit()
    session.refresh(order)

    return {"message": "Order cancelled and stock restored", "order_id": order.id}

@router.post("/buy-now/{product_id}")
def buy_now(
    product_id: int,
    qty: int = 1,
    payment_method: str = "COD",
    address_id: int = 0,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    try:
        user_email = get_user_email(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    if address_id <= 0:
        raise HTTPException(status_code=400, detail="Address is required")

    addr = session.get(Address, address_id)
    if not addr or addr.user_email != user_email:
        raise HTTPException(status_code=400, detail="Invalid address")

    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock < qty:
        raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")

    try:
        total = float(product.price) * int(qty)

        order = Order(
            user_email=user_email,
            total_amount=total,
            payment_method=payment_method,
            payment_status="PENDING" if payment_method == "RAZORPAY" else "UNPAID",
            status="Placed",
            address_id=address_id,
        )
        session.add(order)
        session.commit()
        session.refresh(order)

        session.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=qty,
        ))

        product.stock -= qty
        session.add(product)

        session.commit()
        session.refresh(order)

        return {
            "message": "Buy now order placed",
            "order_id": order.id,
            "total": total,
            "address_id": address_id,
        }

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Buy now failed: {str(e)}")