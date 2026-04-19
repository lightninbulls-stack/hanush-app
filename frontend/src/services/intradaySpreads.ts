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
