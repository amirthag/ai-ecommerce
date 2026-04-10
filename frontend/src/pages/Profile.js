import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../config";

function apiFetch(path, token, options = {}) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function Profile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [tab, setTab] = useState("basic"); // basic | orders | addresses | security
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [errMe, setErrMe] = useState("");

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
    window.location.reload();
  };

  useEffect(() => {
    if (!token) return;

    (async () => {
      setLoadingMe(true);
      setErrMe("");
      try {
        const res = await apiFetch("/user/me", token);
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setMe(data);
      } catch (e) {
        setErrMe("Could not load profile. Please login again.");
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [token]);

  if (!token) {
    return (
      <div style={{ padding: "40px 60px" }}>
        <h2>My Profile</h2>
        <p>You are not logged in.</p>
        <button style={styles.primaryBtn} onClick={() => navigate("/login")}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "35px 60px", background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>My Profile</h2>
        <p style={{ color: "#666", marginTop: 6 }}>Manage your account</p>
      </div>

      <div style={styles.layout}>
        {/* LEFT TABS */}
        <div style={styles.sidebar}>
          <TabButton active={tab === "basic"} onClick={() => setTab("basic")}>
            Basic Info
          </TabButton>
          <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
            Orders
          </TabButton>
          <TabButton active={tab === "addresses"} onClick={() => setTab("addresses")}>
            Addresses
          </TabButton>
          <TabButton active={tab === "security"} onClick={() => setTab("security")}>
            Change Password
          </TabButton>

          <div style={{ marginTop: 14 }}>
            <button style={styles.logoutBtn} onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div style={styles.content}>
          {loadingMe && <div style={styles.card}>Loading...</div>}
          {errMe && <div style={{ ...styles.card, color: "#b00020" }}>{errMe}</div>}

          {!loadingMe && !errMe && (
            <>
              {tab === "basic" && <BasicInfoCard me={me} />}
              {tab === "orders" && <MyOrders token={token} />}
              {tab === "addresses" && <MyAddresses token={token} />}
              {tab === "security" && <Security token={token} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        ...(active ? styles.tabBtnActive : {}),
      }}
    >
      {children}
    </button>
  );
}

function BasicInfoCard({ me }) {
  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Basic Info</h3>

      <div style={styles.row}>
        <span style={styles.label}>Status</span>
        <span>Logged in ✅</span>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>Username</span>
        <span>{me?.username || "-"}</span>
      </div>

      <div style={{ ...styles.row, borderBottom: "none" }}>
        <span style={styles.label}>Email</span>
        <span>{me?.email || "-"}</span>
      </div>
    </div>
  );
}

/** ORDERS: uses GET /order/my */
function MyOrders({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await apiFetch("/order/my", token);
        if (!res.ok) throw new Error("Failed to load orders");
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr("Orders endpoint not available yet or failed.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>My Orders</h3>

      {loading && <p>Loading orders...</p>}
      {err && <p style={{ color: "#b00020" }}>{err}</p>}

      {!loading && !err && orders.length === 0 && <p>No orders found.</p>}

      {!loading && !err && orders.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {orders.map((o) => (
            <div key={o.id ?? JSON.stringify(o)} style={styles.itemCard}>
              <div style={styles.itemRow}>
                <b>Order</b>
                <span>#{o.id ?? "-"}</span>
              </div>
              <div style={styles.itemRow}>
                <span>Date</span>
                <span>{o.created_at || "-"}</span>
              </div>
              <div style={styles.itemRow}>
                <span>Total</span>
                <span>₹ {o.total_amount ?? o.total ?? "-"}</span>
              </div>
              <div style={styles.itemRow}>
                <span>Status</span>
                <span>{o.status ?? "-"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ✅ ADDRESSES: matches YOUR backend exactly:
 * GET    /address/my
 * POST   /address/add
 * DELETE /address/delete/{id}
 *
 * Fields required by backend:
 * full_name, phone, line1, city, state, pincode
 */
function MyAddresses({ token }) {
  const emptyForm = {
    id: null,
    full_name: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
  };

  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/address/my", token);
      const data = await res.json();
      setAddresses(data);
    } catch {
      alert("Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const saveAddress = async () => {
    if (
      !form.full_name ||
      !form.phone ||
      !form.line1 ||
      !form.city ||
      !form.pincode
    ) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const res = await apiFetch("/address/add", token, {
        method: "POST",
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error();

      setForm(emptyForm);
      loadAddresses();
    } catch {
      alert("Failed to save address");
    }
  };

  const deleteAddress = async (id) => {
    if (!window.confirm("Delete this address?")) return;

    try {
      await apiFetch(`/address/delete/${id}`, token, {
        method: "DELETE",
      });
      loadAddresses();
    } catch {
      alert("Delete failed");
    }
  };

  const editAddress = (addr) => {
    setForm(addr);
  };

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0 }}>My Addresses</h3>

      {/* ADDRESS FORM */}
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <input
          style={styles.input}
          placeholder="Full Name"
          value={form.full_name}
          onChange={(e) =>
            setForm({ ...form, full_name: e.target.value })
          }
        />

        <input
          style={styles.input}
          placeholder="Phone Number"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
        />

        <input
          style={styles.input}
          placeholder="Address Line"
          value={form.line1}
          onChange={(e) =>
            setForm({ ...form, line1: e.target.value })
          }
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input
            style={styles.input}
            placeholder="City"
            value={form.city}
            onChange={(e) =>
              setForm({ ...form, city: e.target.value })
            }
          />

          <input
            style={styles.input}
            placeholder="State"
            value={form.state}
            onChange={(e) =>
              setForm({ ...form, state: e.target.value })
            }
          />
        </div>

        <input
          style={styles.input}
          placeholder="Pincode"
          value={form.pincode}
          onChange={(e) =>
            setForm({ ...form, pincode: e.target.value })
          }
        />

        <button style={styles.primaryBtn} onClick={saveAddress}>
          {form.id ? "Update Address" : "Add Address"}
        </button>
      </div>

      {/* ADDRESS LIST */}
      {loading ? (
        <p>Loading...</p>
      ) : addresses.length === 0 ? (
        <p>No saved addresses</p>
      ) : (
        addresses.map((a) => (
          <div key={a.id} style={styles.itemCard}>
            <b>{a.full_name}</b>

            <div>{a.line1}</div>

            <div>
              {a.city}, {a.state} - {a.pincode}
            </div>

            <div>📞 {a.phone}</div>

            <div style={{ marginTop: 10 }}>
              <button
                style={styles.smallBtn}
                onClick={() => editAddress(a)}
              >
                Edit
              </button>

              <button
                style={styles.smallBtnDanger}
                onClick={() => deleteAddress(a.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** SECURITY: PUT /user/change-password */
function Security({ token }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const onChangePassword = async () => {
    if (!oldPass || !newPass) return alert("Please fill old & new password");
    if (newPass !== confirm) return alert("New password and confirm password must match");
    if (newPass.length < 6) return alert("New password must be at least 6 characters");

    setSaving(true);
    try {
      const res = await apiFetch("/user/change-password", token, {
        method: "PUT",
        body: JSON.stringify({ old_password: oldPass, new_password: newPass }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.detail || "Failed to change password");
        return;
      }

      alert("Password updated successfully ✅");
      setOldPass("");
      setNewPass("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Security</h3>

      <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <input
          style={styles.input}
          type="password"
          placeholder="Old Password"
          value={oldPass}
          onChange={(e) => setOldPass(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="New Password"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Confirm New Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button style={styles.primaryBtn} onClick={onChangePassword} disabled={saving}>
          {saving ? "Updating..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: "18px",
    alignItems: "start",
  },
  sidebar: {
    background: "#fff",
    borderRadius: "14px",
    padding: "14px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  content: { minWidth: 0 },

  tabBtn: {
    width: "100%",
    textAlign: "left",
    padding: "12px 12px",
    borderRadius: "10px",
    border: "1px solid #eee",
    background: "#fff",
    cursor: "pointer",
    marginBottom: 10,
    fontWeight: 600,
  },
  tabBtnActive: {
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
  },

  card: {
    background: "#fff",
    padding: "18px",
    borderRadius: "14px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #eee",
  },
  label: { fontWeight: 700, color: "#444" },

  itemCard: {
    border: "1px solid #eee",
    borderRadius: "12px",
    padding: "12px",
    background: "#fff",
  },
  itemRow: { display: "flex", justifyContent: "space-between", padding: "4px 0" },

  input: {
    padding: "12px 12px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    outline: "none",
  },

  primaryBtn: {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    color: "white",
    background: "#111",
    fontWeight: 700,
  },

  smallBtnDanger: {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid #ffb4b4",
    cursor: "pointer",
    background: "#fff",
    fontWeight: 700,
    color: "#b00020",
    height: 36,
  },

  logoutBtn: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    color: "white",
    background: "#111",
    fontWeight: 800,
  },
};

export default Profile;
