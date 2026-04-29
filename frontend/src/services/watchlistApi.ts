import axios from "axios";

const RENDER_API_URL = (
  import.meta.env.VITE_API_URL || "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

const WATCHLIST_STORAGE_KEY = "starredStocks";
const MAX_WATCHLIST_SYMBOLS = 50;
export const WATCHLIST_UPDATED_EVENT = "lightninbull:watchlist-updated";
export const WATCHLIST_MAX_SYMBOLS = MAX_WATCHLIST_SYMBOLS;

export interface PortfolioMetrics {
  annualised_return_pct?: number | null;
  total_return_pct?: number | null;
  sharpe_ratio?: number | null;
  sortino_ratio?: number | null;
  volatility_pct?: number | null;
  max_drawdown_pct?: number | null;

  return_1w_pct?: number | null;
  return_2w_pct?: number | null;
  return_1m_pct?: number | null;
  return_3m_pct?: number | null;
  return_6m_pct?: number | null;
  var_95_pct?: number | null;

  beta_to_benchmark?: number | null;
  correlation_to_benchmark?: number | null;

  cumulative_return_pct?: number | null;
  cagr_pct?: number | null;
  annualized_volatility_pct?: number | null;
  sharpe?: number | null;
}

export interface BenchmarkMetrics {
  annualised_return_pct?: number | null;
  total_return_pct?: number | null;
  sharpe_ratio?: number | null;
  sortino_ratio?: number | null;
  volatility_pct?: number | null;
  max_drawdown_pct?: number | null;

  return_1w_pct?: number | null;
  return_2w_pct?: number | null;
  return_1m_pct?: number | null;
  return_3m_pct?: number | null;
  return_6m_pct?: number | null;
  var_95_pct?: number | null;

  cumulative_return_pct?: number | null;
  cagr_pct?: number | null;
  annualized_volatility_pct?: number | null;
  sharpe?: number | null;
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

  allocation_amount?: number | null;
  suggested_quantity?: number | null;
  actual_invested_amount?: number | null;
  remaining_cash?: number | null;
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

function limitWatchlistSymbols(symbols: string[]): string[] {
  return symbols.slice(0, MAX_WATCHLIST_SYMBOLS);
}

function broadcastWatchlistUpdate(symbols: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(WATCHLIST_UPDATED_EVENT, {
      detail: {
        symbols: symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean),
        maxSymbols: MAX_WATCHLIST_SYMBOLS,
      },
    })
  );
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

    return limitWatchlistSymbols(
      parsed.map((symbol) => normalizeSymbol(String(symbol))).filter(Boolean)
    );
  } catch {
    return [];
  }
}

function writeWatchlistToStorage(symbols: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const uniqueSymbols = limitWatchlistSymbols(
    Array.from(
      new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean))
    )
  );

  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(uniqueSymbols));
  broadcastWatchlistUpdate(uniqueSymbols);
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

  if (!existing.includes(normalized) && existing.length >= MAX_WATCHLIST_SYMBOLS) {
    writeWatchlistToStorage(existing);
    return existing;
  }

  const updated = Array.from(new Set([...existing, normalized]));
  writeWatchlistToStorage(updated);

  return limitWatchlistSymbols(updated);
}

export async function addWatchlistSymbols(symbols: string[]): Promise<string[]> {
  const normalized = symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean);
  const existing = readWatchlistFromStorage();

  const updated = Array.from(new Set([...existing, ...normalized]));
  writeWatchlistToStorage(updated);

  return limitWatchlistSymbols(updated);
}

export async function removeWatchlistSymbol(symbol: string): Promise<string[]> {
  const normalized = normalizeSymbol(symbol);
  const existing = readWatchlistFromStorage();

  const updated = existing.filter((item) => item !== normalized);
  writeWatchlistToStorage(updated);

  return updated;
}

export async function removeWatchlistSymbols(symbols: string[]): Promise<string[]> {
  const removeSet = new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean));
  const existing = readWatchlistFromStorage();

  const updated = existing.filter((item) => !removeSet.has(item));
  writeWatchlistToStorage(updated);

  return updated;
}

export async function clearWatchlistSymbols(): Promise<string[]> {
  writeWatchlistToStorage([]);
  return [];
}

export async function runWatchlistBacktest(
  symbols: string[],
  strategyType: "equal_weight" | "mvo" | "mvo_short" = "equal_weight"
): Promise<PortfolioBacktestResponse> {
  const response = await axios.post(`${RENDER_API_URL}/portfolio/backtest/watchlist`, {
    symbols: limitWatchlistSymbols(symbols),
    strategy_type: strategyType,
  });

  return response.data;
}
