import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import loginImg from "../assests/login.png";
import { API } from "../config";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

  const handleSignup = async () => {
    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    if (!passwordRegex.test(password)) {
      alert(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    try {
      const res = await fetch(`${API}/user/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: email.split("@")[0],
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Signup failed");
        return;
      }

      alert("Account created successfully! Please login.");
      navigate("/login");
    } catch (err) {
      alert("Server error");
      console.log(err);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-image">
            <img src={loginImg} alt="signup illustration" />
          </div>

          <div className="login-form">
            <h2>Create Your Account</h2>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <p style={{ color: "#666", fontSize: "14px", marginTop: "-5px", marginBottom: "15px" }}>
              Password must contain 8+ characters, uppercase, lowercase, number, and special character.
            </p>

            <div className="login-buttons">
              <button className="login-btn" onClick={handleSignup}>
                Sign Up
              </button>

              <button
                className="create-btn"
                onClick={() => navigate("/login")}
              >
                Already have account?
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
