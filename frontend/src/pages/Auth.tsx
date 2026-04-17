import React, { useState } from "react";
import {
  loginUser,
  registerUser,
  saveAuthToken,
} from "../api";

type AuthMode = "login" | "signup";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: "16px",
  border: "1px solid rgba(255, 215, 0, 0.15)",
  background: "rgba(255,255,255,0.10)",
  color: "#f8fafc",
  outline: "none",
  fontSize: "18px",
  fontWeight: 500,
  boxSizing: "border-box",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "10px",
  color: "#f5d76e",
  fontSize: "17px",
  fontWeight: 600,
};

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleTabChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    resetMessages();
  };

  const validateLogin = (): boolean => {
    if (!phone.trim()) {
      setError("Phone number is required");
      return false;
    }

    if (!password.trim()) {
      setError("Password is required");
      return false;
    }

    return true;
  };

  const validateSignup = (): boolean => {
    if (!name.trim()) {
      setError("Name is required");
      return false;
    }

    if (!email.trim()) {
      setError("Email is required");
      return false;
    }

    if (!phone.trim()) {
      setError("Phone number is required");
      return false;
    }

    if (!password.trim()) {
      setError("Password is required");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    resetMessages();

    if (!validateLogin()) {
      return;
    }

    try {
      setLoading(true);

      const result = await loginUser(phone.trim(), password);
      saveAuthToken(result.access_token);
      localStorage.setItem("userPhone", phone.trim());

      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err?.message || "Invalid phone number or password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    resetMessages();

    if (!validateSignup()) {
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      setSuccess("Account created successfully. Please log in.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Registration failed:", err);
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "login") {
      await handleLogin();
    } else {
      await handleSignup();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingLeft: "90px",
        paddingRight: "24px",
        background: "#020617",
      }}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
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
          zIndex: 1,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(circle at left center, rgba(255,215,0,0.10), transparent 35%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "460px",
          padding: "34px 30px",
          borderRadius: "30px",
          border: "1px solid rgba(255, 215, 0, 0.18)",
          background:
            "linear-gradient(180deg, rgba(12,12,12,0.82), rgba(20,20,20,0.72))",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow:
            "0 20px 70px rgba(0,0,0,0.45), 0 0 25px rgba(255,215,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "34px",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            Lightninbull
          </h1>

          <p
            style={{
              marginTop: "12px",
              marginBottom: 0,
              color: "#d1d5db",
              fontSize: "20px",
              fontWeight: 500,
            }}
          >
            Sign in to access your dashboard
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
            marginBottom: "28px",
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange("login")}
            style={{
              padding: "14px 18px",
              borderRadius: "16px",
              border:
                mode === "login"
                  ? "1px solid rgba(255,215,0,0.45)"
                  : "1px solid rgba(255,255,255,0.10)",
              background:
                mode === "login"
                  ? "linear-gradient(90deg, rgba(255,215,0,0.28), rgba(255,193,7,0.12))"
                  : "rgba(255,255,255,0.04)",
              color: mode === "login" ? "#ffd54a" : "#f8fafc",
              fontWeight: 700,
              fontSize: "18px",
              cursor: "pointer",
              boxShadow:
                mode === "login"
                  ? "0 0 18px rgba(255,215,0,0.14)"
                  : "none",
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("signup")}
            style={{
              padding: "14px 18px",
              borderRadius: "16px",
              border:
                mode === "signup"
                  ? "1px solid rgba(255,215,0,0.45)"
                  : "1px solid rgba(255,255,255,0.10)",
              background:
                mode === "signup"
                  ? "linear-gradient(90deg, rgba(255,215,0,0.28), rgba(255,193,7,0.12))"
                  : "rgba(255,255,255,0.04)",
              color: mode === "signup" ? "#ffd54a" : "#f8fafc",
              fontWeight: 700,
              fontSize: "18px",
              cursor: "pointer",
              boxShadow:
                mode === "signup"
                  ? "0 0 18px rgba(255,215,0,0.14)"
                  : "none",
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={inputStyle}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={inputStyle}
            />
          </div>

          {mode === "signup" && (
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                style={inputStyle}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(220,38,38,0.14)",
                border: "1px solid rgba(248,113,113,0.28)",
                color: "#fecaca",
                fontSize: "16px",
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(34,197,94,0.14)",
                border: "1px solid rgba(134,239,172,0.28)",
                color: "#dcfce7",
                fontSize: "16px",
                fontWeight: 500,
              }}
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "16px 18px",
              borderRadius: "16px",
              border: "none",
              background:
                "linear-gradient(90deg, #facc15 0%, #fbbf24 50%, #f59e0b 100%)",
              color: "#111827",
              fontSize: "22px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
              boxShadow: "0 12px 30px rgba(250,204,21,0.22)",
            }}
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
