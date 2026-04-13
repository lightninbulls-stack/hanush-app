import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";

const API = import.meta.env.VITE_API_URL;

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await axios.post(`${API}/auth/register`, {
          name,
          email,
          phone,
          password,
        });

        alert("Registration successful. Please login.");
        setMode("login");
        resetForm();
      } else {
        const res = await axios.post(`${API}/auth/login`, {
          phone,
          password,
        });

        localStorage.setItem("token", res.data.access_token);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lb-auth-page">
      <header className="lb-auth-header">
        <div className="lb-auth-header-inner">
          <Link to="/" className="lb-auth-brand">
            <img
              src="/lightninbull-bull.png"
              alt="Lightnin Bull"
              className="lb-auth-brand-logo"
            />
            <div className="lb-auth-brand-copy">
              <span className="lb-auth-brand-title">Lightnin Bull</span>
              <span className="lb-auth-brand-subtitle">Financial Analytics</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="lb-auth-main">
        <section className="lb-auth-left">
          <p className="lb-auth-eyebrow">
            BACKTESTING • FACTORS • MARKET INTELLIGENCE
          </p>

          <h1 className="lb-auth-hero-title">
            Start your
            <br />
            <span>market research</span> here
          </h1>

          <p className="lb-auth-hero-text">
            Access premium dashboards for Momentum, Low Volatility, Value,
            Quality, and derivative-driven opportunity screening for Indian
            markets.
          </p>

          <div className="lb-auth-points">
            <span>Factor Dashboards</span>
            <span>Ranked Stock Views</span>
            <span>Derivative Analytics</span>
            <span>Clean Research Workflow</span>
          </div>
        </section>

        <section className="lb-auth-right">
          <div className="lb-auth-card">
            <h2 className="lb-auth-card-title">
              {isRegister ? "Sign Up" : "Login"}
            </h2>

            <div className="lb-auth-switch">
              <button
                type="button"
                className={!isRegister ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  resetForm();
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={isRegister ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  resetForm();
                }}
              >
                Sign Up
              </button>
            </div>

            <div className="lb-auth-form">
              {isRegister && (
                <div className="lb-auth-field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              {isRegister && (
                <div className="lb-auth-field">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}

              <div className="lb-auth-field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="lb-auth-field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error ? <div className="lb-auth-error">{error}</div> : null}

              <button
                type="button"
                className="lb-auth-submit"
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? "Please wait..." : isRegister ? "Create Account" : "Login"}
              </button>

              <p className="lb-auth-footer-text">
                {isRegister ? "Already have an account?" : "Don’t have an account?"}{" "}
                <span
                  onClick={() => {
                    setMode(isRegister ? "login" : "register");
                    resetForm();
                  }}
                >
                  {isRegister ? "Login" : "Sign Up"}
                </span>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
