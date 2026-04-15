export type SpreadLeg = {
  side: string | null;
  trading_symbol: string | null;
  avg_price: number | null;
  ltp: number | null;
  pnl: number | null;
  quantity: number | null;
  strike?: number | null;
  expiry?: string | null;
  right?: string | null;
};

export type IntradaySpread = {
  index: string;
  spread_type: "bull_call" | "bear_put" | string;
  strategy_name: string;
  status: "OPEN" | "CLOSED" | "NO_POSITION" | string;
  net_pnl: number;
  stop_loss: number;
  target: number;
  updated_at: string;
  legs: SpreadLeg[];
};

export type IntradaySpreadMap = Record<string, IntradaySpread>;

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";

export async function fetchAllIntradaySpreads(): Promise<IntradaySpreadMap> {
  const url = `${API_BASE}/api/intraday-spreads/all`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch intraday spreads: ${response.status}`);
  }

  const json = await response.json();
  return (json?.data || {}) as IntradaySpreadMap;
}
