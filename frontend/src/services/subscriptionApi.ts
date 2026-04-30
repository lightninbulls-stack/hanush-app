const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

export interface UserProfile {
  name: string;
  email: string;
  member_since: string;
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error("Failed to fetch user profile");
  return response.json();
}

export interface SubscriptionStatus {
  is_active: boolean;
  valid_till: string | null;
  days_left: number;
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}/cashfree/subscription/status`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch subscription status");
  }

  return response.json();
}

export async function createCashfreeOrder(): Promise<{
  payment_session_id: string;
  order_id: string;
}> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}/cashfree/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const detail = data?.detail;
    let message = "Cashfree order creation failed";

    if (typeof detail === "string") {
      message = detail;
    } else if (detail?.cashfree_error) {
      const cf = detail.cashfree_error;
      const cfMsg = cf?.message || cf?.error_description || JSON.stringify(cf);
      message = `Cashfree [${detail.cashfree_status}]: ${cfMsg}`;
    } else if (detail?.message) {
      message = detail.message;
    }

    throw new Error(message);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: verifyPayment
// Call this right after Cashfree redirects back to /payment-success.
// It asks our backend to confirm with Cashfree whether the order was paid,
// and if yes, activates the subscription immediately without waiting for webhook.
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyPayment(
  order_id: string
): Promise<SubscriptionStatus> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}/cashfree/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ order_id }),
  });

  if (!response.ok) {
    throw new Error("Payment verification failed");
  }

  return response.json();
}
