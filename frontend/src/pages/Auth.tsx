import React, { useMemo, useState } from "react";
import { loginUser, saveAuthToken } from "../api";

const Auth: React.FC = () => {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const heading = useMemo(() => "Access your trading dashboard", []);

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

  return (
    <div style={{ background: "#000", color: "#fff" }}>

      {/* ================= LOGIN VIDEO ================= */}
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
            background: "rgba(0,0,0,0.85)",
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

      {/* ================= QUANT AI SECTION ================= */}
      <section
        style={{
          marginTop: "-20px",
          padding: "60px 40px 120px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#facc15", letterSpacing: "3px" }}>
          LIGHTNINBULL INTELLIGENCE LAYER
        </p>

        {/* 🔥 GLOW PULSE AI */}
        <h1 style={{ fontSize: "64px", fontWeight: 900 }}>
          Quant{" "}
          <span className="ai-glow">
            AI
          </span>{" "}
          Fund Manager
        </h1>

        <p style={{ maxWidth: "800px", margin: "20px auto", color: "#ccc" }}>
          A next-generation Quant AI Fund Manager combining portfolio analytics,
          factor modeling, regime intelligence, derivatives insights, and real-time trading signals.
        </p>

        {/* ===== FULL FEATURE GRID ===== */}
        <div
          style={{
            marginTop: "50px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px,1fr))",
            gap: "20px",
          }}
        >
          {[
            "Watchlist",
            "Portfolio Backtest",
            "Consistent Trending",
            "Slow Movement",
            "Cheap Value",
            "Best Quality",
            "Regime Upside",
            "Regime Downside",
            "Range Bound Upside",
            "Range Bound Downside",
            "Aggressive Call Option Stocks",
            "Aggressive Put Option Stocks",
            "Intraday Bull Call Spreads",
            "Intraday Bear Put Spreads",
            "Upside Trend Stocks",
            "Downside Trend Stocks",
          ].map((title) => (
            <div
              key={title}
              style={{
                padding: "20px",
                borderRadius: "20px",
                border: "1px solid rgba(255,215,0,0.2)",
                background: "rgba(255,255,255,0.02)",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 20px rgba(250,204,21,0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "none";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <h3 style={{ color: "#facc15" }}>{title}</h3>
              <p style={{ color: "#aaa" }}>
                Advanced quant-driven insights for smarter trading decisions.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= AI GLOW CSS ================= */}
      <style>
        {`
          .ai-glow {
            color: #facc15;
            animation: glowPulse 1.5s infinite alternate;
          }

          @keyframes glowPulse {
            0% {
              text-shadow: 0 0 5px #facc15;
            }
            100% {
              text-shadow:
                0 0 10px #facc15,
                0 0 20px #facc15,
                0 0 30px #f59e0b;
            }
          }
        `}
      </style>
    </div>
  );
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

export default Auth;
