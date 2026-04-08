import axios from "axios";

const RENDER_API_URL = (
  import.meta.env.VITE_API_URL || "https://hanush-backend-service.onrender.com"
).replace(/\/+$/, "");

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
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchWatchlistSymbols(): Promise<string[]> {
  const response = await axios.get("/api/watchlist", {
    headers: getAuthHeaders(),
  });
  return response.data?.symbols || [];
}

export async function addWatchlistSymbol(symbol: string): Promise<string[]> {
  const response = await axios.post(
    "/api/watchlist",
    { symbol },
    { headers: getAuthHeaders() }
  );
  return response.data?.symbols || [];
}

export async function removeWatchlistSymbol(symbol: string): Promise<string[]> {
  const response = await axios.delete(
    `/api/watchlist/${encodeURIComponent(symbol)}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data?.symbols || [];
}

export async function runWatchlistBacktest(
  symbols: string[]
): Promise<PortfolioBacktestResponse> {
  const response = await axios.post(
    `${RENDER_API_URL}/portfolio/backtest/watchlist`,
    { symbols }
  );
  return response.data;
}
