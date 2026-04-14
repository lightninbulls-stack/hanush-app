import axios from "axios";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

const CATEGORY_CACHE_PREFIX = "lightninbull:category:";
const CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000;

const FRONTEND_CSV_CATEGORY_MAP: Record<string, string> = {
  "Aggressive Call Option Stocks": "/data/frontend_aggressive_calls.csv",
  "Aggressive Put Option Stocks": "/data/frontend_aggressive_puts.csv",
};

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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase()
  );

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = (values[index] ?? "").trim();
      });

      return row;
    })
    .filter((row) => Object.values(row).some(Boolean));
}

function normalizeCsvResponse(
  category: string,
  csvText: string
): StockCategoryResponse {
  const rows = parseCsvText(csvText);

  const stocks = rows
    .map((row) =>
      normalizeStock({
        rank: Number(row.rank ?? 0),
        symbol: row.ticker ?? row.symbol ?? "",
        sector: "Derivative Demand",
        score: toNullableNumber(row.strength) ?? 0,
        option_type: row.type ?? null,
        expiry: row.expiry ?? null,
        strike: toNullableNumber(row.strike),
        strength: toNullableNumber(row.strength),
        return_1w: null,
        return_1m: null,
        return_3m: null,
        return_6m: null,
        volatility_6m: null,
        volatility_bucket: null,
      })
    )
    .sort((a, b) => a.rank - b.rank);

  return {
    category,
    stocks,
  };
}

export function getCachedStocksByCategory(
  category: string
): StockCategoryResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (getFrontendCsvUrl(category)) {
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

  if (getFrontendCsvUrl(category)) {
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
    return normalizeCsvResponse(category, csvText);
  }

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
