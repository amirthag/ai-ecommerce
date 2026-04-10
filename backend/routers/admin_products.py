from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session, select
from database import engine
from models import Product, ProductCreate, User
from security import bearer_scheme
from jose import jwt, JWTError
from auth import SECRET_KEY, ALGORITHM

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session

def get_admin_email(token_str: str, session: Session) -> str:
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")

        user = session.exec(select(User).where(User.email == email)).first()
        if not user or user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin only")

        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/add")
def admin_add_product(
    product: ProductCreate,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    get_admin_email(token.credentials, session)
    p = Product(**product.dict())
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"message": "Product added", "product": p}

@router.put("/update/{product_id}")
def admin_update_product(
    product_id: int,
    product: ProductCreate,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    get_admin_email(token.credentials, session)

    existing = session.get(Product, product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    existing.name = product.name
    existing.description = product.description
    existing.price = product.price
    existing.stock = product.stock
    existing.image = product.image
    existing.category = product.category
    existing.brand = product.brand
    existing.sub_category = product.sub_category
    existing.tags = product.tags
    session.commit()
    session.refresh(existing)
    return {"message": "Product updated", "product": existing}

@router.delete("/delete/{product_id}")
def admin_delete_product(
    product_id: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    get_admin_email(token.credentials, session)

    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    session.delete(p)
    session.commit()
    return {"message": "Product deleted"}

@router.put("/stock/{product_id}")
def update_stock(
    product_id: int,
    stock: int,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    get_admin_email(token.credentials, session)

    if stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")

    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    p.stock = stock
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"message": "Stock updated", "product": p}

@router.get("/low-stock")
def low_stock(
    threshold: int = 5,
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    get_admin_email(token.credentials, session)
    items = session.exec(select(Product).where(Product.stock <= threshold)).all()
    return items