import React, { useEffect, useMemo, useState } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";

type AuthMode = "login" | "signup";

const initialSignUpState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const quantFeatures = [
  {
    icon: "⭐",
    title: "Watchlist",
    desc: "Track high-conviction stocks with real-time intelligence and signals.",
  },
  {
    icon: "📊",
    title: "Portfolio Backtest",
    desc: "Simulate strategies and evaluate performance with institutional-grade metrics.",
  },
  {
    icon: "⚡",
    title: "Consistent Trending",
    desc: "Identify stocks with stable momentum and sustained directional strength.",
  },
  {
    icon: "⚖️",
    title: "Slow Movement",
    desc: "Capture low-volatility setups for accumulation and positional trades.",
  },
  {
    icon: "💰",
    title: "Cheap Value",
    desc: "Discover undervalued stocks trading below intrinsic or relative value.",
  },
  {
    icon: "💎",
    title: "Best Quality",
    desc: "Filter fundamentally strong companies with superior balance sheets and returns.",
  },
  {
    icon: "📈",
    title: "Regime Upside",
    desc: "Detect bullish market environments using quantitative regime models.",
  },
  {
    icon: "📉",
    title: "Regime Downside",
    desc: "Identify bearish regimes to protect capital and manage downside risk.",
  },
  {
    icon: "🟢",
    title: "Range Bound Upside",
    desc: "Find upside breakout candidates from consolidation zones.",
  },
  {
    icon: "🔴",
    title: "Range Bound Downside",
    desc: "Spot downside breakdown opportunities in range-bound structures.",
  },
  {
    icon: "🟢",
    title: "Aggressive Call Option Stocks",
    desc: "Identify stocks showing bullish derivatives demand and upside positioning.",
  },
  {
    icon: "🔴",
    title: "Aggressive Put Option Stocks",
    desc: "Identify stocks showing bearish derivatives pressure and downside sentiment.",
  },
  {
    icon: "🟢",
    title: "Bull Call Spreads",
    desc: "Deploy structured intraday upside strategies with defined risk.",
  },
  {
    icon: "🔴",
    title: "Bear Put Spreads",
    desc: "Deploy structured intraday downside strategies with controlled exposure.",
  },
  {
    icon: "🟢",
    title: "Upside Trend Stocks",
    desc: "Track live bullish momentum signals during market hours.",
  },
  {
    icon: "🔴",
    title: "Downside Trend Stocks",
    desc: "Track live bearish momentum signals during market hours.",
  },
];

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState(initialSignUpState);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [visibleCards, setVisibleCards] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById("quant-ai-section");
      if (!section) return;

      const rect = section.getBoundingClientRect();

      if (rect.top < window.innerHeight * 0.75) {
        setVisibleCards(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const heading = useMemo(
    () =>
      mode === "login"
        ? "Access your trading dashboard"
        : "Create your Lightninbull account",
    [mode]
  );

  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
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

    if (
      !signUpForm.name.trim() ||
      !signUpForm.email.trim() ||
      !signUpForm.phone.trim() ||
      !signUpForm.password.trim()
    ) {
      setErrorMessage("Please fill all fields.");
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

      const loginResult = await loginUser(
        signUpForm.phone,
        signUpForm.password
      );

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

  const sharedInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    marginBottom: "12px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const primaryButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(90deg, #facc15 0%, #f59e0b 100%)",
    color: "#000",
    fontSize: "16px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(250,204,21,0.35)",
  };

  return (
    <div style={{ background: "#000000", color: "#fff", overflowX: "hidden" }}>
      <section
        style={{
          minHeight: "68vh",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: "28px",
          background: "#000000",
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        >
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.62) 32%, rgba(0,0,0,0.2) 100%)",
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "360px",
            padding: "24px",
            borderRadius: "20px",
            background: "rgba(8,8,8,0.78)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,215,0,0.25)",
            boxShadow:
              "0 10px 40px rgba(0,0,0,0.75), 0 0 24px rgba(255,215,0,0.09)",
            transform: "translateY(-8px)",
          }}
        >
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "6px",
            }}
          >
            Lightninbull
          </h1>

          <p
            style={{
              fontSize: "14px",
              color: "#9ca3af",
              marginBottom: "20px",
            }}
          >
            {heading}
          </p>

          <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                resetMessages();
              }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "10px",
                border:
                  mode === "login"
                    ? "1px solid rgba(255,215,0,0.4)"
                    : "1px solid rgba(255,255,255,0.1)",
                background:
                  mode === "login"
                    ? "linear-gradient(90deg, #facc15, #f59e0b)"
                    : "transparent",
                color: mode === "login" ? "#000" : "#fff",
                fontSize: "14px",
                fontWeight: mode === "login" ? 700 : 600,
                cursor: "pointer",
              }}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                resetMessages();
              }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "10px",
                border:
                  mode === "signup"
                    ? "1px solid rgba(255,215,0,0.4)"
                    : "1px solid rgba(255,255,255,0.1)",
                background:
                  mode === "signup"
                    ? "linear-gradient(90deg, #facc15, #f59e0b)"
                    : "transparent",
                color: mode === "signup" ? "#000" : "#fff",
                fontSize: "14px",
                fontWeight: mode === "signup" ? 700 : 600,
                cursor: "pointer",
              }}
            >
              Sign Up
            </button>
          </div>

          {errorMessage ? (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "12px",
                background: "rgba(220, 38, 38, 0.18)",
                border: "1px solid rgba(248, 113, 113, 0.45)",
                color: "#fecaca",
                fontSize: "13px",
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "12px",
                background: "rgba(22, 163, 74, 0.18)",
                border: "1px solid rgba(74, 222, 128, 0.45)",
                color: "#bbf7d0",
                fontSize: "13px",
              }}
            >
              {successMessage}
            </div>
          ) : null}

          {mode === "login" ? (
            <form onSubmit={handleLogin}>
              <input
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={sharedInputStyle}
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  ...sharedInputStyle,
                  marginBottom: "16px",
                }}
              />

              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? "Loading..." : "Login"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <input
                placeholder="Full Name"
                value={signUpForm.name}
                onChange={handleSignUpChange("name")}
                style={sharedInputStyle}
              />

              <input
                type="email"
                placeholder="Email"
                value={signUpForm.email}
                onChange={handleSignUpChange("email")}
                style={sharedInputStyle}
              />

              <input
                placeholder="Phone Number"
                value={signUpForm.phone}
                onChange={handleSignUpChange("phone")}
                style={sharedInputStyle}
              />

              <input
                type="password"
                placeholder="Password"
                value={signUpForm.password}
                onChange={handleSignUpChange("password")}
                style={sharedInputStyle}
              />

              <input
                type="password"
                placeholder="Confirm Password"
                value={signUpForm.confirmPassword}
                onChange={handleSignUpChange("confirmPassword")}
                style={{
                  ...sharedInputStyle,
                  marginBottom: "16px",
                }}
              />

              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section
        id="quant-ai-section"
        style={{
          position: "relative",
          marginTop: "-110px",
          padding: "45px 42px 120px",
          background:
            "radial-gradient(circle at top, rgba(255,215,0,0.08), transparent 30%), #000000",
          borderTop: "1px solid rgba(255,215,0,0.14)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "rgba(255,215,0,0.06)",
            filter: "blur(80px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            left: "-120px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background: "rgba(255,140,0,0.05)",
            filter: "blur(80px)",
          }}
        />

        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            position: "relative",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "58px",
              opacity: visibleCards ? 1 : 0,
              transform: visibleCards ? "translateY(0)" : "translateY(35px)",
              transition: "all 0.8s ease",
            }}
          >
            <p
              style={{
                color: "#facc15",
                fontSize: "13px",
                fontWeight: 900,
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "14px",
              }}
            >
              Lightninbull Intelligence Layer
            </p>

            <h1
              style={{
                fontSize: "clamp(38px, 6vw, 74px)",
                lineHeight: 1,
                fontWeight: 950,
                color: "#f8fafc",
                letterSpacing: "-1px",
                margin: "0 0 22px",
                textShadow: "0 18px 60px rgba(255,215,0,0.12)",
              }}
            >
              Quant <span style={{ color: "#facc15" }}>AI</span> Fund Manager
            </h1>

            <p
              style={{
                maxWidth: "850px",
                margin: "0 auto",
                color: "#d1d5db",
                fontSize: "clamp(16px, 2vw, 21px)",
                lineHeight: 1.7,
              }}
            >
              A next-generation Quant AI Fund Manager that combines portfolio
              analytics, factor modeling, regime intelligence, derivatives
              insights, and real-time trading signals into a single adaptive
              platform.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "22px",
            }}
          >
            {quantFeatures.map((feature, index) => (
              <div
                key={feature.title}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    "translateY(-8px) scale(1.02)";
                  e.currentTarget.style.border =
                    "1px solid rgba(255,215,0,0.4)";
                  e.currentTarget.style.boxShadow =
                    "0 30px 75px rgba(0,0,0,0.85), 0 0 35px rgba(255,215,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = visibleCards
                    ? "translateY(0) scale(1)"
                    : "translateY(42px) scale(0.98)";
                  e.currentTarget.style.border =
                    "1px solid rgba(255,215,0,0.12)";
                  e.currentTarget.style.boxShadow =
                    "0 25px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)";
                }}
                style={{
                  minHeight: "175px",
                  padding: "26px",
                  borderRadius: "22px",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                  border: "1px solid rgba(255,215,0,0.12)",
                  backdropFilter: "blur(10px)",
                  boxShadow:
                    "0 25px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
                  opacity: visibleCards ? 1 : 0,
                  transform: visibleCards
                    ? "translateY(0) scale(1)"
                    : "translateY(42px) scale(0.98)",
                  transition: `all 0.75s ease ${index * 0.08}s`,
                  cursor: "default",
                }}
              >
                <div style={{ fontSize: "31px", marginBottom: "18px" }}>
                  {feature.icon}
                </div>

                <h3
                  style={{
                    fontSize: "18px",
                    color: "#f8d76b",
                    margin: "0 0 10px",
                    fontWeight: 850,
                  }}
                >
                  {feature.title}
                </h3>

                <p
                  style={{
                    color: "#a1a1aa",
                    fontSize: "14px",
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Auth;
