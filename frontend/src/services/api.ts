import axios from "axios";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

const CATEGORY_CACHE_PREFIX = "lightninbull:category:";
const CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000;

const FRONTEND_CSV_CATEGORY_MAP: Record<string, string> = {
  "Aggressive Call Option Stocks": "/data/frontend_aggressive_calls.csv",
  "Aggressive Put Option Stocks": "/data/frontend_aggressive_puts.csv",
};

// ================= TYPES =================

export interface Stock {
  rank: number;
  symbol: string;
  sector: string;
  score: number;
  return_1w?: number | null;
  return_1m?: number | null;
  return_3m?: number | null;
  return_6m?: number | null;
  volatility_6m?: number | null;
  volatility_bucket?: string | null;
  option_type?: string | null;
  expiry?: string | null;
  strike?: number | null;
  strength?: number | null;
}

export interface StockCategoryResponse {
  category: string;
  stocks: Stock[];
}

// ================= LOGIN TYPES =================

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// ================= LOGIN FUNCTION =================

export async function loginUser(
  phone: string,
  password: string
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: phone, // 🔥 PHONE = USERNAME
      password: password,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Login failed");
  }

  return response.json();
}

// ================= EXISTING CODE (UNCHANGED BELOW) =================

type CachedCategoryPayload = {
  expiresAt: number;
  data: StockCategoryResponse;
};

function toNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStock(stock: Partial<Stock>): Stock {
  return {
    rank: Number(stock.rank ?? 0),
    symbol: String(stock.symbol ?? "").trim().toUpperCase(),
    sector: String(stock.sector ?? "N/A"),
    score: Number(stock.score ?? stock.strength ?? 0),
    return_1w: toNullableNumber(stock.return_1w),
    return_1m: toNullableNumber(stock.return_1m),
    return_3m: toNullableNumber(stock.return_3m),
    return_6m: toNullableNumber(stock.return_6m),
    volatility_6m: toNullableNumber(stock.volatility_6m),
    volatility_bucket:
      stock.volatility_bucket === undefined || stock.volatility_bucket === null
        ? null
        : String(stock.volatility_bucket),
    option_type:
      stock.option_type === undefined || stock.option_type === null
        ? null
        : String(stock.option_type).trim().toUpperCase(),
    expiry:
      stock.expiry === undefined || stock.expiry === null
        ? null
        : String(stock.expiry).trim(),
    strike: toNullableNumber(stock.strike),
    strength: toNullableNumber(stock.strength ?? stock.score),
  };
}

function normalizeResponse(
  data: unknown,
  fallbackCategory: string
): StockCategoryResponse {
  const raw = (data ?? {}) as {
    category?: unknown;
    stocks?: Partial<Stock>[];
  };

  return {
    category: String(raw.category ?? fallbackCategory),
    stocks: Array.isArray(raw.stocks) ? raw.stocks.map(normalizeStock) : [],
  };
}

function getCacheKey(category: string): string {
  return `${CATEGORY_CACHE_PREFIX}${category.trim().toUpperCase()}`;
}

function getFrontendCsvUrl(category: string): string | null {
  return FRONTEND_CSV_CATEGORY_MAP[category] ?? null;
}

export async function fetchStocksByCategory(
  category: string,
  forceRefresh = false
): Promise<StockCategoryResponse> {
  const csvUrl = getFrontendCsvUrl(category);

  if (csvUrl) {
    const response = await fetch(`${csvUrl}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to load ${category} CSV`);
    }

    const csvText = await response.text();
    return normalizeResponse(csvText, category);
  }

  const response = await axios.get(
    `${API_BASE_URL}/stocks/${encodeURIComponent(category)}`
  );

  return normalizeResponse(response.data, category);
}
