import React from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://hanush-backend-service1.onrender.com";

// 👇 IMPORTANT for Cashfree
declare global {
  interface Window {
    Cashfree: any;
  }
}

const Pricing: React.FC = () => {

  const handlePayment = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/cashfree/create-order`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Order creation failed:", data);
        alert("Unable to create payment. Try again.");
        return;
      }

      const cashfree = window.Cashfree({
        mode: "production", // 👉 change to "sandbox" for testing
      });

      await cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self",
      });

    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment failed. Please try again.");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>⚡ Lightnin Bull Premium</h1>

      <div style={styles.card}>
        <h2>Pro Plan</h2>
        <p style={styles.price}>₹399 / 14 days</p>

        <ul style={styles.features}>
          <li>✔ Intraday Index Option Spreads</li>
          <li>✔ Intraday Stock Signals</li>
          <li>✔ AI Quant Dashboard</li>
          <li>✔ Portfolio Backtesting</li>
        </ul>

        <button style={styles.button} onClick={handlePayment}>
          🚀 Subscribe Now
        </button>
      </div>
    </div>
  );
};

export default Pricing;

const styles = {
  container: {
    background: "#000",
    color: "#fff",
    height: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: "30px",
    color: "#FFD700",
  },
  card: {
    background: "#111",
    padding: "30px",
    borderRadius: "10px",
    boxShadow: "0 0 20px rgba(255,215,0,0.3)",
    textAlign: "center" as const,
  },
  price: {
    fontSize: "24px",
    margin: "10px 0",
  },
  features: {
    listStyle: "none",
    padding: 0,
    marginBottom: "20px",
  },
  button: {
    background: "#FFD700",
    color: "#000",
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold" as const,
  },
};
