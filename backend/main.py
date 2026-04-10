from dotenv import load_dotenv
load_dotenv(".env")


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from database import create_db_and_tables, engine

from routers import user, product, cart, order, search, recommend, payment, admin_products, admin_orders, admin_analytics, address
import os
from routers.wishlist import router as wishlist_router

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:8000",
]
# ✅ CORS (VERY IMPORTANT for React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    create_db_and_tables()

app.include_router(user.router, prefix="/user", tags=["User"])
app.include_router(product.router, prefix="/product", tags=["Product"])
app.include_router(cart.router, prefix="/cart", tags=["Cart"])
app.include_router(order.router, prefix="/order", tags=["Order"])
app.include_router(search.router)
app.include_router(recommend.router, prefix="/recommend", tags=["Recommend"])
app.include_router(payment.router, prefix="/payment", tags=["payment"])
app.include_router(admin_products.router, prefix="/admin/products", tags=["Admin Products"])
app.include_router(admin_orders.router, prefix="/admin/orders", tags=["Admin Orders"])
app.include_router(admin_analytics.router, prefix="/admin/analytics", tags=["Admin Analytics"])
app.include_router(address.router, prefix="/address", tags=["Address"])
app.include_router(wishlist_router)
@app.get("/")
def home():
    return {"message": "AI E-commerce Backend Running"}
