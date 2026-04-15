import React from "react";
import type { IntradaySpread, SpreadLeg } from "../services/intradaySpreads";

type Props = {
  spread: IntradaySpread;
};

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2);
}

function getPnlColor(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "#94a3b8";
  }
  if (value > 0) {
    return "#16a34a";
  }
  if (value < 0) {
    return "#dc2626";
  }
  return "#e5e7eb";
}

function getStatusColor(status: string): string {
  if (status === "OPEN") return "#16a34a";
  if (status === "CLOSED") return "#dc2626";
  return "#94a3b8";
}

function SpreadLegRow({ leg }: { leg: SpreadLeg }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1.8fr 1fr 1fr 1fr",
        gap: "12px",
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: "14px",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: leg.side === "BUY" ? "#22c55e" : "#f59e0b",
        }}
      >
        {leg.side || "--"}
      </div>

      <div style={{ color: "#f8fafc", fontWeight: 600 }}>
        {leg.trading_symbol || "--"}
      </div>

      <div style={{ color: "#cbd5e1" }}>
        Avg: {formatNumber(leg.avg_price)}
      </div>

      <div style={{ color: "#cbd5e1" }}>
        LTP: {formatNumber(leg.ltp)}
      </div>

      <div
        style={{
          color: getPnlColor(leg.pnl),
          fontWeight: 700,
        }}
      >
        PnL: {formatNumber(leg.pnl)}
      </div>
    </div>
  );
}

const IntradaySpreadCard: React.FC<Props> = ({ spread }) => {
  const title =
    spread.spread_type === "bull_call"
      ? `${spread.index} Bull Call Spread`
      : `${spread.index} Bear Put Spread`;

  return (
    <div
      style={{
        borderRadius: "18px",
        padding: "18px",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(30,41,59,0.92))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#f8fafc",
              marginBottom: "6px",
            }}
          >
            {title}
          </div>
          <div style={{ color: "#94a3b8", fontSize: "13px" }}>
            {spread.strategy_name}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: getStatusColor(spread.status),
              marginBottom: "6px",
            }}
          >
            {spread.status}
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: getPnlColor(spread.net_pnl),
            }}
          >
            ₹ {formatNumber(spread.net_pnl)}
          </div>
          <div style={{ color: "#94a3b8", fontSize: "12px" }}>Net PnL</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {spread.legs?.map((leg, idx) => (
          <SpreadLegRow key={`${spread.strategy_name}-${idx}`} leg={leg} />
        ))}
      </div>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          color: "#cbd5e1",
          fontSize: "13px",
        }}
      >
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Stop Loss: {formatNumber(spread.stop_loss)}
        </div>
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Target: {formatNumber(spread.target)}
        </div>
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Updated: {spread.updated_at ? new Date(spread.updated_at).toLocaleTimeString() : "--"}
        </div>
      </div>
    </div>
  );
};

export default IntradaySpreadCard;
