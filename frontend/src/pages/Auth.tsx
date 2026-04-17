import React, { useState } from "react";
import {
  loginUser,
  registerUser,
  saveAuthToken,
} from "../api";

type AuthMode = "login" | "signup";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
  outline: "none",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  color: "#cbd5e1",
  fontSize: "14px",
  fontWeight: 500,
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
        justifyContent: "center",
        padding: "24px",
        background: "#020617",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#020617",
          zIndex: 0,
        }}
      />

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
        Your browser does not support the video tag.
      </video>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(135deg, rgba(2,6,23,0.82), rgba(15,23,42,0.68))",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(circle at center, rgba(250,204,21,0.08), transparent 45%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "490px",
          borderRadius: "28px",
          padding: "36px 30px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(15, 23, 42, 0.68)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 20px 70px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 800,
              color: "#f8fafc",
              letterSpacing: "-0.02em",
            }}
          >
            Lightninbull
          </h1>

          <p
            style={{
              marginTop: "10px",
              marginBottom: 0,
              color: "#94a3b8",
              fontSize: "15px",
            }}
          >
            Sign in to access your dashboard
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange("login")}
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              border:
                mode === "login"
                  ? "1px solid rgba(250,204,21,0.35)"
                  : "1px solid rgba(255,255,255,0.08)",
              background:
                mode === "login"
                  ? "linear-gradient(90deg, rgba(250,204,21,0.16), rgba(255,255,255,0.04))"
                  : "rgba(255,255,255,0.03)",
              color: "#f8fafc",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("signup")}
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              border:
                mode === "signup"
                  ? "1px solid rgba(250,204,21,0.35)"
                  : "1px solid rgba(255,255,255,0.08)",
              background:
                mode === "signup"
                  ? "linear-gradient(90deg, rgba(250,204,21,0.16), rgba(255,255,255,0.04))"
                  : "rgba(255,255,255,0.03)",
              color: "#f8fafc",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <div style={{ marginBottom: "18px" }}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "18px" }}>
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

          <div style={{ marginBottom: "18px" }}>
            <label style={labelStyle}>Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
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
            <div style={{ marginBottom: "18px" }}>
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
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "12px",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#fecaca",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "12px",
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "#bbf7d0",
                fontSize: "14px",
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
              marginTop: "8px",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "none",
              background: "#facc15",
              color: "#0f172a",
              fontSize: "18px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.8 : 1,
              boxShadow: "0 10px 30px rgba(250,204,21,0.18)",
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
