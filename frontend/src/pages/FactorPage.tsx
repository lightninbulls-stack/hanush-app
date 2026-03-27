import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { factors } from "./marketingContent";
import "./MarketingHome.css";

const FactorPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const factor = factors.find((item) => item.slug === slug);

  if (!factor) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="lb-shell">
      <header className="lb-topbar">
        <div className="lb-container lb-topbar-inner">
          <Link to="/" className="lb-brand">
            <span className="lb-brand-mark">LB</span>
            <span className="lb-brand-text">Lightnin Bull</span>
          </Link>

          <nav className="lb-nav">
            <Link to="/">Home</Link>
            <Link to="/auth" className="lb-link-muted">
              Login
            </Link>
            <Link to="/dashboard" className="lb-btn lb-btn-primary">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="lb-factor-page">
        <div className="lb-container">
          <section className="lb-factor-hero">
            <div className="lb-eyebrow">Factor Framework</div>
            <h1>{factor.name}</h1>
            <p className="lb-factor-subtitle">{factor.heroSubtitle}</p>
          </section>

          <section className="lb-factor-body-wrap">
            <div className="lb-factor-main">
              {factor.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <aside className="lb-factor-side">
              <div className="lb-factor-side-card">
                <h3>How to use this factor</h3>
                <p>
                  Use {factor.name} to narrow the market into cleaner, more
                  explainable opportunities instead of relying on broad,
                  unstructured stock lists.
                </p>
                <Link to="/auth" className="lb-btn lb-btn-primary lb-side-btn">
                  Explore the Platform
                </Link>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
};

export default FactorPage;
