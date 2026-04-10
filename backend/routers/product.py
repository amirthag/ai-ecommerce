from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import engine
from models import Product, ProductCreate
from fastapi import HTTPException

router = APIRouter()

def get_session():
    with Session(engine) as session:
        yield session


# ➕ Add Product (Admin)
@router.post("/add")
def add_product(product: ProductCreate, session: Session = Depends(get_session)):
    new_product = Product(**product.dict())
    session.add(new_product)
    session.commit()
    session.refresh(new_product)
    return {"message": "Product added", "product": new_product}


# 📋 Get All Products (User side)
@router.get("/all")
def get_products(session: Session = Depends(get_session)):
    products = session.exec(select(Product)).all()
    return products

# 🔍 Get single product
@router.get("/{product_id}")
def get_product(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    return product

# ✏️ Update product
@router.put("/update/{product_id}")
def update_product(
    product_id: int,
    product: ProductCreate,
    session: Session = Depends(get_session),
):
    existing = session.get(Product, product_id)

    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    existing.name = product.name
    existing.description = product.description
    existing.price = product.price
    existing.stock = product.stock
    existing.image = product.image
    existing.category = product.category   # ✅ IMPORTANT

    session.commit()
    session.refresh(existing)

    return {"message": "Product updated", "product": existing}
@router.delete("/delete/{product_id}")
def delete_product(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    session.delete(product)
    session.commit()
    return {"message": "Product deleted"}
