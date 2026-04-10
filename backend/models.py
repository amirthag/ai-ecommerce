from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

# ----------- DB TABLE -----------

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    email: str
    password: str
    role: str = Field(default="user")   # user / admin / staff


# ----------- REQUEST SCHEMAS -----------

class UserCreate(SQLModel):
    username: str
    email: str
    password: str


class UserLogin(SQLModel):
    email: str
    password: str


# ----------- PRODUCT TABLE -----------

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str
    price: float
    stock: int
    image: str
    category: str = Field(default="Electronics")

    brand: str = Field(default="")
    sub_category: str = Field(default="")
    tags: str = Field(default="")   # comma-separated tags


class ProductCreate(SQLModel):
    name: str
    description: str
    price: float
    stock: int
    image: str
    category: str = "Electronics"

    brand: str = ""
    sub_category: str = ""
    tags: str = ""

# ----------- CART TABLE -----------

class Cart(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_email: str
    product_id: int = Field(foreign_key="product.id")
    quantity: int = 1


# ----------- ORDER TABLE -----------

class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_email: str
    total_amount: float
    status: str = Field(default="Placed")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    payment_method: str | None = None
    payment_status: str | None = None
    payment_ref: str | None = None

    address_id: Optional[int] = Field(default=None, foreign_key="address.id")


# ----------- ORDER ITEMS TABLE -----------

class OrderItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id")
    product_id: int = Field(foreign_key="product.id")
    quantity: int


class Wishlist(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_email: str = Field(index=True)
    product_id: int = Field(foreign_key="product.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Address(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_email: str = Field(index=True)

    full_name: str
    phone: str
    line1: str
    city: str
    state: str = ""
    pincode: str

    created_at: datetime = Field(default_factory=datetime.utcnow)
