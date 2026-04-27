import React, { useMemo, useState } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";
import "./Auth.css";

type AuthMode = "login" | "signup";

const initialSignUpState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const features = [
  {
    title: "Historical Backtests",
    text: "Study how a portfolio would have performed historically using past market data.",
  },
  {
    title: "Portfolio Metrics",
    text: "Review returns, volatility, drawdown, Sharpe ratio, Sortino ratio, and yearly performance.",
  },
  {
    title: "Drawdown Study",
    text: "Understand historical portfolio declines, recovery periods, and risk behaviour.",
  },
  {
    title: "Rebalancing Review",
    text: "Compare monthly, quarterly, or custom rebalancing rules using historical data.",
  },
];

const complianceDisclaimer =
  "LightninBull is an educational historical backtesting and portfolio analytics platform. It helps users study past market data, portfolio behaviour, risk metrics, and backtest results. It does not provide investment advice, stock recommendations, buy/sell calls, guaranteed returns, research analyst services, or portfolio management services.";

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState(initialSignUpState);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const heading = useMemo(() => {
    return mode === "login"
      ? "Access your backtesting dashboard"
      : "Create your LightninBull account";
  }, [mode]);

  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSignUpChange =
    (field: keyof typeof initialSignUpState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSignUpForm((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const result = await loginUser(phone, password);
      saveAuthToken(result.access_token);
      window.location.href = "/dashboard";
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lb-auth-page">
      <header className="lb-auth-header">
        <div className="lb-auth-header-inner">
          <div className="lb-auth-brand">
            <div className="lb-auth-logo-mark">⚡</div>
            <div>
              <div className="lb-auth-brand-title">LightninBull</div>
              <div className="lb-auth-brand-subtitle">
                Historical Backtesting Platform
              </div>
            </div>
          </div>

          <nav className="lb-auth-nav">
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#legal">Disclaimer</a>
          </nav>
        </div>
      </header>

      <main className="lb-auth-main">
        <section className="lb-auth-left">
          <p className="lb-auth-eyebrow">
            HISTORICAL BACKTESTING • PORTFOLIO ANALYTICS
          </p>

          <h1 className="lb-auth-hero-title">
            Simple backtesting for portfolio research.
          </h1>

          <p className="lb-auth-hero-text">
            LightninBull helps users study historical portfolio performance,
            yearly returns, drawdowns, rebalancing rules, and risk metrics in one
            clean dashboard.
          </p>

          <div className="lb-auth-points">
            <span>Historical backtests</span>
            <span>Portfolio metrics</span>
            <span>Drawdown study</span>
            <span>Yearly returns</span>
          </div>

          <p className="lb-auth-small-note">
            Educational analytics only. Past performance does not guarantee future results.
          </p>
        </section>

        <section className="lb-auth-right">
          <div className="lb-auth-card">
            <h2 className="lb-auth-card-title">{heading}</h2>

            <div className="lb-auth-switch">
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
              className="lb-auth-form"
              onSubmit={mode === "login" ? handleLogin : handleRegister}
            >
              {mode === "signup" && (
                <>
                  <div className="lb-auth-field">
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

                  <div className="lb-auth-field">
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

              <div className="lb-auth-field">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  value={mode === "login" ? phone : signUpForm.phone}
                  onChange={
                    mode === "login"
                      ? (event) => setPhone(event.target.value)
                      : handleSignUpChange("phone")
                  }
                  placeholder="Enter your phone number"
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="lb-auth-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={mode === "login" ? password : signUpForm.password}
                  onChange={
                    mode === "login"
                      ? (event) => setPassword(event.target.value)
                      : handleSignUpChange("password")
                  }
                  placeholder="Enter your password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
              </div>

              {mode === "signup" && (
                <>
                  <div className="lb-auth-field">
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

                  <label className="lb-auth-legal-check">
                    <input
                      type="checkbox"
                      checked={acceptedLegal}
                      onChange={(event) => setAcceptedLegal(event.target.checked)}
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

              {errorMessage && <p className="lb-auth-error">{errorMessage}</p>}
              {successMessage && <p className="lb-auth-success">{successMessage}</p>}

              <button
                type="submit"
                className="lb-auth-submit"
                disabled={loading || (mode === "signup" && !acceptedLegal)}
              >
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Access Dashboard"
                  : "Create Account"}
              </button>
            </form>

            <p className="lb-auth-footer-text">
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
          </div>
        </section>
      </main>

      <section id="features" className="lb-auth-section">
        <div className="lb-auth-section-heading">
          <p>PLATFORM FEATURES</p>
          <h2>Clean historical analytics</h2>
          <span>
            Simple tools to study past portfolio behaviour, not trading advice.
          </span>
        </div>

        <div className="lb-auth-feature-grid">
          {features.map((feature) => (
            <div className="lb-auth-feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="lb-auth-section lb-auth-about">
        <div className="lb-auth-about-card">
          <p>ABOUT LIGHTNINBULL</p>
          <h2>Built for backtesting and portfolio review</h2>
          <span>
            LightninBull is designed to help users review historical portfolio
            results, understand risk metrics, compare rebalancing rules, and keep
            their analysis organized.
          </span>
        </div>
      </section>

      <section id="legal" className="lb-auth-legal-section">
        <p>{complianceDisclaimer}</p>

        <div className="lb-auth-legal-links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/refund-policy">Refund Policy</a>
          <a href="/disclaimer">Disclaimer</a>
          <a href="/contact">Contact</a>
        </div>
      </section>
    </div>
  );
};

export default Auth;
