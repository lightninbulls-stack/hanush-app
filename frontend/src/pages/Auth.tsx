import React, { useMemo, useState } from "react";
import { loginUser, saveAuthToken } from "../api";

const features = [
  { name: "Watchlist", icon: "◈" },
  { name: "Portfolio Backtest", icon: "◉" },
  { name: "Consistent Trending", icon: "◆" },
  { name: "Slow Movement", icon: "◇" },
  { name: "Cheap Value", icon: "◐" },
  { name: "Best Quality", icon: "◑" },
  { name: "Regime Upside", icon: "▲" },
  { name: "Regime Downside", icon: "▼" },
  { name: "Range Bound Upside", icon: "◭" },
  { name: "Range Bound Downside", icon: "◮" },
  { name: "Aggressive Call Option Stocks", icon: "⬡" },
  { name: "Aggressive Put Option Stocks", icon: "⬢" },
  { name: "Intraday Bull Call Spreads", icon: "◈" },
  { name: "Intraday Bear Put Spreads", icon: "◇" },
  { name: "Upside Trend Stocks", icon: "◆" },
  { name: "Downside Trend Stocks", icon: "◉" },
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
    <div style={{ background: "#050608", color: "#fff" }}>

      {/* ===== HERO / LOGIN SECTION ===== */}
      <section className="hero-section">
        <video autoPlay muted loop className="bg-video">
          <source src="/videos/login-bg.mp4" />
        </video>

        {/* Gradient overlay */}
        <div className="video-overlay" />

        {/* Noise texture overlay */}
        <div className="noise-overlay" />

        {/* Top nav bar */}
        <nav className="top-nav">
          <span className="nav-logo">
            <span className="logo-bolt">⚡</span> LIGHTNINBULL
          </span>
          <div className="nav-links">
            <span>Markets</span>
            <span>Intelligence</span>
            <span>Research</span>
          </div>
        </nav>

        {/* Floating horizontal rule */}
        <div className="hero-content">
          {/* Left: headline copy */}
          <div className="hero-left">
            <p className="eyebrow-label">INSTITUTIONAL-GRADE QUANT PLATFORM</p>
            <h1 className="hero-headline">
              Trade with the<br />
              <span className="headline-gold">precision</span><br />
              of algorithms.
            </h1>
            <p className="hero-subtext">
              Real-time signals. Deep factor analytics.<br />
              Built for professionals who demand an edge.
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">16+</span>
                <span className="stat-label">AI Modules</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">Real-Time</span>
                <span className="stat-label">Signal Engine</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">Quant</span>
                <span className="stat-label">Factor Models</span>
              </div>
            </div>
          </div>

          {/* Right: login card */}
          <div className="login-card">
            <div className="card-header">
              <span className="card-logo">⚡ LIGHTNINBULL</span>
              <p className="card-sub">{heading}</p>
            </div>

            <div className="card-divider" />

            <form onSubmit={handleLogin} className="login-form">
              <div className="input-group">
                <label className="input-label">PHONE NUMBER</label>
                <input
                  placeholder="+91 00000 00000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                />
              </div>

              <div className="input-group">
                <label className="input-label">PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                />
              </div>

              <button className="btn" disabled={loading}>
                {loading ? (
                  <span className="btn-loading">
                    <span className="spinner" /> Authenticating...
                  </span>
                ) : (
                  <span>Access Dashboard →</span>
                )}
              </button>

              <p className="forgot-link">Forgot credentials? <a href="#">Contact support</a></p>
            </form>
          </div>
        </div>

        {/* Bottom scroll indicator */}
        <div className="scroll-indicator">
          <span>SCROLL TO EXPLORE</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* ===== INTELLIGENCE SECTION ===== */}
      <section className="intelligence-section">
        {/* Section label */}
        <div className="section-label-row">
          <div className="label-line" />
          <p className="section-label">LIGHTNINBULL INTELLIGENCE LAYER</p>
          <div className="label-line" />
        </div>

        <h2 className="section-title">
          Quant <em className="ai-word">AI</em> Fund Manager
        </h2>

        <p className="section-desc">
          A next-generation quantitative platform combining portfolio analytics, factor modeling,
          regime intelligence, derivatives insights, and real-time trading signals — all in one
          unified intelligence layer.
        </p>

        {/* Feature grid */}
        <div className="feature-grid">
          {features.map((f, i) => (
            <div key={f.name} className="feature-card" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="card-icon">{f.icon}</div>
              <h3 className="card-title">{f.name}</h3>
              <p className="card-desc">Advanced quant-driven insights for smarter trading decisions.</p>
              <div className="card-corner" />
            </div>
          ))}
        </div>
      </section>

      {/* ===== FOOTER STRIP ===== */}
      <footer className="footer-strip">
        <span className="footer-logo">⚡ LIGHTNINBULL</span>
        <span className="footer-copy">© {new Date().getFullYear()} Institutional Quant Intelligence. All rights reserved.</span>
      </footer>

      {/* ===== ALL STYLES ===== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ============================================================
           HERO
        ============================================================ */
        .hero-section {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Syne', sans-serif;
        }

        .bg-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.35;
        }

        .video-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(5, 6, 8, 0.92) 0%,
            rgba(5, 6, 8, 0.65) 50%,
            rgba(5, 6, 8, 0.88) 100%
          );
          z-index: 1;
        }

        .noise-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
          pointer-events: none;
        }

        /* ---- NAV ---- */
        .top-nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 60px;
          border-bottom: 1px solid rgba(250, 204, 21, 0.08);
        }

        .nav-logo {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 3px;
          color: #fff;
        }

        .logo-bolt {
          color: #facc15;
          margin-right: 4px;
        }

        .nav-links {
          display: flex;
          gap: 40px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.45);
        }

        .nav-links span {
          cursor: pointer;
          transition: color 0.2s;
        }

        .nav-links span:hover {
          color: #facc15;
        }

        /* ---- HERO CONTENT ---- */
        .hero-content {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 60px 60px 40px;
          gap: 60px;
        }

        /* ---- HERO LEFT ---- */
        .hero-left {
          max-width: 580px;
        }

        .eyebrow-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 4px;
          color: #facc15;
          margin-bottom: 28px;
          opacity: 0.9;
        }

        .hero-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: 82px;
          font-weight: 300;
          line-height: 1.02;
          color: #fff;
          letter-spacing: -1px;
        }

        .headline-gold {
          color: #facc15;
          font-style: italic;
          font-weight: 300;
        }

        .hero-subtext {
          margin-top: 28px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          line-height: 1.8;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.5px;
        }

        .hero-stats {
          display: flex;
          align-items: center;
          gap: 32px;
          margin-top: 48px;
          padding-top: 36px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #facc15;
          letter-spacing: 1px;
        }

        .stat-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
        }

        .stat-divider {
          width: 1px;
          height: 36px;
          background: rgba(255,255,255,0.1);
        }

        /* ---- LOGIN CARD ---- */
        .login-card {
          position: relative;
          z-index: 10;
          flex-shrink: 0;
          width: 380px;
          padding: 36px;
          border-radius: 4px;
          background: rgba(8, 9, 12, 0.92);
          border: 1px solid rgba(250, 204, 21, 0.18);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 40px 80px rgba(0,0,0,0.6),
            0 0 60px rgba(250,204,21,0.04);
          backdrop-filter: blur(24px);
        }

        /* Accent top bar */
        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #facc15, transparent);
          border-radius: 4px 4px 0 0;
        }

        .card-header {
          margin-bottom: 24px;
        }

        .card-logo {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 3px;
          color: #facc15;
        }

        .card-sub {
          margin-top: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.35);
        }

        .card-divider {
          height: 1px;
          background: rgba(255,255,255,0.07);
          margin-bottom: 28px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.3);
        }

        .input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          letter-spacing: 0.5px;
        }

        .input:focus {
          border-color: rgba(250,204,21,0.4);
          background: rgba(250,204,21,0.03);
        }

        .input::placeholder {
          color: rgba(255,255,255,0.18);
        }

        .btn {
          width: 100%;
          padding: 15px;
          border-radius: 3px;
          background: linear-gradient(90deg, #facc15 0%, #f59e0b 100%);
          border: none;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 2px;
          color: #050608;
          cursor: pointer;
          margin-top: 8px;
          transition: opacity 0.2s, transform 0.15s;
          position: relative;
          overflow: hidden;
        }

        .btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        }

        .btn:hover::after {
          transform: translateX(100%);
        }

        .btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: default;
          transform: none;
        }

        .btn-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(5,6,8,0.3);
          border-top-color: #050608;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .forgot-link {
          text-align: center;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          letter-spacing: 0.5px;
        }

        .forgot-link a {
          color: rgba(250,204,21,0.6);
          text-decoration: none;
          transition: color 0.2s;
        }

        .forgot-link a:hover { color: #facc15; }

        /* ---- SCROLL INDICATOR ---- */
        .scroll-indicator {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px 60px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 4px;
          color: rgba(255,255,255,0.2);
        }

        .scroll-line {
          flex: 1;
          max-width: 80px;
          height: 1px;
          background: linear-gradient(90deg, rgba(250,204,21,0.4), transparent);
          animation: scrollPulse 2s ease-in-out infinite;
        }

        @keyframes scrollPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        /* ============================================================
           INTELLIGENCE SECTION
        ============================================================ */
        .intelligence-section {
          padding: 120px 60px 140px;
          font-family: 'Syne', sans-serif;
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(250,204,21,0.04) 0%, transparent 70%),
            #050608;
        }

        .section-label-row {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 48px;
        }

        .label-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.07);
        }

        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 5px;
          color: rgba(250,204,21,0.7);
          white-space: nowrap;
        }

        .section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 72px;
          font-weight: 300;
          text-align: center;
          color: #fff;
          letter-spacing: -1px;
          line-height: 1;
        }

        .ai-word {
          font-style: italic;
          color: #facc15;
          font-weight: 300;
          position: relative;
          text-shadow:
            0 0 40px rgba(250,204,21,0.5),
            0 0 80px rgba(250,204,21,0.2);
          animation: subtleGlow 2.5s ease-in-out infinite alternate;
        }

        @keyframes subtleGlow {
          from {
            text-shadow: 0 0 20px rgba(250,204,21,0.3), 0 0 60px rgba(250,204,21,0.1);
          }
          to {
            text-shadow: 0 0 40px rgba(250,204,21,0.6), 0 0 100px rgba(250,204,21,0.25);
          }
        }

        .section-desc {
          max-width: 680px;
          margin: 32px auto 80px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          line-height: 2;
          color: rgba(255,255,255,0.38);
          text-align: center;
          letter-spacing: 0.3px;
        }

        /* ---- FEATURE GRID ---- */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 4px;
          overflow: hidden;
        }

        .feature-card {
          position: relative;
          padding: 32px 28px;
          background: rgba(8, 9, 12, 0.95);
          transition: background 0.3s ease;
          overflow: hidden;
          animation: fadeUp 0.5s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .feature-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.07), transparent 60%);
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .feature-card:hover {
          background: rgba(14, 15, 18, 1);
        }

        .feature-card:hover::after {
          opacity: 1;
        }

        /* Gold top border on hover */
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #facc15, transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .feature-card:hover::before {
          opacity: 0.6;
        }

        .card-icon {
          font-size: 18px;
          color: rgba(250,204,21,0.5);
          margin-bottom: 16px;
          display: block;
          transition: color 0.3s;
        }

        .feature-card:hover .card-icon {
          color: #facc15;
        }

        .card-title {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          color: rgba(255,255,255,0.85);
          margin-bottom: 10px;
          line-height: 1.4;
          transition: color 0.3s;
        }

        .feature-card:hover .card-title {
          color: #fff;
        }

        .card-desc {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          line-height: 1.7;
          color: rgba(255,255,255,0.25);
          letter-spacing: 0.2px;
        }

        /* Corner accent */
        .card-corner {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 20px;
          height: 20px;
          border-top: 1px solid rgba(250,204,21,0.15);
          border-left: 1px solid rgba(250,204,21,0.15);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .feature-card:hover .card-corner {
          opacity: 1;
        }

        /* ============================================================
           FOOTER
        ============================================================ */
        .footer-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 60px;
          border-top: 1px solid rgba(255,255,255,0.05);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.2);
        }

        .footer-logo {
          color: rgba(250,204,21,0.5);
          font-weight: 500;
        }

        /* ============================================================
           RESPONSIVE
        ============================================================ */
        @media (max-width: 1100px) {
          .hero-content { flex-direction: column; padding: 40px 32px; align-items: flex-start; }
          .hero-headline { font-size: 56px; }
          .login-card { width: 100%; max-width: 440px; }
          .feature-grid { grid-template-columns: repeat(2, 1fr); }
          .top-nav { padding: 24px 32px; }
          .intelligence-section { padding: 80px 32px 100px; }
        }

        @media (max-width: 640px) {
          .hero-headline { font-size: 40px; }
          .section-title { font-size: 44px; }
          .feature-grid { grid-template-columns: 1fr; }
          .top-nav .nav-links { display: none; }
          .hero-stats { flex-wrap: wrap; gap: 20px; }
          .footer-strip { flex-direction: column; gap: 10px; text-align: center; }
        }
      `}</style>
    </div>
  );
};

export default Auth;
