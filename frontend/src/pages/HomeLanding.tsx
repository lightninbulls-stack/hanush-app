import React from "react";
import { Link } from "react-router-dom";
import "./MarketingHome.css";

const HomeLanding: React.FC = () => {
  return (
    <div className="lb-shell">
      <header className="lb-topbar">
        <div className="lb-container lb-topbar-inner">
          <Link to="/" className="lb-brand">
            <span className="lb-brand-mark">LB</span>
            <span className="lb-brand-text">Lightnin Bull</span>
          </Link>

          <nav className="lb-nav">
            <Link to="/auth" className="lb-link-muted">
              Login
            </Link>
            <Link to="/dashboard" className="lb-btn lb-btn-primary">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="lb-home-hero">
        <div className="lb-container">
          <div className="lb-home-hero-copy">
            <div className="lb-eyebrow">Quant Analytics Platform</div>
            <h1>Professional factor investing dashboards for Indian markets</h1>
            <p className="lb-home-subtitle">
              Track Momentum, Low Volatility, Value, Quality, and derivative-driven
              opportunity screens in one premium workflow.
            </p>

            <div className="lb-home-actions">
              <Link to="/dashboard" className="lb-btn lb-btn-primary">
                Open Dashboard
              </Link>
              <Link to="/auth" className="lb-btn lb-btn-secondary">
                Login
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomeLanding;
