from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from sqlalchemy import func, or_
from database import engine
from models import Product
import re
import numpy as np
from sentence_transformers import SentenceTransformer

router = APIRouter()

def get_db():
    with Session(engine) as session:
        yield session

_model = SentenceTransformer("all-MiniLM-L6-v2")

_cache = {"id_to_vec": {}, "count": 0}

# -----------------------------
# Text helpers
# -----------------------------
def normalize_text(text: str) -> str:
    return " ".join((text or "").lower().split())

STOPWORDS = {
    "best","good","buy","for","with","and","or","the","a","an","to","of",
    "in","on","at","my","me","you","your","need","want","show","please",
    "under","below","less","than","above","over","greater","between",
    "range","price","budget","cheap","cost","rs","₹"
}

# words that are useful, but should not dominate search
WEAK_TOKENS = {"set", "combo", "pack", "kit", "piece"}

def tokenize(text: str) -> list[str]:
    toks = re.findall(r"[a-z0-9]+", normalize_text(text))
    out = []
    for t in toks:
        if t in STOPWORDS:
            continue
        if t.isdigit():
            continue
        if len(t) > 3 and t.endswith("s"):
            t = t[:-1]
        out.append(t)
    return out

def clean_query(q: str) -> str:
    toks = tokenize(q)
    return " ".join(toks)

def important_tokens(q_tokens: list[str]) -> list[str]:
    return [t for t in q_tokens if t not in WEAK_TOKENS]

# -----------------------------
# Price filters
# -----------------------------
def extract_price_filters(q: str):
    q = (q or "").lower()

    m = re.search(r"(\d+)\s*-\s*(\d+)", q)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return ("range", min(a, b), max(a, b))

    m = re.search(r"(under|below|less than)\s*(\d+)", q)
    if m:
        return ("max", int(m.group(2)))

    m = re.search(r"(above|over|greater than)\s*(\d+)", q)
    if m:
        return ("min", int(m.group(2)))

    m = re.search(r"\b(\d{4,})\b", q)
    if m:
        return ("near", int(m.group(1)))

    return None

def _passes_price_filter(price_filter, price: float) -> bool:
    if not price_filter:
        return True
    kind = price_filter[0]
    if kind == "range":
        lo, hi = price_filter[1], price_filter[2]
        return lo <= price <= hi
    if kind == "max":
        return price <= price_filter[1]
    if kind == "min":
        return price >= price_filter[1]
    if kind == "near":
        target = price_filter[1]
        return abs(price - target) <= 20000
    return True

def _price_bonus(price_filter, price: float) -> float:
    if not price_filter:
        return 0.0
    kind = price_filter[0]
    if kind in ("range", "max", "min"):
        return 8.0
    if kind == "near":
        target = price_filter[1]
        diff = abs(price - target)
        return max(0.0, 10.0 - (diff / 1500.0))
    return 0.0

# -----------------------------
# Match helpers
# -----------------------------
def product_text(p: Product) -> str:
    return normalize_text(
        f"{p.name} "
        f"{p.description} "
        f"{getattr(p, 'category', '')} "
        f"{getattr(p, 'brand', '')} "
        f"{getattr(p, 'sub_category', '')} "
        f"{getattr(p, 'tags', '')}"
    )

def token_overlap_score(q_tokens: list[str], p: Product) -> tuple[int, int]:
    txt = product_text(p)
    name = normalize_text(p.name)
    cat = normalize_text(getattr(p, "category", "") or "")

    matched = 0
    name_matches = 0

    for t in q_tokens:
        if t in txt or t in cat:
            matched += 1
        if t in name:
            name_matches += 1

    return matched, name_matches

def keyword_score(q_tokens: list[str], p: Product) -> float:
    name = normalize_text(p.name)
    desc = normalize_text(p.description)
    cat = normalize_text(getattr(p, "category", "") or "")
    brand = normalize_text(getattr(p, "brand", "") or "")
    sub_cat = normalize_text(getattr(p, "sub_category", "") or "")
    tags = normalize_text(getattr(p, "tags", "") or "")
    q_phrase = " ".join(q_tokens).strip()

    score = 0.0

    for t in q_tokens:
        mult = 0.4 if t in WEAK_TOKENS else 1.0

        if t and t in name:
            score += 20 * mult
        if t and t in sub_cat:
            score += 18 * mult
        if t and t in cat:
            score += 14 * mult
        if t and t in brand:
            score += 12 * mult
        if t and t in tags:
            score += 12 * mult
        if t and t in desc:
            score += 6 * mult

    if q_phrase:
        if q_phrase == name:
            score += 80
        elif q_phrase in name:
            score += 40

        if q_phrase == sub_cat:
            score += 35
        elif q_phrase in sub_cat:
            score += 25

        if q_phrase == cat:
            score += 30
        elif q_phrase in cat:
            score += 18

        if q_phrase in brand:
            score += 15

        if q_phrase in tags:
            score += 18

        if q_phrase in desc:
            score += 10

    matched, name_matches = token_overlap_score(q_tokens, p)
    score += matched * 8
    score += name_matches * 10

    # require better overlap for multi-word queries
    if len(q_tokens) >= 2:
        if matched == 0:
            score -= 100
        elif matched == 1:
            score -= 25

    return score

