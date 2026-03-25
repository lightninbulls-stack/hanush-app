import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [instagramId, setInstagramId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await axios.post(`${API}/auth/register`, {
          name,
          email,
          country_code: countryCode,
          phone_number: phoneNumber,
          instagram_id: instagramId || null,
          password,
        });

        alert("Registered successfully. Please login.");
        setMode("login");
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
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <span
          style={topLinkStyle}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Login / Register" : "Back to Login"}
        </span>
      </div>

      <div style={cardStyle}>
        <img
          src="/lightninbull-bull.png"
          alt="Lightninbull"
          style={logoStyle}
        />

        <h1 style={brandStyle}>Lightninbull</h1>
        <p style={subBrandStyle}>Financial Analytics</p>

        <h2 style={titleStyle}>
          {mode === "login" ? "Login" : "Register"}
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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        {mode === "register" && (
          <>
            <div style={phoneRowStyle}>
              <input
                placeholder="+91"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, width: "110px" }}
              />
              <input
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
            </div>

            <input
              placeholder="Instagram ID (optional)"
              value={instagramId}
              onChange={(e) => setInstagramId(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error ? <div style={errorStyle}>{error}</div> : null}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={buttonStyle}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Login"
            : "Register"}
        </button>

        <p style={switchTextStyle}>
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <span
            style={switchLinkStyle}
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, #151515 0%, #090909 45%, #000000 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  position: "relative",
};

const topBarStyle: React.CSSProperties = {
  position: "absolute",
  top: "22px",
  right: "24px",
};

const topLinkStyle: React.CSSProperties = {
  color: "#f2c94c",
  cursor: "pointer",
  textDecoration: "underline",
  fontWeight: 600,
  fontSize: "0.95rem",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  background: "rgba(18, 18, 18, 0.92)",
  border: "1px solid rgba(255, 215, 0, 0.14)",
  borderRadius: "24px",
  padding: "32px 28px",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.55)",
  backdropFilter: "blur(10px)",
  textAlign: "center",
};

const logoStyle: React.CSSProperties = {
  width: "220px",
  maxWidth: "100%",
  margin: "0 auto 10px",
  display: "block",
};

const brandStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "2rem",
  fontWeight: 800,
  color: "#f4d06f",
  letterSpacing: "0.2px",
};

const subBrandStyle: React.CSSProperties = {
  marginTop: "6px",
  marginBottom: "22px",
  color: "#b8b8b8",
  fontSize: "0.98rem",
};

const titleStyle: React.CSSProperties = {
  marginBottom: "18px",
  color: "#ffffff",
  fontSize: "1.7rem",
  fontWeight: 800,
  textAlign: "left",
};

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

const phoneRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginBottom: "14px",
};

const buttonStyle: React.CSSProperties = {
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
};

const errorStyle: React.CSSProperties = {
  color: "#ff6b6b",
  fontSize: "0.92rem",
  marginBottom: "14px",
  textAlign: "left",
};

const switchTextStyle: React.CSSProperties = {
  marginTop: "18px",
  color: "#c8c8c8",
  fontSize: "0.96rem",
};

const switchLinkStyle: React.CSSProperties = {
  color: "#f2c94c",
  cursor: "pointer",
  fontWeight: 700,
};
