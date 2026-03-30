import React from "react";
import { Link } from "react-router-dom";
import "./MarketingHome.css";

const features = [
  {
    title: "Factor Intelligence",
    desc: "Track Momentum, Low Volatility, Quality, Value, and custom regime screens across Indian equities.",
  },
  {
    title: "Derivative Opportunity View",
    desc: "Monitor option-driven setups, directional pressure, and idea flow through a cleaner institutional-style workflow.",
  },
  {
    title: "Built for Decision Speed",
    desc: "See ranked opportunities, stock-level detail, and actionable dashboard views without noisy clutter.",
  },
];

const stats = [
  { value: "5+", label: "Core factor engines" },
  { value: "Daily", label: "Data refresh workflow" },
  { value: "India", label: "Market focus" },
  { value: "Pro", label: "Research-first UX" },
];

export default function MarketingHome() {
  return (
    <div className="lb-home">
      <header className="lb-nav">
        <div className="lb-brand">
          <div className="lb-brand-badge">LB</div>
          <span>Lightnin Bull</span>
        </div>

        <nav className="lb-nav-links">
          <a href="#features">Features</a>
          <a href="#platform">Platform</a>
          <a href="#proof">Why Lightnin Bull</a>
        </nav>

        <div className="lb-nav-actions">
          <Link to="/login" className="lb-btn lb-btn-ghost">
            Login
          </Link>
          <Link to="/dashboard" className="lb-btn lb-btn-primary">
            Dashboard
          </Link>
        </div>
      </header>

      <main>
        <section className="lb-hero">
          <div className="lb-hero-glow lb-hero-glow-1" />
          <div className="lb-hero-glow lb-hero-glow-2" />

          <p className="lb-eyebrow">QUANT ANALYTICS PLATFORM</p>

          <h1>
            Institutional-grade <span>factor intelligence</span>
            <br />
            for Indian markets
          </h1>

          <p className="lb-hero-copy">
            Momentum, low volatility, quality, value, and derivatives analytics
            built for serious investors and traders who want cleaner signals and
            stronger workflows.
          </p>

          <div className="lb-hero-actions">
            <Link to="/dashboard" className="lb-btn lb-btn-primary">
              Explore Dashboard
            </Link>
            <a href="#platform" className="lb-btn lb-btn-ghost">
              View Platform
            </a>
          </div>

          <div className="lb-proof-strip">
            <span>Premium factor dashboards</span>
            <span>Clean institutional workflow</span>
            <span>India-focused analytics</span>
          </div>
        </section>

        <section id="platform" className="lb-platform">
          <div className="lb-section-head">
            <p className="lb-eyebrow">PLATFORM</p>
            <h2>Designed to feel premium, fast, and focused</h2>
            <p>
              The landing page should not stop at a headline. It should show the
              product, frame the value, and build trust in seconds.
            </p>
          </div>

          <div className="lb-platform-card">
            <div className="lb-platform-left">
              <div className="lb-mini-chip">Live dashboard preview</div>
              <h3>One premium workspace for factor-driven market research</h3>
              <p>
                Replace dead space with a product story. Show rankings, signals,
                dashboards, and stock-level drilldowns in a polished shell.
              </p>

              <ul className="lb-checks">
                <li>Factor ranking screens</li>
                <li>Clean stock analytics pages</li>
                <li>Premium visual hierarchy</li>
                <li>Future-ready for intraday signals</li>
              </ul>
            </div>

            <div className="lb-platform-right">
              <div className="lb-preview-window">
                <div className="lb-preview-topbar">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="lb-preview-grid">
                  <div className="lb-preview-panel lb-preview-tall">
                    <p className="lb-preview-label">Top Momentum</p>
                    <h4>RELIANCE</h4>
                    <small>Score 96</small>
                  </div>
                  <div className="lb-preview-panel">
                    <p className="lb-preview-label">Low Volatility</p>
                    <h4>HDFCBANK</h4>
                    <small>Score 93</small>
                  </div>
                  <div className="lb-preview-panel">
                    <p className="lb-preview-label">Quality</p>
                    <h4>TCS</h4>
                    <small>Score 91</small>
                  </div>
                  <div className="lb-preview-panel lb-preview-wide">
                    <p className="lb-preview-label">Signal View</p>
                    <div className="lb-fake-chart" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="lb-features">
          <div className="lb-section-head">
            <p className="lb-eyebrow">FEATURES</p>
            <h2>Premium by feel. Useful by design.</h2>
          </div>

          <div className="lb-feature-grid">
            {features.map((item) => (
              <div key={item.title} className="lb-feature-card">
                <div className="lb-feature-icon" />
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="proof" className="lb-stats">
          <div className="lb-section-head center">
            <p className="lb-eyebrow">WHY LIGHTNIN BULL</p>
            <h2>Built to look sharper and think deeper</h2>
          </div>

          <div className="lb-stat-grid">
            {stats.map((item) => (
              <div key={item.label} className="lb-stat-card">
                <h3>{item.value}</h3>
                <p>{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lb-cta">
          <p className="lb-eyebrow">START NOW</p>
          <h2>Sharper factor research starts with a sharper interface.</h2>
          <p>
            Give Lightnin Bull a more premium identity and users will trust the
            platform faster.
          </p>
          <div className="lb-hero-actions">
            <Link to="/dashboard" className="lb-btn lb-btn-primary">
              Open Dashboard
            </Link>
            <Link to="/login" className="lb-btn lb-btn-ghost">
              Login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
