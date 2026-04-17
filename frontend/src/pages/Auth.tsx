import React, { useState } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";

type AuthMode = "login" | "signup";

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await loginUser(phone, password);
      saveAuthToken(result.access_token);
      window.location.href = "/dashboard";
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingLeft: "max(40px, 6%)", // ✅ PERFECT LEFT SPACING
        background: "#020617",
        overflow: "hidden",
      }}
    >
      {/* 🎬 Background Video */}
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

      {/* 🌑 Cinematic Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.2) 100%)",
          zIndex: 1,
        }}
      />

      {/* 💎 Login Card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "320px",
          padding: "24px",
          borderRadius: "20px",
          background: "rgba(15,15,15,0.75)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,215,0,0.2)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          transform: "translateY(-10px)", // ✅ balanced vertical alignment
        }}
      >
        {/* 🔥 Title */}
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#fff",
            marginBottom: "6px",
          }}
        >
          Lightninbull
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "14px",
            color: "#9ca3af",
            marginBottom: "20px",
          }}
        >
          Access your trading dashboard
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "10px",
              border: "1px solid rgba(255,215,0,0.3)",
              background:
                mode === "login"
                  ? "linear-gradient(90deg, #facc15, #f59e0b)"
                  : "transparent",
              color: mode === "login" ? "#000" : "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Login
          </button>

          <button
            onClick={() => setMode("signup")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <input
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              marginBottom: "12px",
              fontSize: "14px",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          />

          {/* 🔥 Gold Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "none",
              background:
                "linear-gradient(90deg, #facc15 0%, #f59e0b 100%)",
              color: "#000",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(250,204,21,0.3)",
            }}
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
