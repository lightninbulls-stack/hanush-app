import { useState } from "react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #151515 0%, #090909 45%, #000000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(18, 18, 18, 0.92)",
          border: "1px solid rgba(255, 215, 0, 0.14)",
          borderRadius: "24px",
          padding: "32px 28px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.55)",
          textAlign: "center",
        }}
      >
        <img
          src="/lightninbull-bull.png"
          alt="Lightninbull"
          style={{
            width: "220px",
            maxWidth: "100%",
            margin: "0 auto 12px",
            display: "block",
          }}
        />

        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 800,
            color: "#f4d06f",
          }}
        >
          Lightninbull
        </h1>

        <p
          style={{
            marginTop: "6px",
            marginBottom: "24px",
            color: "#b8b8b8",
            fontSize: "0.98rem",
          }}
        >
          Financial Analytics
        </p>

        <h2
          style={{
            marginBottom: "18px",
            color: "#ffffff",
            fontSize: "1.7rem",
            fontWeight: 800,
            textAlign: "left",
          }}
        >
          {mode === "login" ? "Login" : "Register"}
        </h2>

        {mode === "register" && (
          <input
            placeholder="Email"
            style={inputStyle}
          />
        )}

        {mode === "register" && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
            <input placeholder="+91" style={{ ...inputStyle, marginBottom: 0, width: "110px" }} />
            <input placeholder="Phone number" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          </div>
        )}

        {mode === "register" && (
          <input
            placeholder="Instagram ID (optional)"
            style={inputStyle}
          />
        )}

        {mode === "login" ? (
          <input
            placeholder="Phone number"
            style={inputStyle}
          />
        ) : null}

        <input
          type="password"
          placeholder="Password"
          style={inputStyle}
        />

        <button
          onClick={() => alert("UI is working. Backend wiring next.")}
          style={{
            width: "100%",
            padding: "13px 14px",
            borderRadius: "10px",
            border: "none",
            background: "linear-gradient(90deg, #d8b15a 0%, #c89f43 100%)",
            color: "#111111",
            fontSize: "1.05rem",
            fontWeight: 800,
            cursor: "pointer",
            marginTop: "4px",
          }}
        >
          {mode === "login" ? "Login" : "Register"}
        </button>

        <p
          style={{
            marginTop: "18px",
            color: "#c8c8c8",
            fontSize: "0.96rem",
          }}
        >
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <span
            style={{
              color: "#f2c94c",
              cursor: "pointer",
              fontWeight: 700,
            }}
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  marginBottom: "14px",
  background: "#f5f7ff",
  border: "1px solid #d7dbe7",
  borderRadius: "10px",
  color: "#111111",
  fontSize: "0.98rem",
  outline: "none",
  boxSizing: "border-box",
};
