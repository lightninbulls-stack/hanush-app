import React, { useState } from "react";
import {
  loginUser,
  registerUser,
  saveAuthToken,
} from "../api";

type AuthMode = "login" | "signup";

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
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(30,41,59,0.95), rgba(2,6,23,1))",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          borderRadius: "24px",
          padding: "28px",
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(30,41,59,0.96))",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ marginBottom: "24px", textAlign: "center" }}>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#f8fafc",
              marginBottom: "8px",
            }}
          >
            Lightninbull
          </div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "14px",
            }}
          >
            Sign in to access your dashboard
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginBottom: "22px",
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

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          {mode === "signup" && (
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    marginBottom: "6px",
                  }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    marginBottom: "6px",
                  }}
                >
                  Email
                </label>
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

          <div>
            <label
              style={{
                display: "block",
                color: "#cbd5e1",
                fontSize: "13px",
                marginBottom: "6px",
              }}
            >
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                color: "#cbd5e1",
                fontSize: "13px",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={inputStyle}
            />
          </div>

          {mode === "signup" && (
            <div>
              <label
                style={{
                  display: "block",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  marginBottom: "6px",
                }}
              >
                Confirm Password
              </label>
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
                color: "#f87171",
                fontSize: "14px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: "12px",
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                color: "#4ade80",
                fontSize: "14px",
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.2)",
                borderRadius: "12px",
                padding: "10px 12px",
              }}
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background:
                "linear-gradient(90deg, rgba(250,204,21,0.95), rgba(234,179,8,0.95))",
              color: "#111827",
              fontWeight: 800,
              fontSize: "15px",
              opacity: loading ? 0.7 : 1,
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#f8fafc",
  outline: "none",
  fontSize: "14px",
  boxSizing: "border-box",
};

export default Auth;
