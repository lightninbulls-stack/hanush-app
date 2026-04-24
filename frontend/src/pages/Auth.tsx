import React, { useEffect, useMemo, useState } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";

type AuthMode = "login" | "signup";

const initialSignUpState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const quantFeatures = [
  { icon: "⭐", title: "Watchlist", desc: "Track high-conviction stocks with real-time intelligence and signals." },
  { icon: "📊", title: "Portfolio Backtest", desc: "Simulate strategies and evaluate performance with institutional-grade metrics." },
  { icon: "⚡", title: "Consistent Trending", desc: "Identify stocks with stable momentum and sustained directional strength." },
  { icon: "⚖️", title: "Slow Movement", desc: "Capture low-volatility setups for accumulation and positional trades." },
  { icon: "💰", title: "Cheap Value", desc: "Discover undervalued stocks trading below intrinsic value." },
  { icon: "💎", title: "Best Quality", desc: "Filter fundamentally strong companies with superior balance sheets." },
];

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState(initialSignUpState);
  const [loading, setLoading] = useState(false);

  const heading = useMemo(
    () => (mode === "login" ? "Access your trading dashboard" : "Create your account"),
    [mode]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginUser(phone, password);
      saveAuthToken(res.access_token);
      window.location.href = "/dashboard";
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    marginBottom: "12px",
  };

  return (
    <div style={{ background: "#000", color: "#fff" }}>
      
      {/* ===== LOGIN SECTION ===== */}
      <section
        style={{
          height: "70vh",
          position: "relative",
          display: "flex",
          alignItems: "center",
          paddingLeft: "40px",
        }}
      >
        <video
          autoPlay
          muted
          loop
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        >
          <source src="/videos/login-bg.mp4" />
        </video>

        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "360px",
            padding: "24px",
            borderRadius: "20px",
            background: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,215,0,0.25)",
          }}
        >
          <h2>Lightninbull</h2>
          <p style={{ color: "#aaa" }}>{heading}</p>

          <form onSubmit={handleLogin}>
            <input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <button
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                background: "linear-gradient(90deg,#facc15,#f59e0b)",
                border: "none",
                fontWeight: "bold",
              }}
            >
              {loading ? "Loading..." : "Login"}
            </button>
          </form>
        </div>
      </section>

      {/* ===== QUANT AI SECTION (FIXED SPACING) ===== */}
      <section
        id="quant-ai-section"
        style={{
          marginTop: "40px",          // ✅ FIXED (was negative earlier)
          padding: "100px 40px 120px", // ✅ Proper spacing
          textAlign: "center",
        }}
      >
        <p style={{ color: "#facc15", letterSpacing: "3px" }}>
          LIGHTNINBULL INTELLIGENCE LAYER
        </p>

        <h1 style={{ fontSize: "64px", fontWeight: 900 }}>
          Quant <span style={{ color: "#facc15" }}>AI</span> Fund Manager
        </h1>

        <p style={{ maxWidth: "800px", margin: "20px auto", color: "#ccc" }}>
          A next-generation Quant AI Fund Manager combining portfolio analytics,
          factor modeling, regime intelligence, and real-time trading signals.
        </p>

        {/* ===== FEATURES ===== */}
        <div
          style={{
            marginTop: "60px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px,1fr))",
            gap: "20px",
          }}
        >
          {quantFeatures.map((f) => (
            <div
              key={f.title}
              style={{
                padding: "20px",
                borderRadius: "20px",
                border: "1px solid rgba(255,215,0,0.2)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ fontSize: "30px" }}>{f.icon}</div>
              <h3 style={{ color: "#facc15" }}>{f.title}</h3>
              <p style={{ color: "#aaa" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Auth;
