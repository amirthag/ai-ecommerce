import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "./config";

function Home() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [forYou, setForYou] = useState([]);

  const [hovered, setHovered] = useState(null);
  const [wishlist, setWishlist] = useState([]);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [category, setCategory] = useState("All");
  const [fade, setFade] = useState(false);

  const categories = [
    "All",
    "Electronics",
    "Fashion",
    "Home & Kitchen",
    "Beauty & Personal Care",
    "Books",
    "Sports & Fitness",
  ];

  // ✅ Correct Image URL resolver
  const imgUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;

    // ✅ images stored in frontend/public/images
    if (path.startsWith("/images")) return path;
    if (path.startsWith("images/")) return `/${path}`;

    // fallback: return as is
    return path;
  };

  // Load products
  useEffect(() => {
    fetch(`${API}/product/all`)
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
  }, []);

  // Load AI "For You"
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setForYou([]);
      return;
    }

    fetch(`${API}/recommend/for-you`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setForYou(Array.isArray(data) ? data : []))
      .catch(() => setForYou([]));
  }, []);

  // fade animation
  useEffect(() => {
    setFade(true);
    const t = setTimeout(() => setFade(false), 250);
    return () => clearTimeout(t);
  }, [search, category, sort]);

  useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) return;

  fetch(`${API}/wishlist/my`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      const ids = data.map((p) => p.id);
      setWishlist(ids);
    })
    .catch(() => {});
}, []);

  const processedProducts = useMemo(() => {
    let filtered = products.filter((p) => {
      const text = ((p.name || "") + " " + (p.description || "")).toLowerCase();
      return text.includes(search.toLowerCase());
    });

    if (category !== "All") {
      filtered = filtered.filter((p) => (p.category || "") === category);
    }

    const copy = [...filtered];
    if (sort === "low") copy.sort((a, b) => a.price - b.price);
    if (sort === "high") copy.sort((a, b) => b.price - a.price);
    if (sort === "az") copy.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return copy;
  }, [products, search, category, sort]);

  const addToCart = async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) return alert("Please login first");

    try {
      const res = await fetch(`${API}/cart/add/${productId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      if (!res.ok) {
        alert(text || "Failed to add to cart");
        return;
      }

      alert("Added to cart!");
    } catch (e) {
      alert("Backend not reachable");
      console.log(e);
    }
  };

  const toggleWishlist = async (productId) => {
  const token = localStorage.getItem("token");
  if (!token) return alert("Please login first");

  const isWishlisted = wishlist.includes(productId);

  try {
    const res = await fetch(
      `${API}/wishlist/${isWishlisted ? "remove" : "add"}/${productId}`,
      {
        method: isWishlisted ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      alert("Error updating wishlist");
      return;
    }

    if (isWishlisted) {
      setWishlist((prev) => prev.filter((id) => id !== productId));
    } else {
      setWishlist((prev) => [...prev, productId]);
    }
  } catch (err) {
    console.log(err);
    alert("Server error");
  }
};

  const openProduct = (id) => navigate(`/product/${id}`);

  const cleanedForYou = useMemo(() => {
    const seen = new Set();
    return (forYou || []).filter((p) => {
      if (!p?.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [forYou]);

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh" }}>
      {/* ✅ Recommended For You */}
      {cleanedForYou.length > 0 && (
        <div style={styles.forYouSection}>
          <div style={styles.forYouHeader}>
            <h2 style={{ margin: 0 }}>Recommended For You</h2>
            <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
              Based on your cart and previous orders
            </p>
          </div>

          <div style={styles.forYouGrid}>
            {cleanedForYou.slice(0, 8).map((p) => (
              <div key={p.id} style={styles.card} onClick={() => openProduct(p.id)}>
                <div style={styles.imageBox}>
                  <div style={styles.rating}>⭐ 4.5</div>

                  <div
                    style={styles.heart}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(p.id);
                    }}
                  >
                    {wishlist.includes(p.id) ? "❤️" : "🤍"}
                  </div>

                  <img src={imgUrl(p.image)} alt={p.name} style={styles.image} />
                </div>

                <div style={styles.info}>
                  <h3 style={styles.name}>{p.name}</h3>
                  <p style={styles.desc}>{p.description}</p>

                  <div style={styles.bottom}>
                    <span style={styles.price}>₹ {p.price}</span>
                    <button
                      style={styles.btnSmall}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p.id);
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✅ Search */}
      <div style={styles.searchBarWrap}>
        <input
          style={styles.searchBar}
          placeholder="Filter products on this page..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ✅ Categories + Sort */}
      <div style={styles.chips}>
        <div style={styles.chipGroup}>
          {categories.map((c) => (
            <div
              key={c}
              onClick={() => setCategory(c)}
              style={{
                ...styles.chip,
                background: category === c ? "#111" : "#fff",
                color: category === c ? "#fff" : "#333",
                border: category === c ? "1px solid #111" : "1px solid #ddd",
              }}
            >
              {c}
            </div>
          ))}
        </div>

        <div style={styles.sortBar}>
          <span>Sort:</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={styles.select}>
            <option value="">Default</option>
            <option value="low">Price: Low → High</option>
            <option value="high">Price: High → Low</option>
            <option value="az">Name: A → Z</option>
          </select>
        </div>
      </div>

      {/* ✅ Product Grid */}
      <div style={{ ...styles.container, opacity: fade ? 0 : 1 }}>
        {processedProducts.map((p) => (
          <div
            key={p.id}
            style={{
              ...styles.card,
              transform: hovered === p.id ? "translateY(-10px)" : "none",
              boxShadow:
                hovered === p.id ? "0 20px 35px rgba(0,0,0,0.12)" : "0 8px 18px rgba(0,0,0,0.08)",
            }}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => openProduct(p.id)}
          >
            <div style={styles.imageBox}>
              <div style={styles.rating}>⭐ 4.5</div>

              <div
                style={styles.heart}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWishlist(p.id);
                }}
              >
                {wishlist.includes(p.id) ? "❤️" : "🤍"}
              </div>

              <img src={imgUrl(p.image)} alt={p.name} style={styles.image} />
            </div>

            <div style={styles.info}>
              <h3 style={styles.name}>{p.name}</h3>
              <p style={styles.desc}>{p.description}</p>

              <div style={styles.bottom}>
                <span style={styles.price}>₹ {p.price}</span>
                <button
                  style={styles.btnSmall}
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(p.id);
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  forYouSection: { padding: "24px 60px 10px" },
  forYouHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    marginBottom: 14,
    gap: 16,
  },
  forYouGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "32px",
  },

  searchBarWrap: { padding: "10px 60px 0" },
  searchBar: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
  },

  chips: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "20px 60px 10px",
    flexWrap: "wrap",
  },
  chipGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    flex: 1,
    minWidth: 280,
  },
  chip: {
    padding: "8px 16px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.2s",
    userSelect: "none",
    whiteSpace: "nowrap",
  },

  sortBar: { display: "flex", alignItems: "center", gap: 8 },
  select: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    outline: "none",
  },

  container: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "32px",
    padding: "30px 60px 40px",
    transition: "opacity 0.3s ease",
  },

  card: {
    background: "#fff",
    borderRadius: "16px",
    overflow: "hidden",
    transition: "all 0.3s ease",
    cursor: "pointer",
  },

  imageBox: {
    height: "240px",
    background: "#f2f3f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  image: { maxHeight: "200px", maxWidth: "85%", objectFit: "contain" },

  rating: {
    position: "absolute",
    top: "10px",
    left: "10px",
    background: "#111",
    color: "white",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
  },

  heart: { position: "absolute", top: "10px", right: "10px", fontSize: "20px", cursor: "pointer" },

  info: { padding: "18px" },
  name: { fontSize: "18px", fontWeight: "700" },
  desc: { fontSize: "14px", color: "#666", minHeight: 40 },

  bottom: { marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: "20px", fontWeight: "bold" },

  btnSmall: {
    padding: "6px 12px",
    background: "#111",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
};

export default Home;
