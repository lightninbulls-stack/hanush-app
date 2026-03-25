import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await axios.post(`${API}/auth/register`, { name, email, password });
        alert("Registered successfully. Please login.");
        setMode("login");
      } else {
        const res = await axios.post(`${API}/auth/login`, { email, password });
        localStorage.setItem("token", res.data.access_token);
        navigate("/");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

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
          background: "rgba(20,20,20,0.92)",
          border: "1px solid rgba(255,215,0,0.18)",
          borderRadius: "22px",
          padding: "32px 28px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          textAlign: "center",
        }}
      >
        <img
          src="/lightninbull-bull.png"
          alt="Lightninbull"
          style={{
            width: "220px",
            maxWidth: "100%",
            margin: "0 auto 14px",
            display: "block",
          }}
        />

        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 800,
            color: "#f4d06f",
            letterSpacing: "0.3px",
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
            fontSize: "1.35rem",
            fontWeight: 700,
          }}
        >
          {mode === "login" ? "Login to your account" : "Create your account"}
        </h2>

        {mode === "register" && (
          <input
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        )}

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error ? (
          <div
            style={{
              color: "#ff6b6b",
              fontSize: "0.92rem",
              marginBottom: "14px",
              textAlign: "left",
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px 14px",
            borderRadius: "12px",
            border: "none",
            background: "linear-gradient(90deg, #ffd54a 0%, #c99a1a 100%)",
            color: "#111",
            fontSize: "1rem",
            fontWeight: 800,
            cursor: "pointer",
            marginTop: "4px",
          }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Login"
            : "Register"}
        </button>

        <p
          style={{
            marginTop: "18px",
            color: "#bdbdbd",
            fontSize: "0.95rem",
          }}
        >
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <span
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={{
              color: "#ffd54a",
              cursor: "pointer",
              fontWeight: 700,
            }}
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
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  color: "#ffffff",
  fontSize: "0.96rem",
  outline: "none",
  boxSizing: "border-box",
};
