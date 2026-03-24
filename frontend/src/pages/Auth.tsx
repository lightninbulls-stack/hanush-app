// src/pages/Auth.tsx
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

const Auth = () => {
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
        alert("Registered! Please log in.");
        setMode("login");
      } else {
        const res = await axios.post(`${API}/auth/login`, { email, password });
        localStorage.setItem("token", res.data.access_token);
        navigate("/");   // ✅ redirect to dashboard after login
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#0a0a0a"
    }}>
      <div className="glass-card" style={{ padding: 40, width: 360 }}>
        <h2 className="glow-text" style={{ marginBottom: 24 }}>
          {mode === "login" ? "Login" : "Register"}
        </h2>

        {mode === "register" && (
          <input
            placeholder="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && <p style={{ color: "#ff4d4d", marginBottom: 12 }}>{error}</p>}

        <button onClick={handleSubmit} disabled={loading} style={btnStyle}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>

        <p style={{ color: "var(--text-dim)", marginTop: 16, textAlign: "center" }}>
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <span
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={{ color: "var(--primary-gold)", cursor: "pointer" }}
          >
            {mode === "login" ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginBottom: 14,
  background: "#1a1a1a", border: "1px solid #333",
  borderRadius: 6, color: "#fff", fontSize: "0.95rem", boxSizing: "border-box"
};

const btnStyle: React.CSSProperties = {
  width: "100%", padding: "12px", background: "var(--primary-gold)",
  border: "none", borderRadius: 6, color: "#000",
  fontWeight: 600, fontSize: "1rem", cursor: "pointer"
};

export default Auth;
