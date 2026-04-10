import React, { useEffect, useState } from "react";
import "./AdminOrders.css";
import { API } from "../config";

export default function AdminOrders() {
  const token = localStorage.getItem("token");

  const [orders, setOrders] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState({});
  const [roleLabel, setRoleLabel] = useState("Order Management");

  const fetchMe = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data?.is_admin) setRoleLabel("Admin • Order Management");
      else if (data?.is_staff) setRoleLabel("Staff • Order Management");
      else setRoleLabel("Order Management");
    } catch {
      setRoleLabel("Order Management");
    }
  };

  const fetchOrders = async () => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/admin/orders/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Not allowed to view orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(e.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
    fetchOrders();
    // eslint-disable-next-line
  }, []);

  const toggleDetails = async (orderId) => {
    if (details[orderId]) {
      setDetails((p) => {
        const copy = { ...p };
        delete copy[orderId];
        return copy;
      });
      return;
    }

    try {
      const res = await fetch(`${API}/admin/orders/details/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load details");

      setDetails((p) => ({
        ...p,
        [orderId]: Array.isArray(data) ? data : [],
      }));
    } catch (e) {
      alert(e.message || "Failed to load details");
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      setChanging((p) => ({ ...p, [orderId]: true }));

      const res = await fetch(
        `${API}/admin/orders/status/${orderId}?status=${encodeURIComponent(status)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Status update failed");

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    } catch (e) {
      alert(e.message || "Failed");
    } finally {
      setChanging((p) => ({ ...p, [orderId]: false }));
    }
  };

  const formatMoney = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;

  const statuses = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"];

  return (
    <div className="ao-wrap">
      <div className="ao-header">
        <div>
          <h2>{roleLabel}</h2>
          <p className="muted">View customer orders and update delivery status</p>
        </div>

        <button className="btn" onClick={fetchOrders}>
          Refresh
        </button>
      </div>

      {loading && <div className="ao-box">Loading orders...</div>}

      {!loading && orders.length === 0 && (
        <div className="ao-box">
          <p className="muted">No orders yet.</p>
        </div>
      )}

      {!loading &&
        orders.map((o) => (
          <div className="ao-card" key={o.id}>
            <div className="ao-top">
              <div>
                <div className="oid">Order #{o.id}</div>
                <div className="muted small">User: {o.user_email}</div>
                <div className="muted small">
                  Payment: {o.payment_method || "-"} ({o.payment_status || "-"})
                </div>
                <div className="muted small">
                  Date: {new Date(o.created_at).toLocaleString("en-IN")}
                </div>
              </div>

              <div className="amount">{formatMoney(o.total_amount)}</div>
            </div>

            <div className="ao-row">
              <div className="status">
                <span className="label">Status:</span>
                <span className="pill">{o.status}</span>
              </div>

              <div className="controls">
                <select
                  value={o.status || "Placed"}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                  disabled={changing[o.id]}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <button className="btn ghost" onClick={() => toggleDetails(o.id)}>
                  {details[o.id] ? "Hide Items" : "View Items"}
                </button>
              </div>
            </div>

            {Array.isArray(details[o.id]) && (
              <div className="items">
                {details[o.id].map((it, idx) => (
                  <div className="item" key={idx}>
                    <div>
                      <div className="iname">{it.name}</div>
                      <div className="muted small">Qty: {it.quantity}</div>
                    </div>
                    <div className="iprice">{formatMoney(it.price)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
