import { Routes, Route } from "react-router-dom";  // ✅ removed HashRouter
import Navbar from "./components/Navbar";

import Home from "./Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Cart from "./Cart";
import Orders from "./Orders";
import ProductDetails from "./ProductDetails";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProducts from "./pages/AdminProducts";
import AdminOrders from "./pages/AdminOrders";
import Wishlist from "./pages/Wishlist";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/search" element={<Search />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/products" element={<AdminProducts />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/staff/orders" element={<AdminOrders />} />
        <Route path="/wishlist" element={<Wishlist />} />
      </Routes>
    </>
  );
}