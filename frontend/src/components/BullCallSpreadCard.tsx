import React, { useMemo } from "react";
import BullCallSpreadDashboard from "./BullCallSpreadDashboard";
import type { PnlPoint } from "./SnakePnlChart";

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
  entry_time?: string | null;
};

type PnlHistoryItem = {
  time?: string | null;
  timestamp?: string | null;
  pnl?: number | null;
  value?: number | null;
};

type SpreadState = {
  index?: string;
  spread_type?: string;
  strategy_name?: string;
  status?: string;
  ui_state?: string;
  message?: string;
  progress_text?: string | null;
  is_loading?: boolean;
  net_pnl?: number | null;
  stop_loss?: number | null;
  target?: number | null;
  updated_at?: string | null;
  entry_time?: string | null;
  legs?: Leg[];
  pnl_series?: PnlHistoryItem[];
  pnl_history?: PnlHistoryItem[];
};

function formatStatus(status?: string | null): "OPEN" | "CLOSED" {
  return status === "OPEN" ? "OPEN" : "CLOSED";
}

function formatNumber(value?: number | null, fallback = 0): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return Number(value);
}

function formatText(value?: string | null, fallback = "--"): string {
  return value && value.trim() ? value : fallback;
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

export default function BullCallSpreadCard({
  data,
}: {
  data?: SpreadState | null;
}) {
  const mappedLegs = useMemo(() => {
    return (data?.legs ?? []).map((leg) => ({
      side: leg.side === "BUY" ? "BUY" as const : "SELL" as const,
      symbol: formatText(leg.trading_symbol),
      entryTime: formatText(leg.entry_time ?? data?.entry_time ?? data?.updated_at),
      avg: formatNumber(leg.avg_price),
      ltp: formatNumber(leg.ltp),
      pnl: formatNumber(leg.pnl),
    }));
  }, [data]);

  const pnlSeries = useMemo<PnlPoint[]>(() => {
    const rawSeries = data?.pnl_series ?? data?.pnl_history ?? [];

    const mapped = rawSeries
      .map((item) => ({
        time: formatText(item.time ?? item.timestamp, ""),
        value: formatNumber(
          item.value !== null && item.value !== undefined ? item.value : item.pnl,
          NaN
        ),
      }))
      .filter((item) => item.time !== "" && !Number.isNaN(item.value));

    return mapped.slice(-80);
  }, [data]);

  if (!data) return <EmptyCard />;
  if (isWaitingState(data.ui_state)) return <LoaderCard data={data} />;
  if (!data.legs || data.legs.length === 0) return <EmptyCard />;

  return (
    <BullCallSpreadDashboard
      strategyName={formatText(data.strategy_name, "Bull Call Spreads")}
      algoName={`${formatText(data.index, "INDEX")} • ${formatText(data.spread_type, "BULL_CALL_SPREAD")}`}
      status={formatStatus(data.status)}
      netPnl={formatNumber(data.net_pnl)}
      stopLoss={formatNumber(data.stop_loss)}
      target={formatNumber(data.target)}
      updatedAt={formatText(data.updated_at)}
      entryTime={formatText(data.entry_time ?? data.updated_at)}
      legs={mappedLegs}
      pnlSeries={pnlSeries}
    />
  );
}
