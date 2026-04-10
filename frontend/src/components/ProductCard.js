// frontend/src/components/ProductCard.jsx
import { BASE_URL } from "../config";  // import from config.js

function ProductCard({ product }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: "10px", margin: "10px" }}>
      <h2>{product.name}</h2>
      <img
        src={
          product.image.startsWith("/images")
            ? `${BASE_URL}${product.image}`
            : `${BASE_URL}/images/${product.image}`
            }
            alt={product.name}
          style={{ width: "150px", height: "150px", objectFit: "cover" }}
        />
      <p>{product.description}</p>
      <p>Price: ₹{product.price}</p>
    </div>
  );
}

export default ProductCard;