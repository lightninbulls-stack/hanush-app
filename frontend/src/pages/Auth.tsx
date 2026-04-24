import React, { useMemo, useState } from "react";
import { loginUser, saveAuthToken } from "../api";

const features = [
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
];

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
      
      {/* ===== LOGIN VIDEO ===== */}
      <section className="video-section">
        <video autoPlay muted loop className="bg-video">
          <source src="/videos/login-bg.mp4" />
        </video>

        <div className="login-card">
          <h2>Lightninbull</h2>
          <p className="sub">{heading}</p>

          <form onSubmit={handleLogin}>
            <input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />

            <button className="btn">
              {loading ? "Loading..." : "Login"}
            </button>
          </form>
        </div>
      </section>

      {/* ===== QUANT AI SECTION ===== */}
      <section className="quant-section">
        <p className="tag">LIGHTNINBULL INTELLIGENCE LAYER</p>

        <h1 className="title">
          Quant <span className="ai-glow">AI</span> Fund Manager
        </h1>

        <p className="desc">
          A next-generation Quant AI Fund Manager combining portfolio analytics,
          factor modeling, regime intelligence, derivatives insights, and real-time trading signals.
        </p>

        <div className="grid">
          {features.map((f) => (
            <div key={f} className="glass-card">
              <h3>{f}</h3>
              <p>Advanced quant-driven insights for smarter trading decisions.</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== STYLES ===== */}
      <style>{`
        
        /* ===== VIDEO ===== */
        .video-section {
          height: 70vh;
          position: relative;
          display: flex;
          align-items: center;
          padding-left: 40px;
        }

        .bg-video {
          position: absolute;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ===== LOGIN CARD ===== */
        .login-card {
          position: relative;
          z-index: 2;
          width: 360px;
          padding: 24px;
          border-radius: 20px;
          background: rgba(0,0,0,0.85);
          border: 1px solid rgba(255,215,0,0.25);
        }

        .sub {
          color: #aaa;
          margin-bottom: 10px;
        }

        .input {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.08);
          color: #fff;
          margin-bottom: 12px;
        }

        .btn {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          background: linear-gradient(90deg,#facc15,#f59e0b);
          border: none;
          font-weight: bold;
          cursor: pointer;
        }

        /* ===== QUANT SECTION ===== */
        .quant-section {
          margin-top: -20px;
          padding: 60px 40px 120px;
          text-align: center;
        }

        .tag {
          color: #facc15;
          letter-spacing: 3px;
        }

        .title {
          font-size: 64px;
          font-weight: 900;
        }

        .desc {
          max-width: 800px;
          margin: 20px auto;
          color: #ccc;
        }

        /* ===== GRID ===== */
        .grid {
          margin-top: 50px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px,1fr));
          gap: 20px;
        }

        /* ===== GLASS CARD ===== */
        .glass-card {
          padding: 22px;
          border-radius: 22px;
          border: 1px solid rgba(255,215,0,0.22);
          background: linear-gradient(145deg, rgba(255,255,255,0.10), rgba(255,255,255,0.025));
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 18px 55px rgba(0,0,0,0.55),
                      inset 0 1px 0 rgba(255,255,255,0.12);
          transition: all 0.35s ease;
        }

        .glass-card:hover {
          transform: translateY(-7px) scale(1.02);
          border: 1px solid rgba(250,204,21,0.5);
          box-shadow: 0 28px 80px rgba(0,0,0,0.75),
                      0 0 30px rgba(250,204,21,0.25),
                      inset 0 1px 0 rgba(255,255,255,0.18);
        }

        .glass-card h3 {
          color: #facc15;
        }

        .glass-card p {
          color: #aaa;
        }

        /* ===== AI GLOW ===== */
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

      `}</style>
    </div>
  );
};

export default Auth;
