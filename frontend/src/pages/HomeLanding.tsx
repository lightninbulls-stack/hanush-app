import React from "react";
import { Link } from "react-router-dom";
import "./HomeLanding.css";

const HomeLanding: React.FC = () => {
  return (
    <div className="lb-home-page">
      <header className="lb-home-header">
        <div className="lb-home-container lb-home-header-inner">
          <Link to="/" className="lb-home-brand">
            <img
              src="/lightninbull-bull.png"
              alt="Lightnin Bull"
              className="lb-home-logo"
            />
            <div className="lb-home-brand-copy">
              <span className="lb-home-brand-title">Lightnin Bull</span>
              <span className="lb-home-brand-subtitle">
                Quant Analytics Platform
              </span>
            </div>
          </Link>

          <nav className="lb-home-nav">
            <Link to="/auth" className="lb-home-nav-link">
              Login
            </Link>
            <Link to="/dashboard" className="lb-home-nav-btn">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="lb-home-hero">
        <div className="lb-home-container lb-home-hero-grid">
          <section className="lb-home-left">
            <p className="lb-home-kicker">INDIAN MARKETS • FACTORS • DERIVATIVES</p>

            <h1 className="lb-home-title">
              Start your
              <br />
              <span>factor research</span> here
            </h1>

            <p className="lb-home-subtitle">
              Track Momentum, Low Volatility, Value, Quality, and derivative-driven
              opportunity screens in one clean premium workflow.
            </p>

            <div className="lb-home-actions">
              <Link to="/dashboard" className="lb-home-primary-btn">
                Open Dashboard
              </Link>
              <Link to="/auth" className="lb-home-secondary-btn">
                Member Login
              </Link>
            </div>

            <div className="lb-home-features">
              <span>Momentum Rankings</span>
              <span>Low Volatility</span>
              <span>Derivatives View</span>
              <span>Premium Dashboard</span>
            </div>
          </section>

          <section className="lb-home-right">
            <div className="lb-home-preview-card">
              <div className="lb-home-preview-topbar">
                <span />
                <span />
                <span />
              </div>

              <div className="lb-home-preview-body">
                <div className="lb-home-preview-badge">LIVE PLATFORM PREVIEW</div>

                <div className="lb-home-preview-grid">
                  <div className="lb-home-mini-card">
                    <p>Momentum</p>
                    <h3>96</h3>
                    <small>Strong upside rank</small>
                  </div>

                  <div className="lb-home-mini-card">
                    <p>Quality</p>
                    <h3>91</h3>
                    <small>Fundamental strength</small>
                  </div>

                  <div className="lb-home-mini-card lb-home-mini-card-wide">
                    <p>Derivative Demand</p>
                    <div className="lb-home-bars">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default HomeLanding;
