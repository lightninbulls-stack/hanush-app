import React, { useMemo, useState } from "react";
import { loginUser, saveAuthToken } from "../api";

const features = [
  { name: "Watchlist", tag: "PORTFOLIO" },
  { name: "Portfolio Backtest", tag: "ANALYTICS" },
  { name: "Consistent Trending", tag: "SIGNALS" },
  { name: "Slow Movement", tag: "SIGNALS" },
  { name: "Cheap Value", tag: "FACTOR" },
  { name: "Best Quality", tag: "FACTOR" },
  { name: "Regime Upside", tag: "REGIME" },
  { name: "Regime Downside", tag: "REGIME" },
  { name: "Range Bound Upside", tag: "RANGE" },
  { name: "Range Bound Downside", tag: "RANGE" },
  { name: "Aggressive Call Option Stocks", tag: "OPTIONS" },
  { name: "Aggressive Put Option Stocks", tag: "OPTIONS" },
  { name: "Intraday Bull Call Spreads", tag: "INTRADAY" },
  { name: "Intraday Bear Put Spreads", tag: "INTRADAY" },
  { name: "Upside Trend Stocks", tag: "TREND" },
  { name: "Downside Trend Stocks", tag: "TREND" },
];

const Auth: React.FC = () => {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const heading = useMemo(() => "access your trading dashboard", []);

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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --black:   #09090b;
          --surface: #111114;
          --border:  #1e1e22;
          --gold:    #c9a84c;
          --gold-dim: rgba(201,168,76,0.18);
          --cream:   #e8e3d8;
          --muted:   rgba(232,227,216,0.38);
          --tiny:    rgba(232,227,216,0.18);
          --font-serif: 'Instrument Serif', Georgia, serif;
          --font-sans:  'DM Sans', sans-serif;
          --font-mono:  'DM Mono', monospace;
        }

        body { background: var(--black); }

        /* ─── NAV ─── */
        .lb-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 56px;
          height: 64px;
          border-bottom: 1px solid var(--border);
          background: rgba(9,9,11,0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .lb-nav-logo {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 4px;
          color: var(--cream);
          text-transform: uppercase;
        }

        .lb-nav-logo span { color: var(--gold); margin-right: 6px; }

        .lb-nav-links {
          display: flex;
          gap: 36px;
        }

        .lb-nav-links a {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.5px;
          color: var(--muted);
          text-decoration: none;
          transition: color 0.2s;
        }

        .lb-nav-links a:hover { color: var(--cream); }

        /* ─── HERO SECTION ─── */
        .lb-hero {
          position: relative;
          height: 100vh;
          min-height: 700px;
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .lb-hero-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.22;
          filter: grayscale(20%);
        }

        /* Multi-layer overlay — exactly like CRED's dark vignette */
        .lb-hero-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to right, rgba(9,9,11,0.96) 42%, rgba(9,9,11,0.55) 70%, rgba(9,9,11,0.85) 100%),
            linear-gradient(to top, rgba(9,9,11,0.7) 0%, transparent 50%);
        }

        /* Subtle gold edge glow top-left */
        .lb-hero-glow {
          position: absolute;
          top: -200px; left: -200px;
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%);
          pointer-events: none;
        }

        .lb-hero-inner {
          position: relative;
          z-index: 2;
          width: 100%;
          padding: 0 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 48px;
          padding-top: 64px; /* nav offset */
        }

        /* ─── HERO LEFT ─── */
        .lb-hero-left {
          flex: 1;
          max-width: 560px;
        }

        .lb-eyebrow {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 5px;
          color: var(--gold);
          text-transform: uppercase;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .lb-eyebrow::before {
          content: '';
          display: block;
          width: 28px;
          height: 1px;
          background: var(--gold);
          opacity: 0.6;
        }

        .lb-hero-title {
          font-family: var(--font-serif);
          font-size: 76px;
          font-weight: 400;
          line-height: 1.0;
          color: var(--cream);
          letter-spacing: -1.5px;
          margin-bottom: 28px;
        }

        .lb-hero-title em {
          font-style: italic;
          color: var(--gold);
        }

        .lb-hero-sub {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 300;
          line-height: 1.85;
          color: var(--muted);
          max-width: 400px;
          margin-bottom: 52px;
        }

        /* Stats row — CRED-style small data strip */
        .lb-stats {
          display: flex;
          align-items: center;
          gap: 0;
          border: 1px solid var(--border);
          border-radius: 3px;
          overflow: hidden;
          max-width: 440px;
        }

        .lb-stat {
          flex: 1;
          padding: 18px 24px;
          border-right: 1px solid var(--border);
        }

        .lb-stat:last-child { border-right: none; }

        .lb-stat-num {
          display: block;
          font-family: var(--font-serif);
          font-size: 22px;
          color: var(--cream);
          letter-spacing: -0.5px;
          margin-bottom: 3px;
        }

        .lb-stat-lbl {
          display: block;
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 2.5px;
          color: var(--muted);
          text-transform: uppercase;
        }

        /* ─── LOGIN CARD ─── */
        .lb-card {
          flex-shrink: 0;
          width: 368px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 2px;
          overflow: hidden;
        }

        /* Gold top accent bar */
        .lb-card-bar {
          height: 2px;
          background: linear-gradient(90deg, var(--gold) 0%, rgba(201,168,76,0.3) 60%, transparent 100%);
        }

        .lb-card-body {
          padding: 36px 32px 32px;
        }

        .lb-card-logo {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 4px;
          color: var(--gold);
          text-transform: uppercase;
          margin-bottom: 6px;
          display: block;
        }

        .lb-card-sub {
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 300;
          color: var(--muted);
          margin-bottom: 28px;
          letter-spacing: 0.2px;
        }

        .lb-card-divider {
          height: 1px;
          background: var(--border);
          margin-bottom: 28px;
        }

        /* Input */
        .lb-field {
          margin-bottom: 16px;
        }

        .lb-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 3px;
          color: var(--tiny);
          text-transform: uppercase;
          margin-bottom: 9px;
        }

        .lb-input {
          width: 100%;
          padding: 13px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: 2px;
          color: var(--cream);
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 300;
          outline: none;
          transition: border-color 0.25s ease, background 0.25s ease;
          letter-spacing: 0.3px;
        }

        .lb-input::placeholder {
          color: rgba(232,227,216,0.12);
        }

        .lb-input:focus {
          border-color: rgba(201,168,76,0.45);
          background: rgba(201,168,76,0.03);
        }

        /* Submit button */
        .lb-btn {
          width: 100%;
          margin-top: 24px;
          padding: 14px;
          background: var(--gold);
          border: none;
          border-radius: 2px;
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 3px;
          color: var(--black);
          text-transform: uppercase;
          position: relative;
          overflow: hidden;
          transition: opacity 0.2s;
        }

        .lb-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
          transform: translateX(-100%);
          transition: transform 0.55s ease;
        }

        .lb-btn:hover::after { transform: translateX(100%); }
        .lb-btn:hover { opacity: 0.88; }
        .lb-btn:disabled { opacity: 0.5; cursor: default; }

        .lb-btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .lb-spinner {
          width: 11px; height: 11px;
          border: 1.5px solid rgba(9,9,11,0.3);
          border-top-color: var(--black);
          border-radius: 50%;
          animation: lb-spin 0.65s linear infinite;
        }

        @keyframes lb-spin { to { transform: rotate(360deg); } }

        .lb-forgot {
          margin-top: 14px;
          text-align: center;
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 300;
          color: var(--tiny);
        }

        .lb-forgot a {
          color: rgba(201,168,76,0.55);
          text-decoration: none;
          transition: color 0.2s;
        }

        .lb-forgot a:hover { color: var(--gold); }

        /* Scroll cue */
        .lb-scroll-cue {
          position: absolute;
          bottom: 32px;
          left: 56px;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 16px;
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 4px;
          color: var(--tiny);
          text-transform: uppercase;
        }

        .lb-scroll-line {
          width: 48px;
          height: 1px;
          background: linear-gradient(90deg, var(--gold), transparent);
          animation: lb-pulse 2.2s ease-in-out infinite;
        }

        @keyframes lb-pulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.8; }
        }

        /* ─── INTELLIGENCE SECTION ─── */
        .lb-intel {
          background: var(--black);
          padding: 160px 56px 140px;
        }

        /* CRED-style centered editorial header */
        .lb-intel-header {
          text-align: center;
          margin-bottom: 100px;
        }

        .lb-section-tag {
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 6px;
          color: var(--gold);
          text-transform: uppercase;
          margin-bottom: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }

        .lb-section-tag::before,
        .lb-section-tag::after {
          content: '';
          display: block;
          width: 60px;
          height: 1px;
          background: var(--border);
        }

        .lb-intel-title {
          font-family: var(--font-serif);
          font-size: 68px;
          font-weight: 400;
          color: var(--cream);
          letter-spacing: -1.5px;
          line-height: 1.0;
          margin-bottom: 28px;
        }

        .lb-intel-title em {
          font-style: italic;
          color: var(--gold);
          text-shadow:
            0 0 30px rgba(201,168,76,0.4),
            0 0 80px rgba(201,168,76,0.15);
          animation: lb-glow 2.8s ease-in-out infinite alternate;
        }

        @keyframes lb-glow {
          from { text-shadow: 0 0 20px rgba(201,168,76,0.25), 0 0 60px rgba(201,168,76,0.08); }
          to   { text-shadow: 0 0 40px rgba(201,168,76,0.55), 0 0 100px rgba(201,168,76,0.2); }
        }

        .lb-intel-desc {
          max-width: 620px;
          margin: 0 auto;
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 300;
          line-height: 2;
          color: var(--muted);
          letter-spacing: 0.2px;
        }

        /* ─── FEATURE TILES — CRED product-tile grid ─── */
        .lb-tiles {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border: 1px solid var(--border);
          border-radius: 2px;
          overflow: hidden;
        }

        .lb-tile {
          position: relative;
          padding: 36px 28px 32px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--black);
          transition: background 0.3s ease;
          cursor: default;
          overflow: hidden;
        }

        /* Remove right border from every 4th */
        .lb-tile:nth-child(4n) { border-right: none; }

        /* Remove bottom border from last row */
        .lb-tile:nth-last-child(-n+4) { border-bottom: none; }

        /* Radial sweep on hover — CRED's signature */
        .lb-tile::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 110%, rgba(201,168,76,0.08) 0%, transparent 65%);
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        /* Gold hairline top on hover */
        .lb-tile::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, var(--gold), transparent 60%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .lb-tile:hover {
          background: #0e0e11;
        }

        .lb-tile:hover::before { opacity: 1; }
        .lb-tile:hover::after  { opacity: 0.7; }

        .lb-tile-tag {
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 3px;
          color: var(--gold);
          opacity: 0.6;
          text-transform: uppercase;
          margin-bottom: 18px;
          display: block;
          transition: opacity 0.3s;
        }

        .lb-tile:hover .lb-tile-tag { opacity: 1; }

        .lb-tile-name {
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 400;
          color: rgba(232,227,216,0.72);
          line-height: 1.45;
          margin-bottom: 14px;
          transition: color 0.3s;
          letter-spacing: 0.1px;
        }

        .lb-tile:hover .lb-tile-name { color: var(--cream); }

        .lb-tile-arrow {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--gold);
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 0.3s, transform 0.3s;
          display: inline-block;
        }

        .lb-tile:hover .lb-tile-arrow {
          opacity: 0.7;
          transform: translateX(0);
        }

        /* ─── FOOTER ─── */
        .lb-footer {
          border-top: 1px solid var(--border);
          padding: 28px 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lb-footer-logo {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 3px;
          color: rgba(201,168,76,0.5);
        }

        .lb-footer-copy {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 300;
          color: var(--tiny);
          letter-spacing: 0.2px;
        }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 1080px) {
          .lb-tiles { grid-template-columns: repeat(2, 1fr); }
          .lb-tile:nth-child(4n) { border-right: 1px solid var(--border); }
          .lb-tile:nth-child(2n) { border-right: none; }
          .lb-tile:nth-last-child(-n+4) { border-bottom: 1px solid var(--border); }
          .lb-tile:nth-last-child(-n+2) { border-bottom: none; }
          .lb-hero-inner { flex-direction: column; padding-top: 100px; align-items: flex-start; }
          .lb-card { width: 100%; max-width: 420px; }
          .lb-hero-title { font-size: 54px; }
          .lb-nav { padding: 0 28px; }
          .lb-intel { padding: 100px 28px 100px; }
        }

        @media (max-width: 640px) {
          .lb-hero-title { font-size: 38px; }
          .lb-intel-title { font-size: 42px; }
          .lb-tiles { grid-template-columns: 1fr; }
          .lb-tile { border-right: none !important; }
          .lb-tile:last-child { border-bottom: none !important; }
          .lb-nav-links { display: none; }
          .lb-stats { flex-direction: column; }
          .lb-stat { border-right: none !important; border-bottom: 1px solid var(--border); }
          .lb-stat:last-child { border-bottom: none; }
          .lb-footer { flex-direction: column; gap: 10px; text-align: center; }
          .lb-hero-inner { padding: 100px 20px 0; }
          .lb-scroll-cue { left: 20px; }
        }
      `}</style>

      <div style={{ background: "var(--black)", color: "var(--cream)", fontFamily: "var(--font-sans)" }}>

        {/* ── NAV ── */}
        <nav className="lb-nav">
          <span className="lb-nav-logo"><span>⚡</span>lightninbull</span>
          <div className="lb-nav-links">
            <a href="#">markets</a>
            <a href="#">intelligence</a>
            <a href="#">research</a>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="lb-hero">
          <video autoPlay muted loop playsInline className="lb-hero-video">
            <source src="/videos/login-bg.mp4" />
          </video>
          <div className="lb-hero-overlay" />
          <div className="lb-hero-glow" />

          <div className="lb-hero-inner">
            {/* Left copy */}
            <div className="lb-hero-left">
              <p className="lb-eyebrow">institutional quant intelligence</p>

              <h1 className="lb-hero-title">
                trade with the<br />
                <em>precision</em><br />
                of algorithms.
              </h1>

              <p className="lb-hero-sub">
                real-time signals. deep factor analytics.<br />
                built for professionals who demand an edge.
              </p>

              <div className="lb-stats">
                <div className="lb-stat">
                  <span className="lb-stat-num">16+</span>
                  <span className="lb-stat-lbl">AI modules</span>
                </div>
                <div className="lb-stat">
                  <span className="lb-stat-num">live</span>
                  <span className="lb-stat-lbl">signal engine</span>
                </div>
                <div className="lb-stat">
                  <span className="lb-stat-num">quant</span>
                  <span className="lb-stat-lbl">factor models</span>
                </div>
              </div>
            </div>

            {/* Login card */}
            <div className="lb-card">
              <div className="lb-card-bar" />
              <div className="lb-card-body">
                <span className="lb-card-logo">⚡ lightninbull</span>
                <p className="lb-card-sub">{heading}</p>
                <div className="lb-card-divider" />

                <form onSubmit={handleLogin}>
                  <div className="lb-field">
                    <label className="lb-label">phone number</label>
                    <input
                      className="lb-input"
                      placeholder="+91 00000 00000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="lb-field">
                    <label className="lb-label">password</label>
                    <input
                      type="password"
                      className="lb-input"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <button className="lb-btn" disabled={loading}>
                    <span className="lb-btn-inner">
                      {loading ? (
                        <>
                          <span className="lb-spinner" />
                          authenticating
                        </>
                      ) : (
                        "access dashboard →"
                      )}
                    </span>
                  </button>
                </form>

                <p className="lb-forgot">
                  forgot credentials?&nbsp;
                  <a href="#">contact support</a>
                </p>
              </div>
            </div>
          </div>

          <div className="lb-scroll-cue">
            <div className="lb-scroll-line" />
            scroll to explore
          </div>
        </section>

        {/* ── INTELLIGENCE SECTION ── */}
        <section className="lb-intel">
          <div className="lb-intel-header">
            <p className="lb-section-tag">lightninbull intelligence layer</p>
            <h2 className="lb-intel-title">
              quant <em>AI</em> fund manager
            </h2>
            <p className="lb-intel-desc">
              a next-generation quantitative platform combining portfolio analytics,
              factor modeling, regime intelligence, derivatives insights, and
              real-time trading signals — all in one unified intelligence layer.
            </p>
          </div>

          <div className="lb-tiles">
            {features.map((f) => (
              <div key={f.name} className="lb-tile">
                <span className="lb-tile-tag">{f.tag}</span>
                <p className="lb-tile-name">{f.name}</p>
                <span className="lb-tile-arrow">→</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="lb-footer">
          <span className="lb-footer-logo">⚡ lightninbull</span>
          <span className="lb-footer-copy">
            © {new Date().getFullYear()} lightninbull. institutional quant intelligence.
          </span>
        </footer>

      </div>
    </>
  );
};

export default Auth;
