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
  status?: string | null;
  entry_time?: string | null;
};

export type PnlPoint = {
  time: string;
  pnl: number;
  stop_loss?: number;
  target?: number;
  drawdown?: number;
};

export type StockSignalRow = {
  symbol: string;
  instrument_token: number;
  name?: string | null;
  signal_status: "WAITING" | "ENTERED" | "TARGET_HIT" | "STOP_LOSS_HIT" | string;
  paper_trade?: boolean;
  entry_time?: string | null;
  exit_time?: string | null;
  avg_price?: number | null;
  entry_price?: number | null;
  current_ltp?: number | null;
  target_price?: number | null;
  stop_loss_price?: number | null;
  exit_price?: number | null;
  exit_reason?: string | null;
  trade_status?: string | null;
  max_ltp?: number | null;
  min_ltp?: number | null;
  favorable_price?: number | null;
  points_captured?: number | null;
  pct_captured?: number | null;
  pnl_points?: number | null;
  pnl_pct?: number | null;
};

export type IntradaySpread = {
  index: string;
  spread_type: string;
  strategy_name: string;
  status: string;
  ui_state?: string;
  message?: string;
  progress_text?: string | null;
  is_loading?: boolean;
  net_pnl?: number;
  stop_loss?: number;
  target?: number;
  updated_at?: string;
  updated_at_ist?: string;
  entry_time?: string | null;
  legs?: SpreadLeg[];
  pnl_curve?: PnlPoint[];
  entered_count?: number;
  active_count?: number;
  exited_count?: number;
  target_hit_count?: number;
  stop_loss_hit_count?: number;
  total_count?: number;
  signals?: StockSignalRow[];
};

export type IntradaySpreadMap = Record<string, IntradaySpread>;

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";

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
