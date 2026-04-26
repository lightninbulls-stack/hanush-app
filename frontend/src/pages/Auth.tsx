import React, { useMemo, useRef, useState, useEffect } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";

type AuthMode = "login" | "signup";

type FeatureInfo = {
  name: string;
  icon: string;
  tag: string;
  what: string;
  model: string;
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

const complianceDisclaimer =
  "LightninBull is an educational historical backtesting and market analytics platform. It helps users study past market data, portfolio behaviour, risk metrics, and model performance. It does not provide investment advice, personalized recommendations, guaranteed returns, or portfolio management services. Users should do their own research before making any financial decision.";

const features: FeatureInfo[] = [
  {
    name: "Historical Backtesting",
    icon: "◉",
    tag: "BACKTEST",
    what:
      "Study how a selected stock basket or rule-based portfolio would have behaved historically using past market data.",
    model:
      "The backtesting engine evaluates historical returns, volatility, drawdowns, portfolio turnover, and calendar-year behaviour. It is designed for studying past performance only.",
    why:
      "Backtesting helps users understand how a rule or portfolio behaved in the past before using it for further independent research.",
    example:
      "A user can create a basket of stocks and study how it performed over previous years with monthly or quarterly rebalancing.",
  },
  {
    name: "Portfolio Analytics",
    icon: "◈",
    tag: "PORTFOLIO",
    what:
      "Analyse portfolio-level behaviour using historical data, allocation weights, returns, and risk metrics.",
    model:
      "The module calculates portfolio returns, drawdowns, volatility, Sharpe ratio, Sortino ratio, and historical allocation behaviour.",
    why:
      "It helps users understand the risk and return characteristics of a portfolio from a historical point of view.",
    example:
      "A user can compare an equal-weight portfolio with an optimized allocation and review the historical performance difference.",
  },
  {
    name: "Calendar-Year Returns",
    icon: "◆",
    tag: "RETURNS",
    what:
      "Break down historical portfolio performance year by year for cleaner analysis.",
    model:
      "The module groups daily or monthly portfolio returns into calendar-year summaries and shows how the portfolio performed across different years.",
    why:
      "Annual breakdowns make it easier to see whether historical performance was stable or concentrated in only a few years.",
    example:
      "A user can review returns from 2018, 2019, 2020, and later years separately instead of only seeing total return.",
  },
  {
    name: "Drawdown Study",
    icon: "▼",
    tag: "RISK",
    what:
      "Study historical portfolio declines, recovery periods, and worst-case drawdown phases.",
    model:
      "The module calculates peak-to-trough declines, maximum drawdown, recovery time, and longest drawdown duration using historical NAV data.",
    why:
      "Return alone is not enough. Drawdown analysis helps users understand the historical downside behaviour of a portfolio.",
    example:
      "A portfolio may show good returns, but this module helps identify whether it also had deep or long drawdown periods.",
  },
  {
    name: "Risk Metrics",
    icon: "◇",
    tag: "RISK",
    what:
      "Review common historical risk metrics used in portfolio analysis.",
    model:
      "The module calculates volatility, downside volatility, Sharpe ratio, Sortino ratio, drawdown, return distribution, and risk-adjusted performance.",
    why:
      "Risk metrics help users compare portfolios more clearly instead of only looking at raw return numbers.",
    example:
      "Two portfolios may have similar returns, but the one with lower volatility and lower drawdown may have smoother historical behaviour.",
  },
  {
    name: "Rebalancing Study",
    icon: "◐",
    tag: "REBALANCE",
    what:
      "Study how different rebalancing frequencies affected historical portfolio performance.",
    model:
      "The module compares portfolio behaviour under monthly, quarterly, half-yearly, or custom rebalancing schedules.",
    why:
      "Rebalancing can change returns, risk, turnover, and drawdown. Studying this historically helps users understand the impact of different rules.",
    example:
      "A user can compare monthly rebalancing versus quarterly rebalancing and review which was smoother historically.",
  },
  {
    name: "Factor Comparison",
    icon: "◑",
    tag: "FACTORS",
    what:
      "Compare different historical factor-style portfolios such as momentum, quality, value, and low-volatility baskets.",
    model:
      "The module studies factor-based baskets using historical ranking rules and compares their past performance characteristics.",
    why:
      "Different factor styles behave differently in different market environments. Historical comparison helps users understand those differences.",
    example:
      "A user can compare a historical momentum basket with a quality basket and review return, volatility, and drawdown differences.",
  },
  {
    name: "Benchmark Comparison",
    icon: "▲",
    tag: "BENCHMARK",
    what:
      "Compare portfolio behaviour against a selected benchmark using historical data.",
    model:
      "The module compares portfolio returns, excess return, volatility, drawdown, and yearly behaviour against a benchmark series.",
    why:
      "Benchmark comparison helps users understand whether a portfolio historically behaved differently from the broader market.",
    example:
      "A user can compare a model portfolio against Nifty 50 to study relative historical performance.",
  },
  {
    name: "Data Dashboard",
    icon: "◭",
    tag: "DATA",
    what:
      "Organise historical price data, portfolio output, and analytics reports in one dashboard.",
    model:
      "The dashboard presents historical tables, charts, return summaries, drawdown views, and portfolio analytics in a clean format.",
    why:
      "A structured dashboard makes it easier to review historical results without manually checking multiple files.",
    example:
      "A user can open the dashboard and quickly review portfolio NAV, yearly returns, drawdown, and risk metrics.",
  },
  {
    name: "Scenario Review",
    icon: "▽",
    tag: "SCENARIO",
    what:
      "Review how a portfolio behaved during different historical market phases.",
    model:
      "The module studies historical periods such as strong markets, weak markets, sideways phases, and high-volatility periods.",
    why:
      "A portfolio may behave differently across market phases. Scenario review helps users understand those historical patterns.",
    example:
      "A user can review how a portfolio behaved during a previous volatile period compared with a calmer period.",
  },
  {
    name: "Report Builder",
    icon: "⬡",
    tag: "REPORT",
    what:
      "Create clean historical analytics summaries for portfolio review.",
    model:
      "The report builder can summarize returns, risk metrics, drawdowns, calendar-year returns, and rebalancing results.",
    why:
      "A clear report helps users document and review their backtesting work in a structured way.",
    example:
      "A user can generate a simple portfolio backtest report showing historical NAV, returns, volatility, and drawdown.",
  },
  {
    name: "Research Notes",
    icon: "⬢",
    tag: "NOTES",
    what:
      "Keep notes and observations related to historical portfolio studies.",
    model:
      "The module allows users to document assumptions, backtest settings, selected universe, rebalancing rules, and observations.",
    why:
      "Good research requires clean documentation. Notes help users remember why a backtest was created and what assumptions were used.",
    example:
      "A user can save notes explaining the portfolio universe, rebalance frequency, and date range used in a study.",
  },
];

const socialLinks = [
  { label: "LinkedIn", url: "https://www.linkedin.com/company/lightninbull/" },
  { label: "Instagram", url: "https://www.instagram.com/lightninbull/" },
  { label: "Facebook", url: "https://www.facebook.com/lightninbull/" },
  { label: "Pinterest", url: "https://www.pinterest.com/lightninbull/" },
  { label: "Twitter", url: "https://x.com/lightninbull" },
];

const LocalLightning: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const boltsRef = useRef<Array<{ pts: { x: number; y: number }[]; opacity: number }>>([]);
  const lastBoltTime = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const makeBolt = (mx: number, my: number) => {
      const angle = Math.random() * Math.PI * 2;
      const len = 80 + Math.random() * 100;
      const pts: { x: number; y: number }[] = [{ x: mx, y: my }];
      const segs = 6 + Math.floor(Math.random() * 5);

      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const baseX = mx + Math.cos(angle) * len * t;
        const baseY = my + Math.sin(angle) * len * t;

        pts.push({
          x: baseX + (Math.random() - 0.5) * 28,
          y: baseY + (Math.random() - 0.5) * 28,
        });
      }

      boltsRef.current.push({ pts, opacity: 0.9 });
      if (boltsRef.current.length > 3) boltsRef.current.shift();
    };

    const onMouseMove = (e: MouseEvent) => {
      const now = Date.now();

      if (now - lastBoltTime.current > 3000 + Math.random() * 3000) {
        makeBolt(e.clientX, e.clientY);
        lastBoltTime.current = now;
      }
    };

    window.addEventListener("mousemove", onMouseMove);

    const draw = () => {
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      boltsRef.current = boltsRef.current.filter((b) => b.opacity > 0.02);

      for (const bolt of boltsRef.current) {
        const { pts, opacity } = bolt;
        if (pts.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(250,204,21,${opacity * 0.35})`;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 18;
        ctx.shadowColor = `rgba(250,200,0,${opacity * 0.7})`;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(255,245,160,${opacity * 0.85})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(255,255,200,${opacity})`;
        ctx.stroke();

        bolt.opacity *= 0.72;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
};

interface GlassCardProps {
  feature: FeatureInfo;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({ feature, index, isSelected, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const sparkingRef = useRef(false);

  const fireSparks = (clickX: number, clickY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || sparkingRef.current) return;

    sparkingRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sparks: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      len: number;
      opacity: number;
      life: number;
    }> = [];

    const count = 10 + Math.floor(Math.random() * 8);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 1.5 + Math.random() * 3.5;

      sparks.push({
        x: clickX,
        y: clickY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 18 + Math.random() * 28,
        opacity: 0.9 + Math.random() * 0.1,
        life: 1,
      });
    }

    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.5;

      sparks.push({
        x: clickX + (Math.random() - 0.5) * 20,
        y: clickY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 10 + Math.random() * 14,
        opacity: 0.7,
        life: 1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const s of sparks) {
        if (s.life <= 0) continue;

        alive = true;
        s.life -= 0.06;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.88;
        s.vy *= 0.88;

        const op = s.opacity * s.life;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 4), s.y - s.vy * (s.len / 4));
        ctx.strokeStyle = `rgba(250,204,21,${op * 0.35})`;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(250,200,0,${op * 0.8})`;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 4), s.y - s.vy * (s.len / 4));
        ctx.strokeStyle = `rgba(255,248,160,${op * 0.95})`;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = `rgba(255,255,200,${op})`;
        ctx.stroke();
      }

      if (alive) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        sparkingRef.current = false;
      }
    };

    requestAnimationFrame(draw);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const card = cardRef.current;

    if (card) {
      const rect = card.getBoundingClientRect();
      fireSparks(e.clientX - rect.left, e.clientY - rect.top);
    }

    onClick();
  };

  return (
    <button
      ref={cardRef}
      type="button"
      className={`feature-card ${isSelected ? "selected" : ""}`}
      style={{ animationDelay: `${index * 0.035}s` }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10,
          borderRadius: "12px",
        }}
      />

      <div className="feature-topline">
        <span className="card-icon">{feature.icon}</span>
        <span className="feature-tag">{feature.tag}</span>
      </div>

      <h3 className="card-title">
        <span className="title-thunder">{feature.name}</span>
      </h3>

      <p className="card-desc">{feature.what}</p>

      <span className="feature-action">View details →</span>
      <div className="card-corner" />
    </button>
  );
};

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState(initialSignUpState);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo | null>(features[0]);

  const authCardRef = useRef<HTMLDivElement | null>(null);
  const intelligenceRef = useRef<HTMLElement | null>(null);
  const aboutRef = useRef<HTMLElement | null>(null);
  const contactRef = useRef<HTMLElement | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const heading = useMemo(
    () =>
      mode === "login"
        ? "access your backtesting dashboard"
        : "create your lightninbull account",
    [mode]
  );

  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const scrollToElement = (el: HTMLElement | null) => {
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openSignUp = () => {
    setMode("signup");
    resetMessages();

    setTimeout(() => {
      authCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleFeatureClick = (feature: FeatureInfo) => {
    setSelectedFeature(feature);

    setTimeout(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
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
      setErrorMessage(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpChange =
    (field: keyof typeof initialSignUpState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSignUpForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!acceptedLegal) {
      setErrorMessage(
        "Please accept the Terms, Privacy Policy, Refund Policy, and Disclaimer to continue."
      );
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
      setErrorMessage(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const activeFeature = selectedFeature ?? features[0];

  return (
    <div className="auth-page lb-auth-page">
      <LocalLightning />

      <section className="hero-section">
        <video autoPlay muted loop playsInline className="bg-video">
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>

        <div className="video-overlay" />
        <div className="noise-overlay" />
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />

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
              backtesting
            </button>
            <button type="button" onClick={() => scrollToElement(intelligenceRef.current)}>
              analytics
            </button>
            <button type="button" onClick={() => scrollToElement(aboutRef.current)}>
              about
            </button>
            <button type="button" onClick={() => scrollToElement(contactRef.current)}>
              contact
            </button>
            <button type="button" className="nav-cta" onClick={openSignUp}>
              start
            </button>
          </div>
        </nav>

        <div className="hero-content lb-auth-main">
          <div className="hero-copy lb-auth-left">
            <p className="hero-eyebrow lb-auth-eyebrow">
              HISTORICAL BACKTESTING • PORTFOLIO ANALYTICS
            </p>

            <h1 className="hero-title lb-auth-hero-title">
              Simple backtesting
              <span> for smarter research.</span>
            </h1>

            <p className="hero-subtitle lb-auth-hero-text">
              LightninBull helps users study historical stock data, portfolio returns,
              drawdowns, rebalancing rules, and risk metrics in one clean dashboard.
            </p>

            <div className="hero-points lb-auth-points">
              <span>Historical backtests</span>
              <span>Portfolio metrics</span>
              <span>Drawdown study</span>
              <span>Yearly returns</span>
            </div>

            <div className="hero-actions">
              <button type="button" className="primary-cta" onClick={openSignUp}>
                Start Backtesting
              </button>
              <button
                type="button"
                className="secondary-cta"
                onClick={() => scrollToElement(intelligenceRef.current)}
              >
                View Features
              </button>
            </div>

            <p className="hero-disclaimer">
              Educational historical analytics only. Past performance does not guarantee
              future results.
            </p>
          </div>

          <div className="auth-panel lb-auth-right" ref={authCardRef}>
            <div className="auth-card lb-auth-card">
              <h2 className="auth-title lb-auth-card-title">{heading}</h2>

              <div className="auth-switch lb-auth-switch">
                <button
                  type="button"
                  className={mode === "login" ? "active" : ""}
                  onClick={() => {
                    setMode("login");
                    resetMessages();
                  }}
                >
                  Login
                </button>

                <button
                  type="button"
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => {
                    setMode("signup");
                    resetMessages();
                  }}
                >
                  Sign Up
                </button>
              </div>

              <form
                className="auth-form lb-auth-form"
                onSubmit={mode === "login" ? handleLogin : handleRegister}
              >
                {mode === "signup" && (
                  <>
                    <div className="auth-field lb-auth-field">
                      <label htmlFor="name">Full Name</label>
                      <input
                        id="name"
                        type="text"
                        value={signUpForm.name}
                        onChange={handleSignUpChange("name")}
                        placeholder="Enter your name"
                        autoComplete="name"
                        required
                      />
                    </div>

                    <div className="auth-field lb-auth-field">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        value={signUpForm.email}
                        onChange={handleSignUpChange("email")}
                        placeholder="Enter your email"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </>
                )}

                <div className="auth-field lb-auth-field">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={mode === "login" ? phone : signUpForm.phone}
                    onChange={
                      mode === "login"
                        ? (e) => setPhone(e.target.value)
                        : handleSignUpChange("phone")
                    }
                    placeholder="Enter your phone number"
                    autoComplete="tel"
                    required
                  />
                </div>

                <div className="auth-field lb-auth-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={mode === "login" ? password : signUpForm.password}
                    onChange={
                      mode === "login"
                        ? (e) => setPassword(e.target.value)
                        : handleSignUpChange("password")
                    }
                    placeholder="Enter your password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
                </div>

                {mode === "signup" && (
                  <>
                    <div className="auth-field lb-auth-field">
                      <label htmlFor="confirmPassword">Confirm Password</label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={signUpForm.confirmPassword}
                        onChange={handleSignUpChange("confirmPassword")}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <label className="auth-legal-check">
                      <input
                        type="checkbox"
                        checked={acceptedLegal}
                        onChange={(e) => setAcceptedLegal(e.target.checked)}
                      />
                      <span>
                        I agree to the{" "}
                        <a href="/terms" target="_blank" rel="noreferrer">
                          Terms
                        </a>
                        ,{" "}
                        <a href="/privacy" target="_blank" rel="noreferrer">
                          Privacy Policy
                        </a>
                        ,{" "}
                        <a href="/refund-policy" target="_blank" rel="noreferrer">
                          Refund Policy
                        </a>
                        , and{" "}
                        <a href="/disclaimer" target="_blank" rel="noreferrer">
                          Disclaimer
                        </a>
                        .
                      </span>
                    </label>
                  </>
                )}

                {errorMessage && <p className="auth-error lb-auth-error">{errorMessage}</p>}
                {successMessage && <p className="auth-success">{successMessage}</p>}

                <button
                  type="submit"
                  className="auth-submit lb-auth-submit"
                  disabled={loading || (mode === "signup" && !acceptedLegal)}
                >
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                    ? "Access Dashboard"
                    : "Create Account"}
                </button>
              </form>

              <p className="auth-footer-text lb-auth-footer-text">
                {mode === "login" ? (
                  <>
                    New to LightninBull?{" "}
                    <span
                      onClick={() => {
                        setMode("signup");
                        resetMessages();
                      }}
                    >
                      Create account
                    </span>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <span
                      onClick={() => {
                        setMode("login");
                        resetMessages();
                      }}
                    >
                      Login
                    </span>
                  </>
                )}
              </p>

              <p className="auth-disclaimer">{complianceDisclaimer}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="intelligence-section" ref={intelligenceRef}>
        <div className="section-heading">
          <p className="section-eyebrow">LIGHTNINBULL BACKTESTING</p>
          <h2>Historical analytics made simple</h2>
          <p>
            Review portfolios, study past performance, compare risk metrics, and understand
            how different rules behaved historically.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <GlassCard
              key={feature.name}
              feature={feature}
              index={index}
              isSelected={activeFeature.name === feature.name}
              onClick={() => handleFeatureClick(feature)}
            />
          ))}
        </div>

        <div className="feature-detail-panel" ref={detailPanelRef}>
          <div className="detail-header">
            <span className="detail-icon">{activeFeature.icon}</span>

            <div>
              <p className="detail-tag">{activeFeature.tag}</p>
              <h3>{activeFeature.name}</h3>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-block">
              <h4>What it does</h4>
              <p>{activeFeature.what}</p>
            </div>

            <div className="detail-block">
              <h4>How it works</h4>
              <p>{activeFeature.model}</p>
            </div>

            <div className="detail-block">
              <h4>Why it helps</h4>
              <p>{activeFeature.why}</p>
            </div>

            <div className="detail-block">
              <h4>Example</h4>
              <p>{activeFeature.example}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section" ref={aboutRef}>
        <div className="about-content">
          <p className="section-eyebrow">ABOUT LIGHTNINBULL</p>

          <h2>A simple platform for historical portfolio study</h2>

          <p>
            LightninBull is built to help users backtest portfolios, review historical
            returns, study drawdowns, compare rebalancing rules, and understand risk metrics
            using a clean analytics dashboard.
          </p>

          <div className="about-points">
            <span>Historical backtesting</span>
            <span>Portfolio analytics</span>
            <span>Risk review</span>
            <span>Report summaries</span>
          </div>
        </div>
      </section>

      <section className="contact-section" ref={contactRef}>
        <div className="contact-card">
          <p className="section-eyebrow">CONNECT</p>

          <h2>Follow LightninBull</h2>

          <p>
            Stay updated with platform improvements, backtesting features, and historical
            analytics tools.
          </p>

          <div className="social-links">
            {socialLinks.map((link) => (
              <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>

          <div className="legal-footer-links">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/refund-policy">Refund Policy</a>
            <a href="/disclaimer">Disclaimer</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Auth;
