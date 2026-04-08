import axios from "axios";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

const CATEGORY_CACHE_PREFIX = "lightninbull:category:";
const CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000;

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
}

export interface StockCategoryResponse {
  category: string;
  stocks: Stock[];
}

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
    score: Number(stock.score ?? 0),
    return_1w: toNullableNumber(stock.return_1w),
    return_1m: toNullableNumber(stock.return_1m),
    return_3m: toNullableNumber(stock.return_3m),
    return_6m: toNullableNumber(stock.return_6m),
    volatility_6m: toNullableNumber(stock.volatility_6m),
    volatility_bucket:
      stock.volatility_bucket === undefined || stock.volatility_bucket === null
        ? null
        : String(stock.volatility_bucket),
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

export function getCachedStocksByCategory(
  category: string
): StockCategoryResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getCacheKey(category));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedCategoryPayload;

    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(getCacheKey(category));
      return null;
    }

    return normalizeResponse(parsed.data, category);
  } catch {
    return null;
  }
}

function setCachedStocksByCategory(
  category: string,
  data: StockCategoryResponse
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: CachedCategoryPayload = {
      expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
      data,
    };
    window.localStorage.setItem(getCacheKey(category), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearCategoryCache(category?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  if (category) {
    window.localStorage.removeItem(getCacheKey(category));
    return;
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(CATEGORY_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

export async function fetchStocksByCategory(
  category: string,
  forceRefresh = false
): Promise<StockCategoryResponse> {
  if (!forceRefresh) {
    const cached = getCachedStocksByCategory(category);
    if (cached) {
      return cached;
    }
  }

  const response = await axios.get(
    `${API_BASE_URL}/stocks/${encodeURIComponent(category)}`
  );

  const normalized = normalizeResponse(response.data, category);
  setCachedStocksByCategory(category, normalized);
  return normalized;
}
