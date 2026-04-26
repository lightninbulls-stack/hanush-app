import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createCashfreeOrder,
  fetchSubscriptionStatus,
  type SubscriptionStatus,
} from "../services/subscriptionApi";

declare global {
  interface Window {
    Cashfree: any;
  }
}

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const orderId = searchParams.get("order_id");

  const validTillText = useMemo(() => {
    if (!subscription?.valid_till) return "";

    return new Date(subscription.valid_till).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [subscription]);

  const loadSubscription = async () => {
    try {
      const status = await fetchSubscriptionStatus();
      setSubscription(status);
    } catch {
      setSubscription({
        is_active: false,
        valid_till: null,
        days_left: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  useEffect(() => {
    if (orderId) {
      const timer = window.setTimeout(() => {
        loadSubscription();
      }, 2500);

      return () => window.clearTimeout(timer);
    }
  }, [orderId]);

  useEffect(() => {
    if (subscription?.is_active && orderId) {
      const timer = window.setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);

      return () => window.clearTimeout(timer);
    }
  }, [subscription, orderId, navigate]);

  const handlePayment = async () => {
    try {
      setPaying(true);

      const data = await createCashfreeOrder();

      if (!data.payment_session_id) {
        alert("Payment session not received. Please try again.");
        return;
      }

      const cashfree = window.Cashfree({
        mode: "production",
      });

      await cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self",
      });
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>Checking your subscription...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>LIGHTNIN BULL PREMIUM</div>

        <h1 style={styles.title}>AI Quant Fund Manager</h1>

        <p style={styles.subtitle}>
          Unlock premium quantitative stock signals, intraday option spreads,
          portfolio backtesting, and AI-powered dashboard insights.
        </p>

        {subscription?.is_active ? (
          <>
            <div style={styles.successBox}>
              <h2 style={styles.successTitle}>✅ Already Subscribed</h2>
              <p style={styles.text}>
                Your premium access is active.
              </p>

              <p style={styles.expiry}>
                Valid till: <strong>{validTillText}</strong>
              </p>

              <p style={styles.expiry}>
                Days left: <strong>{subscription.days_left}</strong>
              </p>
            </div>

            <button
              style={styles.button}
              onClick={() => navigate("/dashboard", { replace: true })}
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            {orderId && (
              <div style={styles.warningBox}>
                Payment is being verified. If you already paid, refresh after a
                few seconds.
              </div>
            )}

            <div style={styles.priceBox}>
              <span style={styles.price}>₹399</span>
              <span style={styles.duration}> / 14 days</span>
            </div>

            <ul style={styles.features}>
              <li>✔ Intraday Index Option Spreads</li>
              <li>✔ Intraday Stock Signals</li>
              <li>✔ AI Quant Dashboard</li>
              <li>✔ Portfolio Backtesting</li>
              <li>✔ Premium Watchlist Insights</li>
            </ul>

            <button
              style={{
                ...styles.button,
                opacity: paying ? 0.7 : 1,
                cursor: paying ? "not-allowed" : "pointer",
              }}
              onClick={handlePayment}
              disabled={paying}
            >
              {paying ? "Opening Payment..." : "Subscribe Now"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Pricing;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(226,184,75,0.16), transparent 35%), #000",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    background: "rgba(12,12,12,0.95)",
    border: "1px solid rgba(226,184,75,0.35)",
    borderRadius: 22,
    padding: 32,
    boxShadow: "0 0 40px rgba(226,184,75,0.14)",
    textAlign: "center",
  },
  badge: {
    color: "#e2b84b",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 14,
    fontWeight: 700,
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: 36,
    lineHeight: 1.1,
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    lineHeight: 1.7,
    marginTop: 16,
  },
  priceBox: {
    margin: "28px 0 20px",
  },
  price: {
    color: "#e2b84b",
    fontSize: 44,
    fontWeight: 800,
  },
  duration: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 16,
  },
  features: {
    listStyle: "none",
    padding: 0,
    margin: "24px 0",
    textAlign: "left",
    color: "rgba(255,255,255,0.78)",
    lineHeight: 2,
  },
  button: {
    width: "100%",
    background: "#e2b84b",
    color: "#000",
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontSize: 15,
    fontWeight: 800,
  },
  successBox: {
    margin: "28px 0",
    padding: 20,
    borderRadius: 16,
    background: "rgba(0, 180, 90, 0.12)",
    border: "1px solid rgba(0, 255, 150, 0.25)",
  },
  successTitle: {
    margin: "0 0 10px",
    color: "#66ffb2",
  },
  text: {
    color: "rgba(255,255,255,0.72)",
  },
  expiry: {
    color: "rgba(255,255,255,0.78)",
    margin: "8px 0",
  },
  warningBox: {
    margin: "24px 0 8px",
    padding: 14,
    borderRadius: 14,
    background: "rgba(226,184,75,0.12)",
    border: "1px solid rgba(226,184,75,0.28)",
    color: "#e2b84b",
    fontSize: 13,
  },
};
