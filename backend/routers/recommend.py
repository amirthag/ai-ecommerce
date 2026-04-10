# backend/routers/recommend.py
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlmodel import Session, select
import numpy as np

from sentence_transformers import SentenceTransformer

from database import engine
from models import Product, Cart, Order, OrderItem
from security import bearer_scheme

SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"

router = APIRouter()

# ---------- DB session ----------
def get_session():
    with Session(engine) as session:
        yield session

# ---------- auth ----------
def get_user_email(token_str: str) -> str:
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------- Embedding model (loads once) ----------
_model = SentenceTransformer("all-MiniLM-L6-v2")

# ---------- Simple in-memory cache ----------
_cache = {
    "product_ids": [],
    "embeddings": None,   # shape: (N, D)
    "count": 0,
}

def _build_embeddings(products):
    texts = []
    ids = []
    for p in products:
        t = f"{p.name} {p.description}".strip()
        texts.append(t)
        ids.append(p.id)
    emb = _model.encode(texts, normalize_embeddings=True)  # normalized vectors
    return ids, np.array(emb, dtype=np.float32)

def _ensure_cache(session: Session):
    products = session.exec(select(Product)).all()
    if len(products) == 0:
        _cache["product_ids"] = []
        _cache["embeddings"] = None
        _cache["count"] = 0
        return

    # rebuild cache if product count changed (simple & reliable)
    if _cache["embeddings"] is None or _cache["count"] != len(products):
        ids, emb = _build_embeddings(products)
        _cache["product_ids"] = ids
        _cache["embeddings"] = emb
        _cache["count"] = len(products)

def _top_k_similar(target_vec, k=6, exclude_id=None):
    if _cache["embeddings"] is None or len(_cache["product_ids"]) == 0:
        return []

    # cosine similarity because vectors are normalized: dot = cosine
    sims = _cache["embeddings"] @ target_vec

    # remove itself
    if exclude_id is not None and exclude_id in _cache["product_ids"]:
        idx = _cache["product_ids"].index(exclude_id)
        sims[idx] = -1e9

    # top-k indices
    k = min(k, len(sims))
    top_idx = np.argsort(-sims)[:k]
    top_ids = [_cache["product_ids"][i] for i in top_idx]
    return top_ids


# ✅ 1) Similar products (based on product embedding)
@router.get("/similar/{product_id}")
def similar_products(product_id: int, session: Session = Depends(get_session)):
    _ensure_cache(session)

    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    text = f"{product.name} {product.description}".strip()
    vec = _model.encode([text], normalize_embeddings=True)[0].astype(np.float32)

    ids = _top_k_similar(vec, k=6, exclude_id=product_id)

    if not ids:
        return []

    # fetch and keep order
    products = session.exec(select(Product).where(Product.id.in_(ids))).all()
    prod_map = {p.id: p for p in products}
    return [prod_map[i] for i in ids if i in prod_map]


# ✅ 2) Personalized recommendations ("For You")
@router.get("/for-you")
def for_you(
    token: HTTPAuthorizationCredentials = Security(bearer_scheme),
    session: Session = Depends(get_session),
):
    _ensure_cache(session)

    user_email = get_user_email(token.credentials)

    # collect user's signals: cart items + previous orders
    cart_items = session.exec(select(Cart).where(Cart.user_email == user_email)).all()
    cart_product_ids = [c.product_id for c in cart_items]

    orders = session.exec(select(Order).where(Order.user_email == user_email)).all()
    order_ids = [o.id for o in orders]
    order_items = []
    if order_ids:
        order_items = session.exec(
            select(OrderItem).where(OrderItem.order_id.in_(order_ids))
        ).all()
    bought_product_ids = [oi.product_id for oi in order_items]

    signal_ids = list(dict.fromkeys(cart_product_ids + bought_product_ids))  # unique, keep order

    # if no history -> return top priced / newest fallback (simple)
    if not signal_ids:
        fallback = session.exec(select(Product).limit(8)).all()
        return fallback

    # average embedding of signal products
    # make sure we have these embeddings in cache
    vecs = []
    for pid in signal_ids:
        if pid in _cache["product_ids"]:
            idx = _cache["product_ids"].index(pid)
            vecs.append(_cache["embeddings"][idx])

    if not vecs:
        fallback = session.exec(select(Product).limit(8)).all()
        return fallback

    user_vec = np.mean(np.stack(vecs, axis=0), axis=0)
    # normalize
    user_vec = user_vec / (np.linalg.norm(user_vec) + 1e-9)

    # exclude products already in signals
    rec_ids = _top_k_similar(user_vec.astype(np.float32), k=10, exclude_id=None)
    rec_ids = [i for i in rec_ids if i not in signal_ids][:8]

    if not rec_ids:
        fallback = session.exec(select(Product).limit(8)).all()
        return fallback

    products = session.exec(select(Product).where(Product.id.in_(rec_ids))).all()
    prod_map = {p.id: p for p in products}
    return [prod_map[i] for i in rec_ids if i in prod_map]


# (Optional) manual cache rebuild endpoint (useful after adding many products)
@router.post("/rebuild")
def rebuild(session: Session = Depends(get_session)):
    products = session.exec(select(Product)).all()
    if not products:
        _cache["product_ids"] = []
        _cache["embeddings"] = None
        _cache["count"] = 0
        return {"message": "No products to embed"}

    ids, emb = _build_embeddings(products)
    _cache["product_ids"] = ids
    _cache["embeddings"] = emb
    _cache["count"] = len(products)
    return {"message": "Rebuilt embeddings", "products": len(products)}
