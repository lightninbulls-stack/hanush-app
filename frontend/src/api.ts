import axios from "axios";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterResponse {
  message?: string;
  detail?: string;
  [key: string]: unknown;
}

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ✅ FIXED interceptor (no TS error)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  return config;
});

// 🔥 FIXED LOGIN (THIS WAS YOUR BUG)
export async function loginUser(
  phone: string,
  password: string
): Promise<LoginResponse> {
  const cleanPhone = phone.trim();

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: cleanPhone,
      phone: cleanPhone,   // ✅ REQUIRED by backend
      password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Login failed");
  }

  return response.json();
}

// ✅ REGISTER
export async function registerUser(
  payload: RegisterPayload
): Promise<RegisterResponse> {
  const cleanPhone = payload.phone.trim();

  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: cleanPhone,
      username: cleanPhone,
      password: payload.password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Registration failed");
  }

  return response.json();
}

// TOKEN HELPERS
export function saveAuthToken(token: string): void {
  localStorage.setItem("token", token);
}

export function clearAuthToken(): void {
  localStorage.removeItem("token");
}

export function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

export default api;
