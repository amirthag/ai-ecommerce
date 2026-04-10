import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { API } from "../config";

function Search() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") || "";

  useEffect(() => {
    const run = async () => {
      if (!query.trim()) return;
      setLoading(true);
      try {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (e) {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [query]);

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={{ padding: "30px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Search Results for "{query}"</h2>
          <Link to="/" style={{ textDecoration: "none" }}>
            <button style={styles.homeBtn}>← Back to Home</button>
          </Link>
        </div>

        {loading && <p>Loading...</p>}

        {!loading && products.length === 0 && <p>No results found.</p>}

        <div style={styles.grid}>
          {products.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} style={styles.card}>
              <img src={p.image} alt={p.name} style={styles.img} />
              <h3>{p.name}</h3>
              <p>₹ {p.price}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  homeBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#111",
    color: "white",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "24px",
    marginTop: "20px",
  },
  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    textDecoration: "none",
    color: "#333",
    textAlign: "center",
  },
  img: {
    height: "160px",
    objectFit: "contain",
    marginBottom: "10px",
  },
};

export default Search;
