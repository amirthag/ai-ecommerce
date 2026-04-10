import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../config"; // adjust path if needed

export default function Wishlist() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  const fetchWishlist = async () => {
    if (!token) {
      setItems([]);
      setWishlistIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/wishlist/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];

      setItems(arr);
      setWishlistIds(arr.map((p) => p.id));
    } catch (e) {
      console.log(e);
      setItems([]);
      setWishlistIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
    // eslint-disable-next-line
  }, []);

  const removeFromWishlist = async (productId) => {
    if (!token) return alert("Please login first");

    try {
      const res = await fetch(`${API}/wishlist/remove/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert("Failed to remove from wishlist");
        return;
      }

      setItems((prev) => prev.filter((p) => p.id !== productId));
      setWishlistIds((prev) => prev.filter((id) => id !== productId));
    } catch (e) {
      console.log(e);
      alert("Server error");
    }
  };

  const addToCart = async (productId) => {
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
      console.log(e);
      alert("Backend not reachable");
    }
  };

  const openProduct = (id) => navigate(`/product/${id}`);

  const count = useMemo(() => items.length, [items]);

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>My Wishlist</h1>
          <p style={styles.sub}>
            Saved items you can quickly add to cart • {count} item{count !== 1 ? "s" : ""}
          </p>
        </div>

        <button style={styles.btnGhost} onClick={() => navigate("/")}>
          Continue Shopping
        </button>
      </div>

      <div style={{ padding: "0 60px 40px" }}>
        {!token && (
          <div style={styles.emptyBox}>
            <h3 style={{ marginTop: 0 }}>Please login to view your wishlist</h3>
            <p style={{ color: "#666" }}>
              Your wishlist is saved to your account, so you can access it anytime.
            </p>
            <button style={styles.btn} onClick={() => navigate("/login")}>
              Login
            </button>
          </div>
        )}

        {token && loading && <p style={{ color: "#666" }}>Loading wishlist...</p>}

        {token && !loading && items.length === 0 && (
          <div style={styles.emptyBox}>
            <h3 style={{ marginTop: 0 }}>Your wishlist is empty ❤️</h3>
            <p style={{ color: "#666" }}>
              Tap the heart icon on products to save them here.
            </p>
            <button style={styles.btn} onClick={() => navigate("/")}>
              Browse Products
            </button>
          </div>
        )}

        {token && !loading && items.length > 0 && (
          <div style={styles.grid}>
            {items.map((p) => (
              <div key={p.id} style={styles.card} onClick={() => openProduct(p.id)}>
                <div style={styles.imageBox}>
                  <div style={styles.rating}>⭐ 4.5</div>

                  <div
                    style={styles.heart}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWishlist(p.id);
                    }}
                    title="Remove from wishlist"
                  >
                    {wishlistIds.includes(p.id) ? "❤️" : "🤍"}
                  </div>

                  <img src={p.image} alt={p.name} style={styles.image} />
                </div>

                <div style={styles.info}>
                  <h3 style={styles.name}>{p.name}</h3>
                  <p style={styles.desc}>{p.description}</p>

                  <div style={styles.bottom}>
                    <span style={styles.price}>₹ {Number(p.price).toLocaleString("en-IN")}</span>

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

                  <button
                    style={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWishlist(p.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  header: {
    padding: "30px 60px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
  },
  sub: { marginTop: 6, color: "#666", fontSize: 14 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "32px",
    marginTop: 20,
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    overflow: "hidden",
    transition: "all 0.25s ease",
    cursor: "pointer",
    border: "1px solid #f0f0f0",
    boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
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
  heart: {
    position: "absolute",
    top: "10px",
    right: "10px",
    fontSize: "20px",
    cursor: "pointer",
  },
  info: { padding: "18px" },
  name: { fontSize: "18px", fontWeight: "800", margin: "0 0 6px" },
  desc: { fontSize: "14px", color: "#666", minHeight: 40, margin: 0 },
  bottom: {
    marginTop: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { fontSize: "20px", fontWeight: "bold" },
  btnSmall: {
    padding: "6px 12px",
    background: "#111",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 700,
  },
  removeBtn: {
    width: "100%",
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  btn: {
    marginTop: 12,
    padding: "12px 14px",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
  },
  btnGhost: {
    padding: "10px 12px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  emptyBox: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 22,
    marginTop: 20,
  },
};
