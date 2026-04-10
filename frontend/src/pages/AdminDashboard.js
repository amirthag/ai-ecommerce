import React, { useEffect, useState } from "react";
import "./AdminDashboard.css";
import { API } from "../config";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const s1 = await fetch(`${API}/admin/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d1 = await s1.json();
      if (!s1.ok) throw new Error(d1.detail || "Summary failed");

      const s2 = await fetch(`${API}/admin/analytics/top-products?limit=6`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d2 = await s2.json();
      if (!s2.ok) throw new Error(d2.detail || "Top products failed");

      setSummary(d1);
      setTopProducts(Array.isArray(d2) ? d2 : []);
    } catch (e) {
      alert(e.message || "Admin analytics not reachable / Admin only");
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  if (!token) {
    return (
      <div className="admin-wrap">
        <div className="admin-card">
          <h2>Admin Dashboard</h2>
          <p>You are not logged in.</p>
          <button className="btn" onClick={() => navigate("/login")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="muted">Sales, users and product trends</p>
        </div>

        <div className="admin-actions">
          <button className="btn" onClick={() => navigate("/admin/products")}>
            Manage Products
          </button>
          <button className="btn" onClick={() => navigate("/admin/orders")}>
            Manage Orders
          </button>
        </div>
      </div>

      {loading && <div className="admin-box">Loading analytics...</div>}

      {!loading && summary && (
        <div className="grid3">
          <div className="metric">
            <div className="metric-title">Total Users</div>
            <div className="metric-value">{summary.users}</div>
          </div>

          <div className="metric">
            <div className="metric-title">Total Orders</div>
            <div className="metric-value">{summary.orders}</div>
          </div>

          <div className="metric">
            <div className="metric-title">Paid Sales</div>
            <div className="metric-value">
              ₹ {Number(summary.sales_paid || 0).toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="admin-box">
          <div className="box-title">Top Selling Products</div>

          {topProducts.length === 0 ? (
            <p className="muted">No sales data yet.</p>
          ) : (
            <div className="table">
              <div className="trow thead">
                <div>Product</div>
                <div className="right">Qty Sold</div>
              </div>

              {topProducts.map((p) => (
                <div className="trow" key={p.product_id}>
                  <div>{p.name}</div>
                  <div className="right">{p.quantity_sold}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
