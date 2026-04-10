import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import loginImg from "../assests/login.png";
import "../pages/Login.css";

import { API } from "../config";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
  try {
    const res = await fetch(`${API}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Login failed");
      return;
    }

    localStorage.setItem("token", data.access_token);
    navigate("/");
  } catch (err) {
    alert("Backend not reachable. Check if FastAPI is running on port 8000.");
    console.log(err);
  }
};


  return (
    <div>

      <div className="login-page">
        <div className="login-card">

          {/* LEFT IMAGE */}
          <div className="login-image">
            <img src={loginImg} alt="login" />
          </div>

          {/* RIGHT FORM */}
          <div className="login-form">
            <h2>Welcome Back</h2>
            <p>Login to continue shopping</p>

            <input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={handleLogin}>Login</button>

            <p className="create">
              New user?{" "}
              <span onClick={() => navigate("/signup")}>
                Create Account
              </span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;
