import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API } from "../config";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  const [wishCount, setWishCount] = useState(0);

  const boxRef = useRef(null);

  const imgUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/images/")) return path;
    if (path.startsWith("images/")) return `/${path}`;
    return `/images/${path}`;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setIsAdmin(false);
    setIsStaff(false);
    setWishCount(0);
    navigate("/");
    window.location.reload();
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setIsAdmin(false);
        setIsStaff(false);
        return;
      }

      try {
        const res = await fetch(`${API}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        setIsAdmin(!!data.is_admin);
        setIsStaff(!!data.is_staff);
      } catch {
        setIsAdmin(false);
        setIsStaff(false);
      }
    };

    run();
  }, [token]);

  const fetchWishCount = async () => {
    if (!token) {
      setWishCount(0);
      return;
    }

    try {
      const res = await fetch(`${API}/wishlist/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setWishCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setWishCount(0);
    }
  };

  useEffect(() => {
    fetchWishCount();
    // eslint-disable-next-line
  }, [token, location.pathname]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await fetch(
          `${API}/search/suggest?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
        else setSuggestions([]);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  const goSearch = () => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setOpen(false);

    const input = boxRef.current?.querySelector("input");
    input?.focus();

    if (location.pathname === "/search") navigate("/");
  };

  return (
    <div style={styles.nav}>
      <div style={styles.logo} onClick={() => navigate("/")}>
        ShopAI
      </div>

      <div style={styles.searchWrap} ref={boxRef}>
        <span style={styles.searchIcon}>🔍</span>

        <input
          style={styles.search}
          placeholder="Search products..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") goSearch();
            if (e.key === "Escape") clearSearch();
          }}
        />

        <button
          type="button"
          style={{
            ...styles.clearBtn,
            opacity: query ? 1 : 0.5,
            cursor: query ? "pointer" : "default",
          }}
          onClick={() => {
            if (!query) return;
            clearSearch();
          }}
        >
          ✕
        </button>

        {open && suggestions.length > 0 && (
          <div style={styles.dropdown}>
            {suggestions.map((s) => (
              <div
                key={s.id}
                style={styles.item}
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  navigate(`/product/${s.id}`);
                }}
              >
                <img src={imgUrl(s.image)} alt={s.name} style={styles.itemImg} />
                <div style={{ flex: 1 }}>
                  <div style={styles.itemName}>{s.name}</div>
                  <div style={styles.itemPrice}>₹ {s.price}</div>
                </div>
              </div>
            ))}

            <div style={styles.viewAll} onClick={goSearch}>
              View all results →
            </div>
          </div>
        )}
      </div>

      <div style={styles.right}>
        {token ? (
  <>
    {isAdmin && (
      <>
        <span style={styles.adminLink} onClick={() => navigate("/admin")}>
          Admin
        </span>
        <span style={styles.staffLink} onClick={() => navigate("/admin/orders")}>
          Manage Orders
        </span>
      </>
    )}

    {!isAdmin && isStaff && (
      <span style={styles.staffLink} onClick={() => navigate("/staff/orders")}>
        Staff Orders
      </span>
    )}

    <span style={styles.link} onClick={() => navigate("/profile")}>
      Profile
    </span>

    {!isAdmin && !isStaff && (
      <>
        <span style={styles.link} onClick={() => navigate("/wishlist")}>
          Wishlist ❤️
          {wishCount > 0 && <span style={styles.badge}>{wishCount}</span>}
        </span>

        <span style={styles.link} onClick={() => navigate("/cart")}>
          Cart 🛒
        </span>

        <span style={styles.link} onClick={() => navigate("/orders")}>
          My Orders
        </span>
      </>
    )}

    <span style={styles.link} onClick={logout}>
      Logout
    </span>
  </>
) : (
          <span style={styles.link} onClick={() => navigate("/login")}>
            Login
          </span>
        )}
      </div>
    </div>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 30px",
    background: "#111",
    color: "white",
    position: "sticky",
    top: 0,
    zIndex: 999,
  },
  logo: { fontSize: "22px", fontWeight: "bold", cursor: "pointer" },

  searchWrap: {
    width: "42%",
    position: "relative",
  },

  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "14px",
    color: "#666",
  },

  search: {
    width: "100%",
    padding: "9px 38px 9px 34px",
    borderRadius: "8px",
    border: "none",
    outline: "none",
  },

  clearBtn: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    color: "#666",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  dropdown: {
    position: "absolute",
    top: "46px",
    left: 0,
    right: 0,
    background: "white",
    color: "#111",
    borderRadius: "12px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },

  item: {
    display: "flex",
    gap: "12px",
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f0f0f0",
    alignItems: "center",
  },

  itemImg: { width: 44, height: 44, objectFit: "contain" },
  itemName: { fontWeight: 700, fontSize: 14 },
  itemPrice: { fontSize: 13, color: "#555", marginTop: 2 },

  viewAll: {
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
    background: "#fafafa",
    textAlign: "center",
  },

  right: { display: "flex", gap: "18px", alignItems: "center", flexWrap: "wrap" },
  link: { cursor: "pointer", position: "relative" },

  badge: {
    marginLeft: 8,
    background: "#ff3b3b",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    display: "inline-block",
    lineHeight: "18px",
  },

  adminLink: {
    cursor: "pointer",
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: "10px",
    background: "#fff",
    color: "#111",
  },

  staffLink: {
    cursor: "pointer",
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: "10px",
    background: "#e8f0ff",
    color: "#1d4ed8",
  },
};

export default Navbar;
