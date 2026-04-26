const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

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
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Cashfree order creation failed"
    );
  }

  return data;
}
