import React, { useMemo, useRef, useState } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";

type AuthMode = "login" | "signup";

type FeatureInfo = {
  name: string;
  icon: string;
  tag: string;
  what: string;
  why: string;
  example: string;
};

const initialSignUpState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const features: FeatureInfo[] = [
  {
    name: "Watchlist",
    icon: "◈",
    tag: "TRACK",
    what: "Track selected stocks, signals, model outputs, and high-conviction ideas in one clean dashboard.",
    why: "It helps you avoid jumping between multiple tools and keeps your important opportunities in one focused view.",
    example: "Add Regime Upside stocks, intraday signals, and portfolio candidates into one watchlist before execution.",
  },
  {
    name: "Portfolio Backtest",
    icon: "◉",
    tag: "TEST",
    what: "Test portfolio performance historically using equal weight, MVO allocation, drawdown metrics, returns, Sharpe, and yearly performance.",
    why: "It helps you understand whether a strategy survives different market conditions before deploying capital.",
    example: "Backtest a 20-stock momentum portfolio with monthly rebalancing and compare it against Nifty 50.",
  },
  {
    name: "Consistent Trending",
    icon: "◆",
    tag: "MOMENTUM",
    what: "Finds stocks that show stable and repeated trending behaviour instead of one-day random spikes.",
    why: "It helps identify smoother momentum names with stronger continuation probability and fewer false breakouts.",
    example: "Use this bucket to find stocks that have been steadily gaining strength across multiple periods.",
  },
  {
    name: "Slow Movement",
    icon: "◇",
    tag: "STABILITY",
    what: "Identifies stocks that move gradually with lower volatility and controlled trend behaviour.",
    why: "Useful for investors who prefer stable price movement instead of aggressive high-volatility momentum.",
    example: "Pick slow-moving stocks for lower-risk portfolio allocation or defensive trend-following baskets.",
  },
  {
    name: "Cheap Value",
    icon: "◐",
    tag: "VALUE",
    what: "Ranks stocks that appear undervalued using value-style factors, price behaviour, and relative opportunity.",
    why: "It helps surface potential long-term value opportunities before broad market recognition.",
    example: "Use this model to identify stocks that look cheap but are beginning to show early strength.",
  },
  {
    name: "Best Quality",
    icon: "◑",
    tag: "QUALITY",
    what: "Filters companies with stronger quality characteristics such as consistency, stability, cleaner trends, and better behaviour.",
    why: "It helps avoid weak businesses or noisy stocks that may look attractive only for a short period.",
    example: "Use Best Quality as a safer universe before running momentum or portfolio allocation models.",
  },
  {
    name: "Regime Upside",
    icon: "▲",
    tag: "RISK-ON",
    what: "Identifies stocks that perform better when the market regime is bullish or risk-on.",
    why: "It helps you align long trades with market strength instead of fighting the broader trend.",
    example: "When Nifty is strong, use Regime Upside to find stocks with higher upside participation.",
  },
  {
    name: "Regime Downside",
    icon: "▼",
    tag: "RISK-OFF",
    what: "Identifies stocks that are weak or vulnerable when the market regime turns bearish or risk-off.",
    why: "It helps you manage downside risk and prepare bearish or defensive setups.",
    example: "When market breadth weakens, use Regime Downside to identify stocks likely to underperform.",
  },
  {
    name: "Range Bound Upside",
    icon: "◭",
    tag: "RANGE",
    what: "Finds stocks trading in a range but showing upside pressure near support or breakout zones.",
    why: "It helps catch early accumulation before the stock breaks out of consolidation.",
    example: "Use this when a stock is not trending yet but buyers are repeatedly defending support.",
  },
  {
    name: "Range Bound Downside",
    icon: "◮",
    tag: "RANGE",
    what: "Finds stocks trading in a range but showing downside pressure near resistance or breakdown zones.",
    why: "It helps detect distribution or weakness before a clean breakdown happens.",
    example: "Use this to prepare bearish trades when a stock repeatedly fails near resistance.",
  },
  {
    name: "Aggressive Call Option Stocks",
    icon: "⬡",
    tag: "OPTIONS",
    what: "Finds stocks suitable for bullish option opportunities based on momentum, volatility, and breakout behaviour.",
    why: "It helps shortlist stronger names for call option strategies instead of randomly selecting stocks.",
    example: "Use this bucket to identify stocks where bullish option trades may have better directional support.",
  },
  {
    name: "Aggressive Put Option Stocks",
    icon: "⬢",
    tag: "OPTIONS",
    what: "Finds stocks suitable for bearish option opportunities based on weakness, volatility, and breakdown behaviour.",
    why: "It helps shortlist weaker names for put option opportunities during risk-off conditions.",
    example: "Use this bucket when the market is weak and you want bearish option candidates.",
  },
  {
    name: "Intraday Bull Call Spreads",
    icon: "◈",
    tag: "INTRADAY",
    what: "Shows intraday defined-risk bullish option spread opportunities.",
    why: "It helps trade upside moves with controlled risk instead of taking naked directional exposure.",
    example: "Use this when the index confirms upside momentum and the system identifies a clean bull call setup.",
  },
  {
    name: "Intraday Bear Put Spreads",
    icon: "◇",
    tag: "INTRADAY",
    what: "Shows intraday defined-risk bearish option spread opportunities.",
    why: "It helps trade downside moves with limited risk and structured payoff.",
    example: "Use this when index trend turns bearish and a defined-risk bear put spread is triggered.",
  },
  {
    name: "Upside Trend Stocks",
    icon: "◆",
    tag: "LIVE",
    what: "Shows live intraday stocks where upside momentum is active.",
    why: "It helps you track active upside trend signals in real time.",
    example: "Use this panel during market hours to monitor stocks already showing upside continuation.",
  },
  {
    name: "Downside Trend Stocks",
    icon: "◉",
    tag: "LIVE",
    what: "Shows live intraday stocks where downside momentum is active.",
    why: "It helps you track active downside trend signals and weak stocks in real time.",
    example: "Use this panel during market hours to monitor stocks breaking down or losing strength.",
  },
];

