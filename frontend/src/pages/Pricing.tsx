import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createCashfreeOrder,
  fetchSubscriptionStatus,
  verifyPayment,
  type SubscriptionStatus,
} from "../services/subscriptionApi";

declare global {
  interface Window {
    Cashfree: any;
  }
}

/**
 * FIXED: Properly resolve mode as STRING (not boolean)
 */
const CASHFREE_MODE: "production" | "sandbox" =
  String(import.meta.env.VITE_CASHFREE_MODE || "").toLowerCase() === "production"
    ? "production"
    : "sandbox";

/**
 * Wait for Cashfree SDK
 */
function waitForCashfreeSDK(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.Cashfree === "function") {
      resolve();
      return;
    }

    const interval = setInterval(() => {
      if (typeof window.Cashfree === "function") {
        clearInterval(interval);
        resolve();
      }
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Cashfree SDK did not load. Please refresh and try again."));
    }, timeoutMs);
  });
}

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);

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
      setSubscription({ is_active: false, valid_till: null, days_left: 0 });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify payment instantly after redirect
   */
  useEffect(() => {
    if (orderId) {
      setVerifying(true);

      verifyPayment(orderId)
        .then((status) => {
          setSubscription(status);
        })
        .catch(() => {
          loadSubscription();
        })
        .finally(() => {
          setVerifying(false);
          setLoading(false);
        });
    } else {
      loadSubscription();
    }
  }, []); // eslint-disable-line

  /**
   * Auto redirect after success
   */
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

      await waitForCashfreeSDK();

      const data = await createCashfreeOrder();

      if (!data.payment_session_id) {
        alert("Payment session not received. Please try again.");
        return;
      }

      const cashfree = new window.Cashfree({
        mode: CASHFREE_MODE,
      });

      await cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self",
        returnUrl: `https://lightninbull.com/payment-success?order_id=${data.order_id}`,
      });

    } catch (error: any) {
      console.error("Payment error:", error);
      alert(error?.message || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading || verifying) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          {verifying
            ? "⏳ Verifying your payment, please wait..."
            : "Checking your subscription..."}
        </div>
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
              <p style={styles.text}>Your premium access is active.</p>
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
                Payment could not be confirmed yet. Please refresh after a few seconds.
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

            <p style={styles.modeText}>
              Payment Mode: {CASHFREE_MODE.toUpperCase()}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Pricing;