# -----------------------------
# Cache
# -----------------------------
def rebuild_cache(db: Session):
    products = db.exec(select(Product).order_by(Product.id)).all()
    if not products:
        _cache["id_to_vec"] = {}
        _cache["count"] = 0
        return

    texts = [
        f"{p.name} {p.description} {getattr(p,'category','')} "
        f"{getattr(p,'brand','')} {getattr(p,'sub_category','')} {getattr(p,'tags','')}".strip()
        for p in products
    ]

    vecs = _model.encode(texts, normalize_embeddings=True)
    _cache["id_to_vec"] = {
        products[i].id: np.array(vecs[i], dtype=np.float32)
        for i in range(len(products))
    }
    _cache["count"] = len(products)

def ensure_cache(db: Session):
    count_now = db.exec(select(func.count(Product.id))).one()
    if _cache["count"] != int(count_now) or not _cache["id_to_vec"]:
        rebuild_cache(db)

# -----------------------------
# SQL keyword search
# -----------------------------
def sql_keyword_candidates(db: Session, q_tokens: list[str], limit: int = 300) -> list[Product]:
    if not q_tokens:
        return []

    conditions = []
    for t in q_tokens:
        conditions.append(func.lower(Product.name).contains(t))
        conditions.append(func.lower(Product.description).contains(t))
        conditions.append(func.lower(Product.category).contains(t))
        conditions.append(func.lower(Product.brand).contains(t))
        conditions.append(func.lower(Product.sub_category).contains(t))
        conditions.append(func.lower(Product.tags).contains(t))

    stmt = select(Product).where(or_(*conditions)).limit(limit)
    return db.exec(stmt).all()

def strong_keyword_filter(q_tokens: list[str], products: list[Product]) -> list[Product]:
    out = []
    important = important_tokens(q_tokens)

    for p in products:
        txt = product_text(p)
        matched, name_matches = token_overlap_score(q_tokens, p)

        if important:
            important_match_count = sum(1 for t in important if t in txt)

            if len(important) == 1:
                if important_match_count < 1:
                    continue
            else:
                # multi-word important queries must match at least 2 important words
                if important_match_count < min(2, len(important)):
                    continue

        if len(q_tokens) == 1:
            if matched >= 1:
                out.append(p)
            continue

        if matched >= 2 or name_matches >= 1:
            out.append(p)

    return out
# -----------------------------
# Routes
# -----------------------------
@router.get("/search")
def ai_search(q: str, db: Session = Depends(get_db)):
    q_norm = normalize_text(q)
    if not q_norm:
        return []

    price_filter = extract_price_filters(q_norm)
    q_tokens = [t for t in tokenize(q_norm) if not t.isdigit()]
    q_clean = clean_query(q_norm) or q_norm

    kw_candidates = sql_keyword_candidates(db, q_tokens, limit=300)
    kw_candidates = [p for p in kw_candidates if _passes_price_filter(price_filter, float(p.price))]
    kw_candidates = strong_keyword_filter(q_tokens, kw_candidates)

    kw_scored = []
    for p in kw_candidates:
        ks = keyword_score(q_tokens, p)
        pb = _price_bonus(price_filter, float(p.price))
        final = (0.95 * ks) + (0.05 * pb)

        if final >= 18:
            kw_scored.append((final, p))

    kw_scored.sort(key=lambda x: x[0], reverse=True)
    kw_ranked = [p for _, p in kw_scored]

    if len(kw_ranked) >= 6:
        return kw_ranked[:30]

    ensure_cache(db)

    all_products = db.exec(select(Product).order_by(Product.id)).all()
    if not all_products:
        return kw_ranked[:30]

    q_vec = _model.encode([q_clean], normalize_embeddings=True)[0].astype(np.float32)
    picked = {p.id for p in kw_ranked}
    important = important_tokens(q_tokens)

    sem_scored = []
    for p in all_products:
        if p.id in picked:
            continue
        if not _passes_price_filter(price_filter, float(p.price)):
            continue

        txt = product_text(p)
        matched, name_matches = token_overlap_score(q_tokens, p)

                # important tokens must exist
        if important:
            important_match_count = sum(1 for t in important if t in txt)
            if important_match_count == 0:
                continue

        # stricter lexical gate
        if len(q_tokens) == 1:
            if matched == 0:
                continue
        else:
            # for multi-word query, require at least 2 matched tokens
            if matched < 2:
                continue

        p_vec = _cache["id_to_vec"].get(p.id)
        sim = float(np.dot(p_vec, q_vec)) if p_vec is not None else 0.0
        sim_score = max(0.0, sim) * 100.0

        ks = keyword_score(q_tokens, p)
        pb = _price_bonus(price_filter, float(p.price))

        final = (0.40 * sim_score) + (0.55 * ks) + (0.05 * pb)

        if final >= 28:
            sem_scored.append((final, p))

    sem_scored.sort(key=lambda x: x[0], reverse=True)

    results = kw_ranked[:]
    results.extend([p for _, p in sem_scored[: (30 - len(results))]])

    return results[:30]

@router.get("/search/suggest")
def search_suggest(q: str = "", db: Session = Depends(get_db)):
    qn = normalize_text(q)
    if not qn:
        return []

    toks = [t for t in tokenize(qn) if not t.isdigit()]
    if not toks:
        return []

    products = sql_keyword_candidates(db, toks, limit=30)
    products = strong_keyword_filter(toks, products)

    scored = []
    for p in products:
        ks = keyword_score(toks, p)
        if ks >= 18:
            scored.append((ks, p))

    scored.sort(key=lambda x: x[0], reverse=True)

    out = []
    for _, p in scored[:6]:
        out.append({
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "image": p.image
        })
    return out

@router.post("/rebuild")
def rebuild(db: Session = Depends(get_db)):
    rebuild_cache(db)
    return {"message": "Rebuilt search embeddings", "products": _cache["count"]}