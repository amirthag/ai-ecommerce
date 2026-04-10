import React, { useEffect, useMemo, useState } from "react";
import "./AdminProducts.css";
import { API } from "../config";

export default function AdminProducts() {
  const token = localStorage.getItem("token");

  const CATEGORIES = [
    "All",
    "Electronics",
    "Fashion",
    "Home & Kitchen",
    "Beauty & Personal Care",
    "Books",
    "Sports & Fitness",
  ];

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("All");

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    image: "",
    category: "Electronics",
    brand: "",
    sub_category: "",
    tags: "",
  });

  const [editingId, setEditingId] = useState(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/product/all`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      price: "",
      stock: "",
      image: "",
      category: "Electronics",
      brand: "",
      sub_category: "",
      tags: "",
    });
    setEditingId(null);
  };

  const submit = async () => {
    if (!token) return alert("Login as admin first");

    if (!form.name || !form.price || !form.stock || !form.image) {
      return alert("Name, price, stock, image are required");
    }

    const payload = {
      name: form.name,
      description: form.description || "",
      price: Number(form.price),
      stock: Number(form.stock),
      image: form.image,
      category: form.category || "Electronics",
      brand: form.brand || "",
      sub_category: form.sub_category || "",
      tags: form.tags || "",
    };

    try {
      const url = editingId
        ? `${API}/admin/products/update/${editingId}`
        : `${API}/admin/products/add`;

      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.detail || "Save failed (admin only?)");
        return;
      }

      alert(editingId ? "Product updated ✅" : "Product added ✅");
      resetForm();
      fetchProducts();
    } catch (e) {
      alert("Server error");
      console.log(e);
    }
  };

  const edit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      description: p.description || "",
      price: p.price ?? "",
      stock: p.stock ?? "",
      image: p.image || "",
      category: p.category || "Electronics",
      brand: p.brand || "",
      sub_category: p.sub_category || "",
      tags: p.tags || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    if (!token) return alert("Login as admin first");
    const ok = window.confirm("Delete this product?");
    if (!ok) return;

    try {
      const res = await fetch(`${API}/admin/products/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.detail || "Delete failed");
        return;
      }

      alert("Deleted ✅");
      fetchProducts();
    } catch (e) {
      alert("Server error");
      console.log(e);
    }
  };

  const updateStockQuick = async (id, newStock) => {
    if (!token) return alert("Login as admin first");

    try {
      const res = await fetch(`${API}/admin/products/stock/${id}?stock=${newStock}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.detail || "Stock update failed");
        return;
      }

      fetchProducts();
    } catch (e) {
      console.log(e);
      alert("Server error");
    }
  };

  const filteredProducts = useMemo(() => {
    if (filterCategory === "All") return products;
    return products.filter((p) => (p.category || "") === filterCategory);
  }, [products, filterCategory]);

  return (
    <div className="ap-wrap">
      <div className="ap-header">
        <div>
          <h2>Admin • Products</h2>
          <p className="muted">Add, update, delete products and manage stock</p>
        </div>
        {editingId && (
          <button className="btn ghost" onClick={resetForm}>
            Cancel Edit
          </button>
        )}
      </div>

      <div className="ap-form">
        <div className="ap-grid">
          <input
            placeholder="Product name"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
          <input
            placeholder="Price (₹)"
            value={form.price}
            onChange={(e) => onChange("price", e.target.value)}
          />
          <input
            placeholder="Stock"
            value={form.stock}
            onChange={(e) => onChange("stock", e.target.value)}
          />
          <input
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => onChange("image", e.target.value)}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <select
            value={form.category}
            onChange={(e) => onChange("category", e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              fontWeight: 700,
              background: "#fff",
              marginBottom: 10,
            }}
          >
            {CATEGORIES.filter((c) => c !== "All").map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            placeholder="Brand"
            value={form.brand}
            onChange={(e) => onChange("brand", e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              outline: "none",
              marginBottom: 10,
            }}
          />

          <input
            placeholder="Sub Category (e.g. Kurta Set, Sneakers, Smartphone)"
            value={form.sub_category}
            onChange={(e) => onChange("sub_category", e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              outline: "none",
              marginBottom: 10,
            }}
          />

          <input
            placeholder="Tags (comma separated: women, ethnic, festive)"
            value={form.tags}
            onChange={(e) => onChange("tags", e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              outline: "none",
            }}
          />
        </div>

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
        />

        <button className="btn" onClick={submit}>
          {editingId ? "Update Product" : "Add Product"}
        </button>
      </div>

      <div className="ap-box">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div className="box-title" style={{ marginBottom: 0 }}>
            All Products
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 700,
              minWidth: 220,
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                Filter: {c}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="muted">Loading products...</p>}

        {!loading && filteredProducts.length === 0 && (
          <p className="muted">No products found in this category.</p>
        )}

        <div className="ap-list">
          {filteredProducts.map((p) => (
            <div className="ap-row" key={p.id}>
              <img className="ap-img" src={p.image} alt={p.name} />

              <div className="ap-main">
                <div className="ap-name">{p.name}</div>
                <div className="ap-sub">
                  ₹ {Number(p.price).toLocaleString("en-IN")} • Stock: {p.stock}
                  {" • "}Category: <b>{p.category || "—"}</b>
                </div>

                <div className="ap-sub">
                  Brand: <b>{p.brand || "—"}</b>
                  {" • "}Sub Category: <b>{p.sub_category || "—"}</b>
                </div>

                <div className="ap-sub">
                  Tags: <b>{p.tags || "—"}</b>
                </div>
              </div>

              <div className="ap-actions">
                <button className="btn small" onClick={() => edit(p)}>
                  Edit
                </button>
                <button className="btn small danger" onClick={() => remove(p.id)}>
                  Delete
                </button>

                <div className="stock-mini">
                  <button
                    className="mini"
                    onClick={() => updateStockQuick(p.id, Math.max(0, (p.stock || 0) - 1))}
                  >
                    −
                  </button>
                  <button
                    className="mini"
                    onClick={() => updateStockQuick(p.id, (p.stock || 0) + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
