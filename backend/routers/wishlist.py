from fastapi import APIRouter, Depends, HTTPException, Security
from sqlmodel import Session, select
from database import engine
from models import Product, Wishlist
from security import bearer_scheme
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt, JWTError

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])

SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"

def get_session():
    with Session(engine) as session:
        yield session

def get_user_email(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/my")
def my_wishlist(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    email = get_user_email(token.credentials)

    items = session.exec(
        select(Wishlist).where(Wishlist.user_email == email)
    ).all()

    product_ids = [i.product_id for i in items]
    if not product_ids:
        return []

    products = session.exec(
        select(Product).where(Product.id.in_(product_ids))
    ).all()

    id_to_product = {p.id: p for p in products}
    ordered = [id_to_product.get(pid) for pid in product_ids if id_to_product.get(pid)]
    return ordered

@router.post("/add/{product_id}")
def add_to_wishlist(
    product_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    email = get_user_email(token.credentials)

    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = session.exec(
        select(Wishlist).where(
            Wishlist.user_email == email,
            Wishlist.product_id == product_id
        )
    ).first()

    if existing:
        return {"message": "Already in wishlist"}

    item = Wishlist(user_email=email, product_id=product_id)
    session.add(item)
    session.commit()
    return {"message": "Added to wishlist"}

@router.delete("/remove/{product_id}")
def remove_from_wishlist(
    product_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    email = get_user_email(token.credentials)

    existing = session.exec(
        select(Wishlist).where(
            Wishlist.user_email == email,
            Wishlist.product_id == product_id
        )
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Not in wishlist")

    session.delete(existing)
    session.commit()
    return {"message": "Removed from wishlist"}