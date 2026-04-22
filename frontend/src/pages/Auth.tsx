import React, { useMemo, useState } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";

type AuthMode = "login" | "signup";

const initialSignUpState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState(initialSignUpState);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingLeft: "28px",
        background: "#020617",
        overflow: "hidden",
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
            "linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.65) 30%, rgba(0,0,0,0.2) 100%)",
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
          background: "rgba(10,10,10,0.78)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,215,0,0.25)",
          boxShadow:
            "0 10px 40px rgba(0,0,0,0.6), 0 0 20px rgba(255,215,0,0.08)",
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
    </div>
  );
};

export default Auth;
