import React, { useEffect, useState } from "react";
import "./pages/Orders.css";
import { API } from "./config";
import { useNavigate } from "react-router-dom";

function Orders() {
  const [orders, setOrders] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState({});
  const [paying, setPaying] = useState({}); // per order id
  const [cancelling, setCancelling] = useState({}); // per order id

  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const fetchOrders = async () => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/order/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
      else if (Array.isArray(data.orders)) setOrders(data.orders);
      else setOrders([]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line
  }, []);

  // ---------------------------
  // LOAD RAZORPAY SCRIPT
  // ---------------------------
  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  // ---------------------------
  // OPEN RAZORPAY POPUP
  // ---------------------------
  const openRazorpay = async (rpData) => {
    const loaded = await loadRazorpay();
    if (!loaded) return alert("Razorpay SDK failed to load");

    const options = {
      key: rpData.key_id,
      amount: rpData.amount,
      currency: rpData.currency,
      name: "ShopAI",
      description: `Pay Order #${rpData.app_order_id}`,
      order_id: rpData.razorpay_order_id,

      handler: async function (response) {
        const verify = await fetch(`${API}/payment/razorpay/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            app_order_id: rpData.app_order_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        const verifyData = await verify.json().catch(() => ({}));
        if (!verify.ok) {
          alert(verifyData.detail || "Payment verify failed");
          return;
        }

        alert("Payment Successful ✅");
        await fetchOrders(); // refresh orders (PAID + Processing)
        navigate("/orders");
      },

      modal: {
        ondismiss: function () {
          alert("Payment cancelled");
        },
      },

      theme: { color: "#111" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  // ---------------------------
  // RETRY PAYMENT (PAY NOW)
  // ---------------------------
  const payNow = async (orderId) => {
    if (!token) return alert("Login first");

    try {
      setPaying((p) => ({ ...p, [orderId]: true }));

      const rp = await fetch(`${API}/payment/razorpay/create-order/${orderId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const rpData = await rp.json().catch(() => ({}));
      if (!rp.ok) {
        alert(rpData.detail || "Razorpay order creation failed");
        return;
      }

      await openRazorpay(rpData);
    } catch (e) {
      console.log(e);
      alert("Server error");
    } finally {
      setPaying((p) => ({ ...p, [orderId]: false }));
    }
  };

  // ---------------------------
  // CANCEL ORDER
  // ---------------------------
  const cancelOrder = async (orderId) => {
    if (!token) return alert("Login first");

    const ok = window.confirm("Cancel this order? Stock will be restored.");
    if (!ok) return;

    try {
      setCancelling((p) => ({ ...p, [orderId]: true }));

      const res = await fetch(`${API}/order/cancel/${orderId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.detail || "Cancel failed");
        return;
      }

      alert("Order cancelled ✅");
      await fetchOrders();
    } catch (e) {
      console.log(e);
      alert("Server error");
    } finally {
      setCancelling((p) => ({ ...p, [orderId]: false }));
    }
  };

  // ---------------------------
  // VIEW ITEMS
  // ---------------------------
  const loadDetails = async (orderId) => {
    if (details[orderId]) {
      setDetails((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
      return;
    }

    if (!token) return alert("Login first");

    try {
      setLoadingDetails((p) => ({ ...p, [orderId]: true }));

      const res = await fetch(`${API}/order/details/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.detail || "Failed to load items");
        return;
      }

      setDetails((prev) => ({ ...prev, [orderId]: data }));
    } catch (err) {
      alert("Server error");
      console.log(err);
    } finally {
      setLoadingDetails((p) => ({ ...p, [orderId]: false }));
    }
  };

  const formatMoney = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;

  return (
    <div className="orders-page">
      <div className="orders-container">
        <div className="orders-header">
          <h2 className="orders-title">My Orders</h2>
          <p className="orders-subtitle">Track your purchases and view items</p>
        </div>

        {loading && (
          <div className="orders-empty">
            <h3>Loading your orders...</h3>
            <p>Please wait a moment.</p>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="orders-empty">
            <h3>No orders yet</h3>
            <p>Once you place an order, it will appear here.</p>
          </div>
        )}

        {!loading &&
          orders.map((order) => {
            const pm = (order.payment_method || "COD").toUpperCase();
            const ps = (order.payment_status || "").toUpperCase();
            const st = (order.status || "Placed");

            const showPayNow = pm === "RAZORPAY" && ps === "PENDING" && st !== "Cancelled";
            const showCancel = st !== "Cancelled" && st !== "Delivered" && st !== "Shipped";

            return (
              <div key={order.id} className="order-card">
                <div className="order-top">
                  <div>
                    <div className="order-id">Order #{order.id}</div>

                    <div className="order-meta">
                      Payment: {order.payment_method || "COD"}{" "}
                      {order.payment_status ? `(${order.payment_status})` : ""}
                    </div>

                    <div className="order-meta">
                      Ordered on: {new Date(order.created_at).toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div className="order-total">{formatMoney(order.total_amount)}</div>
                </div>

                <p>
                  <b>Status:</b>{" "}
                  <span
                    className={`status-badge status-${String(st)
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {st}
                  </span>
                </p>

                {/* ✅ Pending Payment notice */}
                {showPayNow && (
                  <div className="order-meta" style={{ marginTop: 6 }}>
                    ⚠️ Payment pending. Please complete payment to process your order.
                  </div>
                )}

                <div className="order-actions">
                  <button
                    className="view-btn"
                    onClick={() => loadDetails(order.id)}
                    disabled={loadingDetails[order.id]}
                  >
                    {loadingDetails[order.id]
                      ? "Loading..."
                      : details[order.id]
                      ? "Hide Items"
                      : "View Items"}
                  </button>

                  {/* ✅ Retry Payment */}
                  {showPayNow && (
                    <button
                      className="view-btn"
                      onClick={() => payNow(order.id)}
                      disabled={paying[order.id]}
                      style={{ background: "#0b72e7" }}
                    >
                      {paying[order.id] ? "Opening..." : "Pay Now"}
                    </button>
                  )}

                  {/* ✅ Cancel Order */}
                  {showCancel && (
                    <button
                      className="view-btn"
                      onClick={() => cancelOrder(order.id)}
                      disabled={cancelling[order.id]}
                      style={{ background: "#b91c1c" }}
                    >
                      {cancelling[order.id] ? "Cancelling..." : "Cancel Order"}
                    </button>
                  )}
                </div>

                {Array.isArray(details[order.id]) && (
                  <div className="items-list">
                    {details[order.id].map((item, i) => (
                      <div key={i} className="order-item">
                        <div className="item-left">
                          <div className="item-name">{item.name}</div>
                          <div className="item-qty">Qty: {item.quantity}</div>
                        </div>
                        <div className="item-right">{formatMoney(item.price)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default Orders;
