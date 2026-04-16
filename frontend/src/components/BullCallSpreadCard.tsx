import React from "react";

type Leg = {
  side?: string | null;
  trading_symbol?: string | null;
  avg_price?: number | null;
  ltp?: number | null;
  pnl?: number | null;
  quantity?: number | null;
  strike?: number | null;
  expiry?: string | null;
  right?: string | null;
  status?: string | null;
};

type SpreadState = {
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
  legs?: Leg[];
};

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2);
}

function isWaitingState(uiState?: string): boolean {
  return [
    "BOOTING",
    "WAITING_START_TIME",
    "LOADING_HISTORY",
    "WAITING_SIGNAL",
    "SIGNAL_TRIGGERED",
    "ENTERING_SPREAD",
  ].includes(uiState || "");
}

function LoaderCard({ data }: { data: SpreadState }) {
  return (
    <div className="glass-card" style={{ padding: "32px", margin: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <div className="signal-loader-wrap">
          <div className="signal-loader-ring"></div>
          <div className="signal-loader-core"></div>
        </div>

        <div>
          <h2 className="glow-text" style={{ marginBottom: "8px" }}>
            {data.ui_state === "BOOTING" && "Booting strategy"}
            {data.ui_state === "WAITING_START_TIME" && "Waiting for start time"}
            {data.ui_state === "LOADING_HISTORY" && "Loading historical data"}
            {data.ui_state === "WAITING_SIGNAL" && "Waiting for signal"}
            {data.ui_state === "SIGNAL_TRIGGERED" && "Signal detected"}
            {data.ui_state === "ENTERING_SPREAD" && "Creating spread"}
          </h2>

          <p style={{ color: "var(--text-dim)", marginBottom: "8px" }}>
            {data.message || "Strategy is running..."}
          </p>

          {data.progress_text ? (
            <p style={{ color: "var(--primary-gold)", fontSize: "14px" }}>
              {data.progress_text}
            </p>
          ) : null}
        </div>
      </div>

      <div className="loading-track" style={{ marginTop: "24px" }}>
        <div className="loading-bar"></div>
      </div>
    </div>
  );
}

function LiveSpreadCard({ data }: { data: SpreadState }) {
  const buyLeg = data.legs?.find((leg) => leg.side === "BUY");
  const sellLeg = data.legs?.find((leg) => leg.side === "SELL");

  return (
    <div className="glass-card" style={{ padding: "32px", margin: "32px" }}>
      <h2 className="glow-text">Bull Call Spreads</h2>
      <p style={{ color: "var(--text-dim)", marginTop: "10px" }}>
        {data.message || "Live intraday index bull call spread trades."}
      </p>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "24px" }}>
        <div className="metric-chip">Status: {data.status}</div>
        <div className="metric-chip">Net PnL: ₹ {formatNumber(data.net_pnl)}</div>
        <div className="metric-chip">SL: ₹ {formatNumber(data.stop_loss)}</div>
        <div className="metric-chip">Target: ₹ {formatNumber(data.target)}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginTop: "28px" }}>
        <div className="leg-card">
          <h3>BUY Leg</h3>
          <p>Symbol: {buyLeg?.trading_symbol || "--"}</p>
          <p>Strike: {buyLeg?.strike ?? "--"}</p>
          <p>Expiry: {buyLeg?.expiry || "--"}</p>
          <p>Avg Price: {formatNumber(buyLeg?.avg_price)}</p>
          <p>LTP: {formatNumber(buyLeg?.ltp)}</p>
          <p>PnL: {formatNumber(buyLeg?.pnl)}</p>
          <p>Qty: {buyLeg?.quantity ?? "--"}</p>
        </div>

        <div className="leg-card">
          <h3>SELL Leg</h3>
          <p>Symbol: {sellLeg?.trading_symbol || "--"}</p>
          <p>Strike: {sellLeg?.strike ?? "--"}</p>
          <p>Expiry: {sellLeg?.expiry || "--"}</p>
          <p>Avg Price: {formatNumber(sellLeg?.avg_price)}</p>
          <p>LTP: {formatNumber(sellLeg?.ltp)}</p>
          <p>PnL: {formatNumber(sellLeg?.pnl)}</p>
          <p>Qty: {sellLeg?.quantity ?? "--"}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="glass-card" style={{ padding: "32px", margin: "32px" }}>
      <h2 className="glow-text">Bull Call Spreads</h2>
      <p style={{ color: "var(--text-dim)", marginTop: "12px" }}>
        No live bull call spreads available.
      </p>
    </div>
  );
}

export default function BullCallSpreadCard({ data }: { data?: SpreadState | null }) {
  if (!data) return <EmptyCard />;
  if (isWaitingState(data.ui_state)) return <LoaderCard data={data} />;
  if (data.legs && data.legs.length > 0) return <LiveSpreadCard data={data} />;
  return <EmptyCard />;
}
