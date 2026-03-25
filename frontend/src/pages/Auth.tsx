import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

export default function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");

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
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
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

        <h1 style={brandStyle}>Lightninbull</h1>
        <p style={subBrandStyle}>Financial Analytics</p>

        <h2 style={titleStyle}>
          {mode === "login" ? "Login to your account" : "Create your account"}
        </h2>

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
                style={{ ...inputStyle, marginBottom: 0, flex: "0 0 110px" }}
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
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={switchLinkStyle}
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
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  background: "rgba(20,20,20,0.92)",
  border: "1px solid rgba(255,215,0,0.18)",
  borderRadius: "22px",
  padding: "32px 28px",
  boxShadow: "0 20px
