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

    if (!validateLogin()) return;

    try {
      setLoading(true);
      const result = await loginUser(phone.trim(), password);
      saveAuthToken(result.access_token);
      localStorage.setItem("userPhone", phone.trim());
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    resetMessages();

    if (!validateSignup()) return;

    try {
      setLoading(true);

      await registerUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      setSuccess("Account created. Please login.");
      setMode("login");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    mode === "login" ? handleLogin() : handleSignup();
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
        paddingLeft: "80px",
        background: "#020617",
      }}
    >
      {/* Video */}
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

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(2,6,23,0.85), rgba(15,23,42,0.6))",
          zIndex: 1,
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "420px",
          padding: "28px 24px",
          borderRadius: "24px",
          background: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          transform: "translateY(-20px)",
        }}
      >
        <h1 style={{ color: "#fff", textAlign: "center" }}>
          Lightninbull
        </h1>
        <p style={{ textAlign: "center", color: "#94a3b8" }}>
          Sign in to access your dashboard
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button onClick={() => handleTabChange("login")}>Login</button>
          <button onClick={() => handleTabChange("signup")}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <input placeholder="Name" style={inputStyle} onChange={(e) => setName(e.target.value)} />
              <input placeholder="Email" style={inputStyle} onChange={(e) => setEmail(e.target.value)} />
            </>
          )}

          <input placeholder="Phone" style={inputStyle} onChange={(e) => setPhone(e.target.value)} />
          <input type="password" placeholder="Password" style={inputStyle} onChange={(e) => setPassword(e.target.value)} />

          {mode === "signup" && (
            <input type="password" placeholder="Confirm Password" style={inputStyle} onChange={(e) => setConfirmPassword(e.target.value)} />
          )}

          {error && <p style={{ color: "red" }}>{error}</p>}
          {success && <p style={{ color: "green" }}>{success}</p>}

          <button type="submit" style={{ width: "100%", marginTop: "10px" }}>
            {loading ? "Processing..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
