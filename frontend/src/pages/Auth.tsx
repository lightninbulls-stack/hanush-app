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

  const isRegister = mode === "register";

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await axios.post(`${API}/auth/register`, {
          name,
          email,
          password,
        });

        alert("Registration successful. Please login.");
        setMode("login");
        setName("");
        setPassword("");
      } else {
        const res = await axios.post(`${API}/auth/login`, {
          email,
          password,
        });

        localStorage.setItem("token", res.data.access_token);
        navigate("/");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Something went wrong");
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
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
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
          {isRegister ? "Register" : "Login"}
        </h2>

        {isRegister && (
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        )}

        <input
          type="email"
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
          {loading ? "Please wait..." : isRegister ? "Register" : "Login"}
        </button>

        <p
          style={{
            marginTop: "18px",
            color: "#c8c8c8",
            fontSize: "0.96rem",
          }}
        >
          {isRegister ? "Already registered?" : "No account?"}{" "}
          <span
            style={{
              color: "#f2c94c",
              cursor: "pointer",
              fontWeight: 700,
            }}
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
          >
            {isRegister ? "Login" : "Register"}
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
