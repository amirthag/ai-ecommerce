from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlmodel import Session, select
from database import engine
from models import Cart, Product
from security import bearer_scheme

SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"

router = APIRouter()


def get_session():
    with Session(engine) as session:
        yield session


def get_user_email(token_str: str) -> str:
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/add/{product_id}")
def add_to_cart(
    product_id: int,
    qty: int = 1,  # ✅ NEW
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    user_email = get_user_email(token.credentials)

    if qty <= 0:
        raise HTTPException(status_code=400, detail="qty must be > 0")

    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = session.exec(
        select(Cart).where(
            Cart.user_email == user_email,
            Cart.product_id == product_id,
        )
    ).first()

    if existing:
        existing.quantity += qty   # ✅ add qty
        session.add(existing)
    else:
        session.add(Cart(user_email=user_email, product_id=product_id, quantity=qty))  # ✅ qty

    session.commit()
    return {"message": "Added to cart", "qty": qty}


@router.delete("/remove/{cart_id}")
def remove_from_cart(
    cart_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    user_email = get_user_email(token.credentials)

    item = session.get(Cart, cart_id)
    if item and item.user_email == user_email:
        session.delete(item)
        session.commit()
        return {"message": "Item removed"}

    raise HTTPException(status_code=404, detail="Item not found")


@router.put("/update/{cart_id}/{qty}")
def update_quantity(
    cart_id: int,
    qty: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be > 0")

    user_email = get_user_email(token.credentials)

    item = session.get(Cart, cart_id)
    if item and item.user_email == user_email:
        item.quantity = qty
        session.commit()
        return {"message": "Quantity updated"}

    raise HTTPException(status_code=404, detail="Item not found")


@router.get("/my")
def view_cart(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    user_email = get_user_email(token.credentials)

    cart_items = session.exec(
        select(Cart).where(Cart.user_email == user_email)
    ).all()

    result = []
    for item in cart_items:
        product = session.get(Product, item.product_id)
        if not product:
            continue

        result.append({
            "cart_id": item.id,
            "product_id": product.id,
            "name": product.name,
            "description": product.description,
            "price": product.price,
            "image": product.image,
            "quantity": item.quantity
        })

    return result
