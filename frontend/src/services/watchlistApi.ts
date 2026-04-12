import axios from "axios";

const RENDER_API_URL = (
  import.meta.env.VITE_API_URL || "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

const WATCHLIST_STORAGE_KEY = "starredStocks";

export interface PortfolioMetrics {
  cumulative_return_pct: number;
  cagr_pct: number;
  annualized_volatility_pct: number;
  sharpe: number;
  max_drawdown_pct: number;
  return_1w_pct?: number | null;
  return_1m_pct?: number | null;
  return_3m_pct?: number | null;
  return_6m_pct?: number | null;
  var_95_pct?: number | null;
  beta_to_benchmark?: number | null;
  correlation_to_benchmark?: number | null;
}

export interface BenchmarkMetrics {
  cumulative_return_pct: number;
  cagr_pct: number;
  annualized_volatility_pct: number;
  sharpe: number;
  max_drawdown_pct: number;
  return_1w_pct?: number | null;
  return_1m_pct?: number | null;
  return_3m_pct?: number | null;
  return_6m_pct?: number | null;
  var_95_pct?: number | null;
}

export interface PortfolioPoint {
  date: string;
  nav: number;
}

export interface PortfolioHolding {
  symbol: string;
  weight: number;
  start_price: number;
  end_price: number;
  total_return_pct: number;
}

export interface PortfolioBacktestResponse {
  requested_symbols: string[];
  matched_symbols: string[];
  metrics: PortfolioMetrics;
  curve: PortfolioPoint[];
  holdings: PortfolioHolding[];
  benchmark_name?: string | null;
  benchmark_metrics?: BenchmarkMetrics | null;
  benchmark_curve?: PortfolioPoint[] | null;
}

function normalizeSymbol(symbol: string): string {
  return String(symbol || "").trim().toUpperCase();
}

function readWatchlistFromStorage(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((symbol) => normalizeSymbol(String(symbol)))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeWatchlistToStorage(symbols: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const uniqueSymbols = Array.from(
    new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean))
  );

  window.localStorage.setItem(
    WATCHLIST_STORAGE_KEY,
    JSON.stringify(uniqueSymbols)
  );
}

export async function fetchWatchlistSymbols(): Promise<string[]> {
  return readWatchlistFromStorage();
}

export async function addWatchlistSymbol(symbol: string): Promise<string[]> {
  const normalized = normalizeSymbol(symbol);
  const existing = readWatchlistFromStorage();

  if (!normalized) {
    return existing;
  }

  const updated = Array.from(new Set([...existing, normalized]));
  writeWatchlistToStorage(updated);
  return updated;
}

export async function removeWatchlistSymbol(symbol: string): Promise<string[]> {
  const normalized = normalizeSymbol(symbol);
  const existing = readWatchlistFromStorage();

  const updated = existing.filter((item) => item !== normalized);
  writeWatchlistToStorage(updated);
  return updated;
}

export async function runWatchlistBacktest(
  symbols: string[],
  strategyType: "equal_weight" | "mvo" | "mvo_short" = "equal_weight"
): Promise<PortfolioBacktestResponse> {
  const response = await axios.post(
    `${RENDER_API_URL}/portfolio/backtest/watchlist`,
    {
      symbols,
      strategy_type: strategyType,
    }
  );
  return response.data;
}
