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
    return "#22c55e";
  }
  if (value < 0) {
    return "#ef4444";
  }
  return "#e5e7eb";
}

function getStatusColor(status: string): string {
  if (status === "OPEN") return "#22c55e";
  if (status === "CLOSED") return "#ef4444";
  if (status === "STOPPED") return "#94a3b8";
  return "#94a3b8";
}

function getSpreadTitle(spread: IntradaySpread): string {
  if (spread.spread_type === "bull_call") {
    return `${spread.index} Call Debit Spread`;
  }

  if (spread.spread_type === "bear_put") {
    return `${spread.index} Put Debit Spread`;
  }

  return `${spread.index} Intraday Spread`;
}

function SpreadLegRow({ leg }: { leg: SpreadLeg }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1.8fr 1fr 1fr 1fr",
        gap: "12px",
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: "14px",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: leg.side === "BUY" ? "#22c55e" : "#ef4444",
        }}
      >
        {leg.side || "--"}
      </div>

      <div style={{ color: "#f8fafc", fontWeight: 600 }}>
        <div>{leg.trading_symbol || "--"}</div>
        <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
          Entry: {leg.entry_time ?? "--"}
        </div>
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
  const title = getSpreadTitle(spread);

  return (
    <div
      style={{
        borderRadius: "20px",
        padding: "20px",
        background: "#000000",
        border: "1px solid rgba(255,215,0,0.10)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "18px",
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

      <div style={{ display: "grid", gap: "12px" }}>
        {spread.legs?.map((leg, idx) => (
          <SpreadLegRow key={`${spread.strategy_name}-${idx}`} leg={leg} />
        ))}
      </div>

      <div
        style={{
          marginTop: "18px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          color: "#cbd5e1",
          fontSize: "13px",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          Stop Loss: {formatNumber(spread.stop_loss)}
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          Target: {formatNumber(spread.target)}
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          Entry Time: {spread.entry_time ?? "--"}
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          Updated:{" "}
          {spread.updated_at
            ? new Date(spread.updated_at).toLocaleTimeString()
            : "--"}
        </div>
      </div>
    </div>
  );
};

export default IntradaySpreadCard;
