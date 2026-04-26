const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

export interface SubscriptionStatus {
  is_active: boolean;
  plan_amount: number;
  plan_days: number;
  valid_until?: string | null;
  razorpay_payment_id?: string | null;
}

export interface RazorpayOrderResponse {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  plan_amount_rupees: number;
  plan_days: number;
  name: string;
  email: string;
  phone: string;
}

export interface RazorpayVerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data?.detail || data?.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await fetch(`${API_BASE_URL}/payments/subscription/status`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return response.json();
}

export async function createRazorpayOrder(): Promise<RazorpayOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/payments/razorpay/order`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return response.json();
}

export async function verifyRazorpayPayment(
  payload: RazorpayVerifyPayload
): Promise<SubscriptionStatus> {
  const response = await fetch(`${API_BASE_URL}/payments/razorpay/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return response.json();
}
