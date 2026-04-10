import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { API } from "./config";

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [similar, setSimilar] = useState([]);

  const [zoom, setZoom] = useState(false);
  const [qty, setQty] = useState(1);

  // ✅ Checkout flow: payment + address
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("COD"); // COD | RAZORPAY
  const [placing, setPlacing] = useState(false);

  // ✅ addresses
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // ✅ add address form
  const [newAddr, setNewAddr] = useState({
    full_name: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
  });

  // ✅ IMAGE FIX for frontend/public/images
  const imgUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/images/")) return path;
    if (path.startsWith("images/")) return `/${path}`;
    return `/images/${path}`;
  };

  useEffect(() => {
    fetch(`${API}/product/${id}`)
      .then((res) => res.json())
      .then((data) => setProduct(data))
      .catch(() => setProduct(null));

    fetch(`${API}/product/all`)
      .then((res) => res.json())
      .then((data) => setAllProducts(Array.isArray(data) ? data : []))
      .catch(() => setAllProducts([]));

    fetch(`${API}/recommend/similar/${id}`)
      .then((res) => res.json())
      .then((data) => setSimilar(Array.isArray(data) ? data : []))
      .catch(() => setSimilar([]));
  }, [id]);

  const fetchAddresses = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/address/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setAddresses(list);

      // select first by default
      if (!selectedAddressId && list.length > 0) {
        setSelectedAddressId(list[0].id);
      }
    } catch {
      setAddresses([]);
    }
  };

  const addToCart = async () => {
    if (!token) return alert("Login first");

    try {
      const res = await fetch(`${API}/cart/add/${id}?qty=${qty}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      if (!res.ok) return alert(text || "Failed to add to cart");

      alert("Added to cart!");
    } catch (e) {
      alert("Backend not reachable");
      console.log(e);
    }
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
        setCheckoutOpen(false);
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
  // BUY NOW -> open checkout modal (address + payment)
  // ---------------------------
  const buyNow = async () => {
    if (!token) {
      alert("Login first");
      navigate("/login");
      return;
    }
    if (!product || product.stock <= 0) {
      alert("Out of stock");
      return;
    }

    await fetchAddresses();
    setCheckoutOpen(true);
  };

  const addAddress = async () => {
    if (!token) return;

    // basic validation
    const required = ["full_name", "phone", "line1", "city", "state", "pincode"];
    for (const k of required) {
      if (!(newAddr[k] || "").trim()) {
        alert(`${k.replace("_", " ")} is required`);
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

      await fetchAddresses();
      setSelectedAddressId(data.id);
      alert("Address added ✅");
    } catch {
      alert("Server error");
    }
  };

  // ---------------------------
  // CONFIRM -> place order with address_id
  // ---------------------------
  const confirmAndPlaceOrder = async () => {
  if (!token) {
    alert("Login first");
    navigate("/login");
    return;
  }

  if (!selectedAddressId) {
    alert("Please select an address");
    return;
  }

  try {
    setPlacing(true);

    const res = await fetch(
      `${API}/order/buy-now/${id}?qty=${qty}&payment_method=${payMethod}&address_id=${selectedAddressId}`,
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

    if (payMethod === "COD") {
      alert("Order placed successfully (Cash on Delivery)");
      setCheckoutOpen(false);
      navigate("/orders");
      return;
    }

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

    setCheckoutOpen(false);
    openRazorpay(rpData);
  } catch (err) {
    console.log(err);
    alert("Server error");
  } finally {
    setPlacing(false);
  }
};

  if (!product) return <h2 style={{ padding: 50 }}>Loading...</h2>;

  const related = allProducts.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh" }}>
      <div style={styles.breadcrumbs}>
        <Link to="/">Home</Link> / <span>{product.name}</span>
      </div>

      <div style={styles.container}>
        <div
          style={styles.left}
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => setZoom(false)}
        >
          <img
            src={imgUrl(product.image)}
            alt={product.name}
            style={{
              ...styles.image,
              transform: zoom ? "scale(1.4)" : "scale(1)",
            }}
          />
        </div>

        <div style={styles.right}>
          <h1>{product.name}</h1>
          <p style={{ color: "#666" }}>{product.description}</p>

          <h2>₹ {product.price}</h2>
          <p>{product.stock > 0 ? "In Stock" : "Out of Stock"}</p>

          <div style={styles.qtyBox}>
            <button onClick={() => qty > 1 && setQty(qty - 1)}>-</button>
            <span>{qty}</span>
            <button onClick={() => setQty(qty + 1)}>+</button>
          </div>

          <div style={styles.btnRow}>
            <button
              style={styles.btn}
              onClick={addToCart}
              disabled={product.stock <= 0}
            >
              Add to Cart
            </button>

            <button
              style={styles.buyBtn}
              onClick={buyNow}
              disabled={product.stock <= 0}
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Checkout modal (address + payment) */}
      {checkoutOpen && (
        <div
          style={styles.modalOverlay}
          onClick={() => !placing && setCheckoutOpen(false)}
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

            <hr style={{ margin: "16px 0", border: "1px solid #eee" }} />

            <h3 style={{ marginTop: 0 }}>Choose Payment Method</h3>
            <div style={styles.payOptions}>
              <label style={styles.payOption}>
                <input
                  type="radio"
                  name="pay"
                  value="COD"
                  checked={payMethod === "COD"}
                  onChange={() => setPayMethod("COD")}
                />
                <span style={{ fontWeight: 700 }}>Cash on Delivery (COD)</span>
              </label>

              <label style={styles.payOption}>
                <input
                  type="radio"
                  name="pay"
                  value="RAZORPAY"
                  checked={payMethod === "RAZORPAY"}
                  onChange={() => setPayMethod("RAZORPAY")}
                />
                <span style={{ fontWeight: 700 }}>Razorpay (UPI / Card)</span>
              </label>
            </div>

            <div style={styles.modalBtns}>
              <button
                style={styles.secondaryBtn}
                onClick={() => setCheckoutOpen(false)}
                disabled={placing}
              >
                Cancel
              </button>
              <button
                style={styles.primaryBtn}
                onClick={confirmAndPlaceOrder}
                disabled={placing}
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

      {/* Similar Products */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Similar Products</h2>

        {similar.length === 0 ? (
          <p style={{ color: "#666" }}>No similar items found yet.</p>
        ) : (
          <div style={styles.grid}>
            {similar.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} style={styles.card}>
                <img src={imgUrl(p.image)} alt={p.name} style={styles.cardImg} />
                <p style={styles.cardName}>{p.name}</p>
                <b>₹ {p.price}</b>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Related Products */}
      <div style={styles.relatedSection}>
        <h2>Related Products</h2>
        <div style={styles.relatedGrid}>
          {related.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} style={styles.relatedCard}>
              <img
                src={imgUrl(p.image)}
                alt={p.name}
                style={styles.relatedImage}
              />
              <p>{p.name}</p>
              <b>₹ {p.price}</b>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  breadcrumbs: { padding: "20px 60px", fontSize: "14px" },
  container: { display: "flex", gap: "60px", padding: "40px 60px" },
  left: {
    flex: 1,
    background: "#fff",
    padding: "40px",
    borderRadius: "12px",
    overflow: "hidden",
    cursor: "zoom-in",
  },
  right: { flex: 1 },
  image: {
    width: "100%",
    transition: "transform 0.4s ease",
    objectFit: "contain",
  },
  qtyBox: {
    display: "flex",
    gap: "20px",
    alignItems: "center",
    margin: "20px 0",
  },

  btnRow: { display: "flex", gap: "14px", width: "60%" },
  btn: {
    flex: 1,
    padding: "14px",
    background: "#111",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 800,
  },
  buyBtn: {
    flex: 1,
    padding: "14px",
    background: "#fff",
    color: "#111",
    border: "1px solid #111",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 800,
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

  payOptions: { display: "grid", gap: 12, marginTop: 14 },
  payOption: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
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

  section: { padding: "10px 60px 20px" },
  sectionTitle: { marginBottom: 12 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "24px",
  },
  card: {
    background: "#fff",
    padding: "18px",
    borderRadius: "12px",
    textDecoration: "none",
    color: "#333",
    textAlign: "center",
  },
  cardImg: { height: "140px", objectFit: "contain", marginBottom: "10px" },
  cardName: { fontWeight: 700, marginBottom: 6 },

  relatedSection: { padding: "20px 60px 40px" },
  relatedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "24px",
  },
  relatedCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    textDecoration: "none",
    color: "#333",
    textAlign: "center",
  },
  relatedImage: { height: "150px", objectFit: "contain", marginBottom: "10px" },
};

export default ProductDetails;
