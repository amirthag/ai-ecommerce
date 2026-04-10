import React, { useEffect, useState } from "react";
import emptyCart from "./assests/empty-cart.png";
import { Link, useNavigate } from "react-router-dom";
import { API } from "./config";

function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [placing, setPlacing] = useState(false);

  // ✅ address flow
  const [addrOpen, setAddrOpen] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [payMethod, setPayMethod] = useState("COD");

  // ✅ add address form
  const [newAddr, setNewAddr] = useState({
    full_name: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
  });

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchCart = async () => {
    if (!token) {
      setCartItems([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/cart/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCartItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log(err);
      alert("Backend not reachable");
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/address/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setAddresses(list);

      // ✅ auto select first address
      if (list.length > 0) {
        setSelectedAddressId((prev) => prev ?? list[0].id);
      } else {
        setSelectedAddressId(null);
      }
    } catch {
      setAddresses([]);
      setSelectedAddressId(null);
    }
  };

  useEffect(() => {
    fetchCart();
    // eslint-disable-next-line
  }, []);

  const removeItem = async (cartId) => {
    if (!token) return alert("Login first");
    await fetch(`${API}/cart/remove/${cartId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchCart();
  };

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
      description: "Order Payment",
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
        setAddrOpen(false);
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

  // ✅ open address modal then place order
  const startCheckout = async (method) => {
    if (!token) return alert("Login first");
    setPayMethod(method);
    await fetchAddresses();
    setAddrOpen(true);
  };

  const addAddress = async () => {
    if (!token) return;

    // ✅ basic validation
    const required = ["full_name", "phone", "line1", "city", "state", "pincode"];
    for (const k of required) {
      if (!(newAddr[k] || "").trim()) {
        alert(`Please fill ${k.replace("_", " ")}`);
        return;
      }
    }

    try {
      const res = await fetch(`${API}/address/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newAddr),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.detail || "Failed to add address");
        return;
      }

      setNewAddr({
        full_name: "",
        phone: "",
        line1: "",
        city: "",
        state: "",
        pincode: "",
      });

      // refresh + select new address
      await fetchAddresses();
      if (data?.id) setSelectedAddressId(data.id);

      alert("Address added ✅");
    } catch {
      alert("Server error");
    }
  };

  // ---------------------------
  // PLACE ORDER (COD OR RAZORPAY) with address_id
  // ---------------------------
  const placeOrder = async () => {
    if (!token) return alert("Login first");
    if (!selectedAddressId) return alert("Please select an address");

    try {
      setPlacing(true);

      // 1️⃣ Create order in DB with address_id
      const res = await fetch(
        `${API}/order/place?payment_method=${payMethod}&address_id=${selectedAddressId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.detail || "Order failed");
        return;
      }

      // COD flow
      if (payMethod === "COD") {
        alert("Order placed successfully (Cash on Delivery)");
        setAddrOpen(false);
        navigate("/orders");
        return;
      }

      // Razorpay flow
      const rp = await fetch(
        `${API}/payment/razorpay/create-order/${data.order_id}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const rpData = await rp.json().catch(() => ({}));
      if (!rp.ok) {
        alert(rpData.detail || "Razorpay order creation failed");
        return;
      }

      openRazorpay(rpData);
    } catch (err) {
      console.log(err);
      alert("Server error");
    } finally {
      setPlacing(false);
    }
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh" }}>
      {loading && <div style={{ padding: 40 }}>Loading cart...</div>}

      {!loading && cartItems.length === 0 && (
        <div style={styles.empty}>
          <img src={emptyCart} alt="Empty Cart" style={styles.emptyImg} />
          <h2>Your Cart is Empty</h2>
          <Link to="/">
            <button style={styles.shopBtn}>Start Shopping</button>
          </Link>
        </div>
      )}

      {!loading && cartItems.length > 0 && (
        <div style={styles.container}>
          <h2>Your Cart</h2>

          {cartItems.map((item) => (
            <div key={item.cart_id} style={styles.card}>
              <img src={item.image} alt={item.name} style={styles.image} />

              <div style={{ flex: 1 }}>
                <h3>{item.name}</h3>
                <p>₹ {item.price}</p>
                <p>Qty: {item.quantity}</p>
              </div>

              <button
                style={styles.removeBtn}
                onClick={() => removeItem(item.cart_id)}
              >
                Remove
              </button>
            </div>
          ))}

          <div style={styles.totalBox}>
            <h3>Total: ₹ {totalPrice}</h3>

            <button
              style={styles.codBtn}
              onClick={() => startCheckout("COD")}
              disabled={placing}
            >
              Place Order (COD)
            </button>

            <button
              style={styles.payBtn}
              onClick={() => startCheckout("RAZORPAY")}
              disabled={placing}
            >
              Pay with Razorpay
            </button>
          </div>
        </div>
      )}

      {/* ✅ Address + Payment Modal */}
      {addrOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => !placing && setAddrOpen(false)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delivery Address</h3>

            {addresses.length === 0 ? (
              <p style={{ color: "#666" }}>No address found. Add one below.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {addresses.map((a) => (
                  <label key={a.id} style={styles.addrCard}>
                    <input
                      type="radio"
                      name="addr"
                      checked={selectedAddressId === a.id}
                      onChange={() => setSelectedAddressId(a.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {a.full_name} — {a.phone}
                      </div>
                      <div style={{ color: "#555", marginTop: 3 }}>
                        {a.line1}, {a.city}, {a.state} - {a.pincode}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <h4 style={{ margin: "10px 0" }}>Add New Address</h4>
              <div style={styles.formGrid}>
                <input
                  style={styles.input}
                  placeholder="Full Name"
                  value={newAddr.full_name}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, full_name: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  placeholder="Phone"
                  value={newAddr.phone}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, phone: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  placeholder="Address Line"
                  value={newAddr.line1}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, line1: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  placeholder="City"
                  value={newAddr.city}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, city: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  placeholder="State"
                  value={newAddr.state}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, state: e.target.value })
                  }
                />
                <input
                  style={styles.input}
                  placeholder="Pincode"
                  value={newAddr.pincode}
                  onChange={(e) =>
                    setNewAddr({ ...newAddr, pincode: e.target.value })
                  }
                />
              </div>

              <button
                style={styles.addAddrBtn}
                onClick={addAddress}
                disabled={placing}
              >
                Add Address
              </button>
            </div>

            <div style={styles.modalBtns}>
              <button
                style={styles.secondaryBtn}
                onClick={() => setAddrOpen(false)}
                disabled={placing}
              >
                Cancel
              </button>

              <button
                style={styles.primaryBtn}
                onClick={placeOrder}
                disabled={placing || !selectedAddressId} // ✅ block if no address
              >
                {placing
                  ? "Processing..."
                  : payMethod === "COD"
                  ? "Confirm COD"
                  : "Continue to Pay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  empty: {
    height: "80vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyImg: { width: 320 },
  shopBtn: {
    padding: 12,
    background: "#111",
    color: "white",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
  },
  container: { padding: 40 },
  card: {
    display: "flex",
    gap: 20,
    alignItems: "center",
    background: "#fff",
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  image: { width: 120 },
  removeBtn: {
    background: "red",
    color: "white",
    padding: 10,
    border: "none",
    cursor: "pointer",
  },
  totalBox: { textAlign: "right" },
  codBtn: {
    padding: 12,
    marginRight: 10,
    background: "#444",
    color: "white",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
  },
  payBtn: {
    padding: 12,
    background: "#0b72e7",
    color: "white",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
  },

  // modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  },
  addrCard: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    outline: "none",
  },
  addAddrBtn: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #111",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  modalBtns: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 16,
  },
  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "none",
    background: "#111",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    color: "#111",
    fontWeight: 800,
    cursor: "pointer",
  },
};

export default Cart;
