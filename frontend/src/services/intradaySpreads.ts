export type SpreadLeg = {
  side: string | null;
  trading_symbol: string | null;
  avg_price: number | null;
  ltp: number | null;
  pnl: number | null;
  quantity?: number | null;
  strike?: number | null;
  expiry?: string | null;
  right?: string | null;
  status?: string | null;
  entry_time?: string | null;
};

export type PnlCurvePoint = {
  time: string;
  pnl: number;
  stop_loss?: number;
  target?: number;
  drawdown?: number;
};

export type IntradaySpread = {
  index: string;
  spread_type: string;
  strategy_name: string;
  status: string;
  ui_state?: string;
  message?: string | null;
  progress_text?: string | null;
  is_loading?: boolean;
  updated_at?: string | null;
  net_pnl: number;
  stop_loss: number;
  target: number;
  legs: SpreadLeg[];
  entry_time?: string | null;
  entry_marker_time?: string | null;
  pnl_curve?: PnlCurvePoint[];
};

type IntradaySpreadsResponse = {
  status: string;
  data: Record<string, IntradaySpread>;
};

export async function fetchAllIntradaySpreads(): Promise<
  Record<string, IntradaySpread>
> {
  const response = await fetch("/intraday-spreads/all", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch intraday spreads: ${response.status}`);
  }

  const payload: IntradaySpreadsResponse = await response.json();

  if (payload.status !== "ok" || !payload.data) {
    return {};
  }

  return payload.data;
}