const socialLinks = ["LinkedIn", "Instagram", "Facebook", "Pinterest", "Twitter"];

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState(initialSignUpState);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo>(features[2]);

  const authCardRef = useRef<HTMLDivElement | null>(null);
  const intelligenceRef = useRef<HTMLElement | null>(null);
  const aboutRef = useRef<HTMLElement | null>(null);
  const contactRef = useRef<HTMLElement | null>(null);

  const heading = useMemo(
    () =>
      mode === "login"
        ? "access your trading dashboard"
        : "create your lightninbull account",
    [mode]
  );

  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const scrollToElement = (element: HTMLElement | null) => {
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openSignUp = () => {
    setMode("signup");
    resetMessages();
    setTimeout(() => {
      authCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const result = await loginUser(phone, password);
      saveAuthToken(result.access_token);
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setErrorMessage(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpChange =
    (field: keyof typeof initialSignUpState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setSignUpForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await registerUser({
        name: signUpForm.name,
        email: signUpForm.email,
        phone: signUpForm.phone,
        password: signUpForm.password,
      });

      const loginResult = await loginUser(signUpForm.phone, signUpForm.password);
      saveAuthToken(loginResult.access_token);

      setSuccessMessage("Account created successfully. Redirecting...");
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setErrorMessage(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* ===== HERO / LOGIN SECTION ===== */}
      <section className="hero-section">
        <video autoPlay muted loop playsInline className="bg-video">
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>

        <div className="video-overlay" />
        <div className="noise-overlay" />

        <nav className="top-nav">
          <button
            type="button"
            className="nav-logo"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <span className="logo-bolt">⚡</span> LIGHTNINBULL
          </button>

          <div className="nav-links">
            <button type="button" onClick={() => scrollToElement(intelligenceRef.current)}>
              markets
            </button>
            <button type="button" onClick={() => scrollToElement(intelligenceRef.current)}>
              intelligence
            </button>
            <button type="button" onClick={() => scrollToElement(intelligenceRef.current)}>
              research
            </button>
            <button type="button" onClick={() => scrollToElement(aboutRef.current)}>
              about us
            </button>
            <button type="button" onClick={() => scrollToElement(contactRef.current)}>
              contact
            </button>
            <button type="button" className="nav-signup" onClick={openSignUp}>
              sign up
            </button>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-left">
            <p className="eyebrow-label">INSTITUTIONAL QUANT INTELLIGENCE</p>

            <h1 className="hero-headline">
              Invest and trade<br />
              with the <span className="headline-gold">precision</span><br />
              of algorithms.
            </h1>

            <p className="hero-subtext">
              Real-time signals. Deep factor analytics.
              <br />
              Built for traders who demand discipline, data, and edge.
            </p>

            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">10K+</span>
                <span className="stat-label">active users</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">16+</span>
                <span className="stat-label">AI modules</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">live</span>
                <span className="stat-label">signal engine</span>
              </div>
            </div>
          </div>

          <div ref={authCardRef} className="login-card">
            <div className="card-header">
              <span className="card-logo">⚡ LIGHTNINBULL</span>
              <p className="card-sub">{heading}</p>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${mode === "login" ? "active" : ""}`}
                onClick={() => {
                  setMode("login");
                  resetMessages();
                }}
              >
                Login
              </button>

              <button
                type="button"
                className={`auth-tab ${mode === "signup" ? "active" : ""}`}
                onClick={() => {
                  setMode("signup");
                  resetMessages();
                }}
              >
                Sign Up
              </button>
            </div>

            <div className="card-divider" />

            {errorMessage ? <div className="auth-alert error">{errorMessage}</div> : null}
            {successMessage ? <div className="auth-alert success">{successMessage}</div> : null}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="login-form">
                <div className="input-group">
                  <label className="input-label">PHONE NUMBER</label>
                  <input
                    placeholder="+91 00000 00000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    required
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
                    required
                  />
                </div>

                <button className="btn" disabled={loading} type="submit">
                  {loading ? (
                    <span className="btn-loading">
                      <span className="spinner" /> Authenticating...
                    </span>
                  ) : (
                    <span>Access Dashboard →</span>
                  )}
                </button>

                <button type="button" className="signup-ghost-btn" onClick={openSignUp}>
                  New to LightninBull? Create Account →
                </button>

                <p className="forgot-link">
                  Forgot credentials? <a href="#support">Contact support</a>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="login-form">
                <div className="input-group">
                  <label className="input-label">FULL NAME</label>
                  <input
                    placeholder="Your name"
                    value={signUpForm.name}
                    onChange={handleSignUpChange("name")}
                    className="input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">EMAIL</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={signUpForm.email}
                    onChange={handleSignUpChange("email")}
                    className="input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">PHONE NUMBER</label>
                  <input
                    placeholder="+91 00000 00000"
                    value={signUpForm.phone}
                    onChange={handleSignUpChange("phone")}
                    className="input"
                    required
                  />
                </div>

                <div className="signup-grid">
                  <div className="input-group">
                    <label className="input-label">PASSWORD</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={signUpForm.password}
                      onChange={handleSignUpChange("password")}
                      className="input"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">CONFIRM</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={signUpForm.confirmPassword}
                      onChange={handleSignUpChange("confirmPassword")}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <button className="btn" disabled={loading} type="submit">
                  {loading ? (
                    <span className="btn-loading">
                      <span className="spinner" /> Creating account...
                    </span>
                  ) : (
                    <span>Create Account →</span>
                  )}
                </button>

                <button
                  type="button"
                  className="signup-ghost-btn"
                  onClick={() => {
                    setMode("login");
                    resetMessages();
                  }}
                >
                  Already have an account? Login →
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="scroll-indicator">
          <span>SCROLL TO EXPLORE</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* ===== INTELLIGENCE SECTION ===== */}
      <section ref={intelligenceRef} className="intelligence-section">
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
          regime intelligence, derivatives insights, and real-time trading signals — all inside one
          unified intelligence layer.
        </p>

        <div className="feature-grid">
          {features.map((feature, index) => (
            <button
              type="button"
              key={feature.name}
              className={`feature-card ${
                selectedFeature.name === feature.name ? "selected" : ""
              }`}
              style={{ animationDelay: `${index * 0.035}s` }}
              onClick={() => setSelectedFeature(feature)}
            >
              <div className="feature-topline">
                <span className="card-icon">{feature.icon}</span>
                <span className="feature-tag">{feature.tag}</span>
              </div>
              <h3 className="card-title">{feature.name}</h3>
              <p className="card-desc">{feature.what}</p>
              <span className="feature-action">View details →</span>
              <div className="card-corner" />
            </button>
          ))}
        </div>

        <div className="feature-detail-panel">
          <div className="detail-left">
            <p className="detail-kicker">{selectedFeature.tag}</p>
            <h3>{selectedFeature.name}</h3>
            <p>{selectedFeature.what}</p>
          </div>

          <div className="detail-right">
            <div className="detail-box">
              <span>WHY IT HELPS</span>
              <p>{selectedFeature.why}</p>
            </div>
            <div className="detail-box">
              <span>EXAMPLE USE CASE</span>
              <p>{selectedFeature.example}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ABOUT SECTION ===== */}
      <section ref={aboutRef} className="about-section">
        <div className="about-inner">
          <p className="section-label about-label">ABOUT LIGHTNINBULL</p>

          <h2 className="about-title">
            Built for traders who want structure,
            <br />
            not noise.
          </h2>

          <p className="about-text">
            LightninBull is an AI-driven Quant Fund Manager platform built to bring
            institutional-style market intelligence to traders and investors. The platform
            combines factor models, regime detection, intraday signals, derivatives analytics,
            portfolio backtesting, and risk management into one unified dashboard.
          </p>

          <p className="growth-line">10K+ active users and rising.</p>

          <div className="about-stats">
            <div>
              <span>10K+</span>
              <p>Active Users</p>
            </div>
            <div>
              <span>16+</span>
              <p>AI Modules</p>
            </div>
            <div>
              <span>Real-Time</span>
              <p>Signal Engine</p>
            </div>
            <div>
              <span>Risk</span>
              <p>Portfolio Analytics</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER / CONTACT ===== */}
      <footer ref={contactRef} className="footer-strip" id="support">
        <div className="footer-top">
          <div>
            <span className="footer-logo">⚡ LIGHTNINBULL</span>
            <p className="footer-desc">
              Institutional Quant Intelligence for systematic trading, portfolio construction,
              and disciplined risk management.
            </p>
          </div>

          <div className="footer-links-wrap">
            <div className="footer-col">
              <h4>Social Links</h4>
              {socialLinks.map((link) => (
                <a key={link} href="#">
                  {link}
                </a>
              ))}
            </div>

            <div className="footer-col">
              <h4>Contact Us</h4>
              <a href="#">Contact us</a>
              <a href="#">Help & Support</a>
              <a href="#">Partner with us</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} LightninBull. Institutional Quant Intelligence. All
            rights reserved.
          </span>
          <button type="button" onClick={openSignUp}>
            Join LightninBull →
          </button>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');

        .auth-page,
        .auth-page * {
          box-sizing: border-box;
        }

        .auth-page {
          background: #050608;
          color: #fff;
          min-height: 100vh;
          overflow-x: hidden;
        }

        button {
          font: inherit;
        }

        .hero-section {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Syne', sans-serif;
          background: #050608;
        }

        .bg-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.36;
        }

        .video-overlay {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 45%, rgba(250,204,21,0.07), transparent 42%),
            linear-gradient(135deg, rgba(5, 6, 8, 0.96) 0%, rgba(5, 6, 8, 0.68) 48%, rgba(5, 6, 8, 0.94) 100%);
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

        .top-nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 30px 60px;
          border-bottom: 1px solid rgba(250, 204, 21, 0.08);
        }

        .nav-logo {
          border: none;
          background: transparent;
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 4px;
          color: #fff;
          cursor: pointer;
        }

        .logo-bolt {
          color: #facc15;
          margin-right: 6px;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 34px;
        }

        .nav-links button {
          border: none;
          background: transparent;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 1.6px;
          color: rgba(255,255,255,0.42);
          cursor: pointer;
          text-transform: lowercase;
          transition: color 0.2s ease;
        }

        .nav-links button:hover {
          color: #facc15;
        }

        .nav-signup {
          padding: 8px 16px !important;
          border: 1px solid rgba(250,204,21,0.26) !important;
          border-radius: 999px;
          color: #facc15 !important;
          background: rgba(250,204,21,0.045) !important;
          text-transform: uppercase !important;
          font-size: 9px !important;
        }

        .nav-signup:hover {
          background: rgba(250,204,21,0.1) !important;
          border-color: rgba(250,204,21,0.55) !important;
        }

        .hero-content {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 70px 60px 40px;
          gap: 70px;
        }

        .hero-left {
          max-width: 720px;
        }

        .eyebrow-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 5px;
          color: #facc15;
          margin-bottom: 34px;
          opacity: 0.9;
        }

        .hero-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(72px, 7.4vw, 112px);
          font-weight: 300;
          line-height: 0.93;
          color: #f7f0df;
          letter-spacing: -2.8px;
          margin: 0;
        }

        .headline-gold {
          color: #d6b849;
          font-style: italic;
          font-weight: 300;
          text-shadow:
            0 0 32px rgba(250,204,21,0.18),
            0 0 90px rgba(250,204,21,0.08);
        }

        .hero-subtext {
          margin-top: 34px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          line-height: 1.9;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.45px;
        }

        .hero-stats {
          display: flex;
          align-items: stretch;
          margin-top: 54px;
          border: 1px solid rgba(255,255,255,0.1);
          max-width: 610px;
          background: rgba(5,6,8,0.34);
          backdrop-filter: blur(10px);
        }

        .stat {
          min-width: 160px;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 30px;
          font-weight: 400;
          color: #f7f0df;
          letter-spacing: -0.6px;
          line-height: 1;
          text-transform: lowercase;
        }

        .stat-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.33);
          text-transform: uppercase;
        }

        .stat-divider {
          width: 1px;
          background: rgba(255,255,255,0.08);
        }

        .login-card {
          position: relative;
          z-index: 10;
          flex-shrink: 0;
          width: 430px;
          padding: 36px;
          border-radius: 4px;
          background: rgba(8, 9, 12, 0.92);
          border: 1px solid rgba(250, 204, 21, 0.18);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 40px 80px rgba(0,0,0,0.62),
            0 0 70px rgba(250,204,21,0.05);
          backdrop-filter: blur(24px);
        }

        .login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #facc15, transparent);
          border-radius: 4px 4px 0 0;
        }

        .card-header {
          margin-bottom: 22px;
        }

        .card-logo {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 4px;
          color: #facc15;
        }

        .card-sub {
          margin-top: 9px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.36);
          text-transform: lowercase;
        }

        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 24px;
        }

        .auth-tab {
          padding: 10px 12px;
          border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          text-transform: uppercase;
          transition: all 0.2s ease;
        }

        .auth-tab.active {
          background: linear-gradient(90deg, #facc15 0%, #d6a21f 100%);
          border-color: rgba(250,204,21,0.7);
          color: #050608;
        }

        .card-divider {
          height: 1px;
          background: rgba(255,255,255,0.07);
          margin-bottom: 26px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .signup-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-label {
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.3);
        }

        .input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.045);
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          letter-spacing: 0.4px;
        }

        .input:focus {
          border-color: rgba(250,204,21,0.42);
          background: rgba(250,204,21,0.035);
        }

        .input::placeholder {
          color: rgba(255,255,255,0.18);
        }

        .btn {
          width: 100%;
          padding: 15px;
          border-radius: 3px;
          background: linear-gradient(90deg, #facc15 0%, #d6a21f 100%);
          border: none;
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 3px;
          color: #050608;
          cursor: pointer;
          margin-top: 4px;
          transition: opacity 0.2s, transform 0.15s;
          position: relative;
          overflow: hidden;
          text-transform: uppercase;
        }

        .btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        }

        .btn:hover::after {
          transform: translateX(100%);
        }

        .btn:hover {
          opacity: 0.94;
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

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .signup-ghost-btn {
          width: 100%;
          padding: 13px;
          border-radius: 3px;
          background: transparent;
          border: 1px solid rgba(250,204,21,0.22);
          color: #facc15;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .signup-ghost-btn:hover {
          background: rgba(250,204,21,0.06);
          border-color: rgba(250,204,21,0.48);
          transform: translateY(-1px);
        }

        .forgot-link {
          text-align: center;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          letter-spacing: 0.5px;
          margin: 0;
        }

        .forgot-link a {
          color: rgba(250,204,21,0.62);
          text-decoration: none;
        }

        .forgot-link a:hover {
          color: #facc15;
        }

        .auth-alert {
          margin-bottom: 16px;
          padding: 11px 13px;
          border-radius: 3px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          line-height: 1.6;
          letter-spacing: 0.4px;
        }

        .auth-alert.error {
          background: rgba(220,38,38,0.15);
          border: 1px solid rgba(248,113,113,0.38);
          color: #fecaca;
        }

        .auth-alert.success {
          background: rgba(22,163,74,0.15);
          border: 1px solid rgba(74,222,128,0.38);
          color: #bbf7d0;
        }

        .scroll-indicator {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px 60px 34px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 5px;
          color: rgba(255,255,255,0.2);
        }

        .scroll-line {
          flex: 1;
          max-width: 80px;
          height: 1px;
          background: linear-gradient(90deg, rgba(250,204,21,0.45), transparent);
          animation: scrollPulse 2s ease-in-out infinite;
        }

        @keyframes scrollPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .intelligence-section {
          padding: 130px 60px 150px;
          font-family: 'Syne', sans-serif;
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(250,204,21,0.045) 0%, transparent 70%),
            #050608;
        }

        .section-label-row {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 50px;
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
          color: rgba(250,204,21,0.74);
          white-space: nowrap;
          text-transform: uppercase;
        }

        .section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(56px, 6vw, 84px);
          font-weight: 300;
          text-align: center;
          color: #f7f0df;
          letter-spacing: -1.6px;
          line-height: 0.95;
          margin: 0;
        }

        .ai-word {
          font-style: italic;
          color: #facc15;
          font-weight: 300;
          text-shadow:
            0 0 40px rgba(250,204,21,0.45),
            0 0 90px rgba(250,204,21,0.18);
          animation: subtleGlow 2.5s ease-in-out infinite alternate;
        }

        @keyframes subtleGlow {
          from {
            text-shadow: 0 0 20px rgba(250,204,21,0.3), 0 0 60px rgba(250,204,21,0.1);
          }
          to {
            text-shadow: 0 0 48px rgba(250,204,21,0.6), 0 0 110px rgba(250,204,21,0.25);
          }
        }

        .section-desc {
          max-width: 760px;
          margin: 34px auto 84px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          line-height: 2;
          color: rgba(255,255,255,0.38);
          text-align: center;
          letter-spacing: 0.3px;
        }

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
          text-align: left;
          padding: 31px 27px;
          background: rgba(8, 9, 12, 0.95);
          transition: background 0.3s ease, transform 0.22s ease;
          overflow: hidden;
          border: none;
          cursor: pointer;
          color: inherit;
          animation: fadeUp 0.5s ease both;
          min-height: 238px;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .feature-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.08), transparent 62%);
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .feature-card:hover,
        .feature-card.selected {
          background: rgba(14, 15, 18, 1);
          transform: translateY(-2px);
        }

        .feature-card:hover::after,
        .feature-card.selected::after {
          opacity: 1;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #facc15, transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .feature-card:hover::before,
        .feature-card.selected::before {
          opacity: 0.7;
        }

        .feature-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          position: relative;
          z-index: 2;
        }

        .card-icon {
          font-size: 18px;
          color: rgba(250,204,21,0.58);
          transition: color 0.3s;
        }

        .feature-tag {
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          letter-spacing: 2.5px;
          color: rgba(255,255,255,0.25);
        }

        .feature-card:hover .card-icon,
        .feature-card.selected .card-icon {
          color: #facc15;
        }

        .card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 400;
          color: #f7f0df;
          margin: 0 0 13px;
          line-height: 1.05;
          letter-spacing: -0.4px;
          position: relative;
          z-index: 2;
        }

        .card-desc {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          line-height: 1.75;
          color: rgba(255,255,255,0.38);
          margin: 0;
          position: relative;
          z-index: 2;
        }

        .feature-action {
          display: inline-block;
          margin-top: 18px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          color: rgba(250,204,21,0.68);
          position: relative;
          z-index: 2;
        }

        .card-corner {
          position: absolute;
          bottom: 18px;
          right: 18px;
          width: 18px;
          height: 18px;
          border-right: 1px solid rgba(250,204,21,0.25);
          border-bottom: 1px solid rgba(250,204,21,0.25);
          z-index: 2;
        }

        .feature-detail-panel {
          margin-top: 42px;
          border: 1px solid rgba(250,204,21,0.16);
          background:
            radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.07), transparent 60%),
            rgba(8,9,12,0.92);
          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: 40px;
          padding: 38px;
          animation: fadeUp 0.36s ease both;
        }

        .detail-kicker {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 4px;
          color: #facc15;
          margin: 0 0 18px;
        }

        .detail-left h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(40px, 4vw, 62px);
          font-weight: 300;
          color: #f7f0df;
          line-height: 0.95;
          margin: 0 0 24px;
          letter-spacing: -1px;
        }

        .detail-left p {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          line-height: 1.9;
          color: rgba(255,255,255,0.43);
          margin: 0;
        }

        .detail-right {
          display: grid;
          gap: 16px;
        }

        .detail-box {
          border-left: 1px solid rgba(250,204,21,0.28);
          padding: 18px 0 18px 22px;
        }

        .detail-box span {
          display: block;
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          letter-spacing: 3px;
          color: rgba(250,204,21,0.8);
          margin-bottom: 10px;
        }

        .detail-box p {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          line-height: 1.85;
          color: rgba(255,255,255,0.42);
          margin: 0;
        }

        .about-section {
          padding: 130px 60px;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.05), transparent 70%),
            #09090b;
          font-family: 'Syne', sans-serif;
        }

        .about-inner {
          max-width: 1180px;
          margin: 0 auto;
        }

        .about-label {
          text-align: center;
          display: block;
          margin-bottom: 34px;
        }

        .about-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(48px, 5.5vw, 82px);
          font-weight: 300;
          line-height: 0.98;
          letter-spacing: -1.8px;
          color: #f7f0df;
          text-align: center;
          margin: 0;
        }

        .about-text {
          max-width: 820px;
          margin: 36px auto 0;
          text-align: center;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          line-height: 2;
          color: rgba(255,255,255,0.42);
        }

        .growth-line {
          margin: 38px 0 50px;
          text-align: center;
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(34px, 4vw, 56px);
          font-style: italic;
          color: #facc15;
          text-shadow: 0 0 60px rgba(250,204,21,0.14);
        }

        .about-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
        }

        .about-stats div {
          padding: 30px 24px;
          border-right: 1px solid rgba(255,255,255,0.08);
        }

        .about-stats div:last-child {
          border-right: none;
        }

        .about-stats span {
          display: block;
          font-family: 'Cormorant Garamond', serif;
          font-size: 34px;
          color: #f7f0df;
          margin-bottom: 8px;
        }

        .about-stats p {
          margin: 0;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 2.4px;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
        }

        .footer-strip {
          padding: 70px 60px 34px;
          background: #050608;
          border-top: 1px solid rgba(255,255,255,0.08);
          font-family: 'Syne', sans-serif;
        }

        .footer-top {
          display: flex;
          justify-content: space-between;
          gap: 60px;
          max-width: 1180px;
          margin: 0 auto 54px;
        }

        .footer-logo {
          display: block;
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 4px;
          color: #f7f0df;
          margin-bottom: 20px;
        }

        .footer-desc {
          max-width: 480px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          line-height: 1.9;
          color: rgba(255,255,255,0.36);
          margin: 0;
        }

        .footer-links-wrap {
          display: flex;
          gap: 72px;
        }

        .footer-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 150px;
        }

        .footer-col h4 {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          color: #facc15;
          text-transform: uppercase;
          margin: 0 0 8px;
        }

        .footer-col a {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.38);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .footer-col a:hover {
          color: #facc15;
        }

        .footer-bottom {
          max-width: 1180px;
          margin: 0 auto;
          padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .footer-bottom span {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.28);
          letter-spacing: 1px;
        }

        .footer-bottom button {
          border: 1px solid rgba(250,204,21,0.28);
          background: rgba(250,204,21,0.05);
          color: #facc15;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          padding: 12px 18px;
          border-radius: 3px;
          cursor: pointer;
        }

        .footer-bottom button:hover {
          background: rgba(250,204,21,0.1);
        }

        @media (max-width: 1200px) {
          .hero-content {
            gap: 46px;
          }

          .hero-headline {
            font-size: clamp(62px, 7vw, 92px);
          }

          .feature-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 980px) {
          .top-nav {
            padding: 24px 28px;
            align-items: flex-start;
            gap: 20px;
          }

          .nav-links {
            gap: 16px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .hero-content {
            flex-direction: column;
            align-items: flex-start;
            padding: 54px 28px 40px;
          }

          .login-card {
            width: 100%;
            max-width: 520px;
          }

          .hero-stats {
            max-width: 100%;
          }

          .feature-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .feature-detail-panel {
            grid-template-columns: 1fr;
          }

          .about-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .about-stats div:nth-child(2) {
            border-right: none;
          }

          .about-stats div:nth-child(1),
          .about-stats div:nth-child(2) {
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }

          .footer-top {
            flex-direction: column;
          }
        }

        @media (max-width: 640px) {
          .top-nav {
            flex-direction: column;
          }

          .nav-links {
            justify-content: flex-start;
          }

          .nav-links button:not(.nav-signup) {
            display: none;
          }

          .hero-content {
            padding: 46px 20px 30px;
          }

          .hero-headline {
            font-size: clamp(48px, 14vw, 62px);
            letter-spacing: -1.5px;
          }

          .hero-subtext {
            font-size: 11px;
          }

          .hero-stats {
            flex-direction: column;
          }

          .stat-divider {
            width: 100%;
            height: 1px;
          }

          .stat {
            min-width: auto;
          }

          .login-card {
            padding: 26px;
          }

          .signup-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }

          .scroll-indicator {
            padding: 20px;
          }

          .intelligence-section,
          .about-section,
          .footer-strip {
            padding-left: 20px;
            padding-right: 20px;
          }

          .section-label-row {
            gap: 12px;
          }

          .section-label {
            white-space: normal;
            text-align: center;
            line-height: 1.6;
          }

          .feature-grid {
            grid-template-columns: 1fr;
          }

          .feature-detail-panel {
            padding: 26px;
          }

          .about-stats {
            grid-template-columns: 1fr;
          }

          .about-stats div {
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }

          .about-stats div:last-child {
            border-bottom: none;
          }

          .footer-links-wrap {
            flex-direction: column;
            gap: 34px;
          }

          .footer-bottom {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Auth;
