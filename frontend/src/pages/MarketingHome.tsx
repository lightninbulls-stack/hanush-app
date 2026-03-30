import React from "react";
import { Link } from "react-router-dom";
import "./MarketingHome.css";

function LightninBullMark() {
  return (
    <svg
      className="lb-mark"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="62" height="62" rx="18" />
      <path d="M23 18V50H42" />
      <path d="M47 18L37 34H45L34 53" />
    </svg>
  );
}

export default function MarketingHome() {
  return (
    <div className="lb-page">
      <div className="lb-noise" />

      <header className="lb-nav">
        <div className="lb-brand">
          <LightninBullMark />
          <div className="lb-brand-copy">
            <span className="lb-brand-title">Lightnin Bull</span>
            <span className="lb-brand-subtitle">quant intelligence platform</span>
          </div>
        </div>

        <div className="lb-access">
          <Link to="/login" className="lb-login">
            Login
          </Link>

          <Link to="/dashboard" className="lb-dashboard">
            Open platform
            <span className="lb-dashboard-arrow">↗</span>
          </Link>
        </div>
      </header>

      <main className="lb-hero">
        <p className="lb-kicker">INDIAN EQUITIES • DERIVATIVES • FACTOR RESEARCH</p>

        <h1 className="lb-headline">
          built for the <span>signal-driven</span>
        </h1>

        <p className="lb-subtitle">
          Lightnin Bull brings together factor dashboards, ranked opportunity screens,
          and cleaner decision workflows for serious market participants in India.
        </p>

        <div className="lb-hero-actions">
          <Link to="/dashboard" className="lb-primary-cta">
            Enter dashboard
          </Link>

          <Link to="/login" className="lb-secondary-cta">
            Member login
          </Link>
        </div>

        <section className="lb-stage">
          <div className="lb-stage-ribs lb-stage-ribs-left" />
          <div className="lb-stage-ribs lb-stage-ribs-right" />

          <div className="lb-stage-center">
            <div className="lb-preview">
              <div className="lb-preview-top">
                <span />
                <span />
                <span />
              </div>

              <div className="lb-preview-body">
                <div className="lb-preview-badge">LIVE FACTOR PREVIEW</div>

                <div className="lb-preview-grid">
                  <div className="lb-preview-card">
                    <p>Momentum</p>
                    <h3>96</h3>
                    <small>Strong upside leadership</small>
                  </div>

                  <div className="lb-preview-card">
                    <p>Quality</p>
                    <h3>91</h3>
                    <small>Balance-sheet strength</small>
                  </div>

                  <div className="lb-preview-card lb-preview-card-wide">
                    <p>Derivative demand</p>
                    <div className="lb-preview-bars">
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
          </div>

          <div className="lb-corner-card">
            <span className="lb-corner-label">ACCESS</span>
            <strong>Login</strong>
            <strong>Dashboard</strong>
          </div>
        </section>
      </main>
    </div>
  );
}
