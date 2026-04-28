import React, { useEffect, useMemo, useState } from "react";
import IntradaySpreadCard from "./IntradaySpreadCard";
import {
  fetchAllIntradaySpreads,
  type IntradaySpread,
} from "../services/intradaySpreads";

type Props = {
  spreadType: "bull_call" | "put_debit";
};

const emptyMessageMap: Record<Props["spreadType"], string> = {
  bull_call: "No live call debit spreads available.",
  put_debit:  "No live put debit spreads available.",
};

const titleMap: Record<Props["spreadType"], string> = {
  bull_call: "Call Debit Spreads",
  put_debit:  "Put Debit Spreads",
};

const subtitleMap: Record<Props["spreadType"], string> = {
  bull_call: "Live intraday index call debit spread trades with MTM.",
  put_debit:  "Live intraday index put debit spread trades with MTM.",
};

const waitingTitleMap: Record<Props["spreadType"], string> = {
  bull_call: "Bull Call Spreads",
  put_debit:  "Bear Put Spreads",
};

const waitingStates = new Set([
  "BOOTING",
  "WAITING_START_TIME",
  "LOADING_HISTORY",
  "WAITING_SIGNAL",
  "SIGNAL_TRIGGERED",
  "ENTERING_SPREAD",
]);

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `₹${value.toFixed(2)}`;
};

const getProgressWidth = (state?: string) => {
  switch (state) {
    case "BOOTING":           return "12%";
    case "WAITING_START_TIME": return "18%";
    case "LOADING_HISTORY":   return "35%";
    case "WAITING_SIGNAL":    return "52%";
    case "SIGNAL_TRIGGERED":  return "72%";
    case "ENTERING_SPREAD":   return "88%";
    default:                  return "25%";
  }
};

const getProgressActive = (spread: IntradaySpread) => {
  const state = spread.ui_state || spread.status || "";
  return (
    state === "WAITING_SIGNAL" ||
    state === "SIGNAL_TRIGGERED" ||
    state === "ENTERING_SPREAD" ||
    String(spread.message || "").toLowerCase().includes("live")
  );
};

/* ── Waiting card ───────────────────────────────────────────────────────── */
const WaitingSpreadCard: React.FC<{
  spread: IntradaySpread;
  spreadType: Props["spreadType"];
}> = ({ spread, spreadType }) => {
  const progressWidth = getProgressWidth(spread.ui_state || spread.status);
  const cardTitle     = waitingTitleMap[spreadType];
  const isAnimated    = getProgressActive(spread);

  return (
    <div
      style={{
        marginBottom: 14,
        borderRadius: 20,
        padding: 24,
        background:
          "linear-gradient(135deg, rgba(8,8,8,0.99), rgba(12,18,30,0.96))",
        border: "1px solid rgba(250,204,21,0.14)",
        boxShadow: "0 10px 35px rgba(0,0,0,0.45)",
      }}
    >
      <style>{`
        @keyframes lb-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes lb-shimmer { 0%{transform:translateX(-120%)} 100%{transform:translateX(220%)} }
        @keyframes lb-pulse-text {
          0%,100%{opacity:0.65}
          50%{opacity:1;text-shadow:0 0 14px rgba(250,204,21,0.45)}
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        {/* Spinner */}
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "4px solid rgba(250,204,21,0.15)",
              borderTopColor: "#facc15",
              borderLeftColor: "#d97706",
              animation: isAnimated ? "lb-spin 1.3s linear infinite" : "none",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(30,30,30,0.95) 35%, rgba(8,8,8,1) 75%)",
            }}
          />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: 24,
              fontWeight: 300,
              color: "#f7f0df",
              lineHeight: 1.1,
            }}
          >
            {cardTitle}
          </h2>

          <p
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--font-mono)",
              color: "#d1d5db",
              fontSize: 13,
            }}
          >
            {spread.message || "Waiting for strategy state update."}
          </p>

          {spread.progress_text && (
            <p
              style={{
                margin: "8px 0 0",
                fontFamily: "var(--font-mono)",
                color: "#facc15",
                fontSize: 12,
                animation: isAnimated
                  ? "lb-pulse-text 1.5s ease-in-out infinite"
                  : "none",
              }}
            >
              {spread.progress_text}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 20,
          width: "100%",
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: progressWidth,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #facc15, #d97706)",
            boxShadow: "0 0 14px rgba(250,204,21,0.35)",
            position: "relative",
            overflow: "hidden",
            transition: "width 0.45s ease",
          }}
        >
          {isAnimated && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "40%",
                height: "100%",
                background:
                  "linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.5),rgba(255,255,255,0))",
                animation: "lb-shimmer 1.4s linear infinite",
              }}
            />
          )}
        </div>
      </div>

      {/* Chips */}
      <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {[
          { label: "State",     value: spread.ui_state || spread.status },
          { label: "Stop Loss", value: formatCurrency(spread.stop_loss)  },
          { label: "Target",    value: formatCurrency(spread.target)     },
        ].map((chip) => (
          <div
            key={chip.label}
            style={{
              padding: "9px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "var(--font-mono)",
              color: "#e5e7eb",
              fontSize: 12,
            }}
          >
            {chip.label}:{" "}
            <strong style={{ fontWeight: 700 }}>{chip.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Main panel ─────────────────────────────────────────────────────────── */
const IntradaySpreadsPanel: React.FC<Props> = ({ spreadType }) => {
  const [spreads, setSpreads] = useState<IntradaySpread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let intervalId: number | undefined;
    let isMounted = true;

    const load = async () => {
      try {
        const data = await fetchAllIntradaySpreads();
        if (!isMounted) return;

        const allSpreads: IntradaySpread[] = Object.values(data ?? {});
        const filtered = allSpreads
          .filter((item) => {
            const t = String(item.spread_type || "").toLowerCase();
            return t === spreadType;
          })
          .sort((a, b) => a.index.localeCompare(b.index));

        setSpreads(filtered);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        console.error(err);
        setError("Unable to fetch live spread data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    intervalId = window.setInterval(load, 1000);
    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [spreadType]);

  const summary = useMemo(() => {
    const openCount = spreads.filter((s) => s.status === "OPEN").length;
    const totalPnl  = spreads.reduce((acc, s) => acc + (s.net_pnl || 0), 0);
    return { openCount, totalPnl };
  }, [spreads]);

  const waitingSpreads = spreads.filter((s) =>
    waitingStates.has(s.ui_state || s.status)
  );
  const liveSpreads = spreads.filter(
    (s) => !waitingStates.has(s.ui_state || s.status)
  );

  const pnlColor =
    summary.totalPnl > 0 ? "#22c55e" : summary.totalPnl < 0 ? "#ef4444" : "#22c55e";

  const cardKey = (s: IntradaySpread) =>
    `${s.index}-${s.strategy_name}-${s.updated_at}-${s.status}`;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          borderRadius: 20,
          padding: "24px 22px",
          background:
            "linear-gradient(135deg, rgba(8,8,8,0.99), rgba(10,18,36,0.95))",
          border: "1px solid rgba(250,204,21,0.12)",
          boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
          marginBottom: 16,
        }}
      >
        <div className="lb-eyebrow" style={{ marginBottom: 8 }}>
          Live Trading
        </div>
        <h2
          style={{
            margin: "0 0 6px",
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 300,
            color: "#f7f0df",
          }}
        >
          {titleMap[spreadType]}
        </h2>
        <p
          style={{
            margin: "0 0 18px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "rgba(255,255,255,0.38)",
          }}
        >
          {subtitleMap[spreadType]}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "var(--font-mono)",
              color: "#e5e7eb",
              fontSize: 13,
            }}
          >
            Open Trades:{" "}
            <strong style={{ color: "#f7f0df" }}>{summary.openCount}</strong>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "var(--font-mono)",
              color: pnlColor,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Total Net PnL: ₹{summary.totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* States */}
      {loading ? (
        <div
          style={{
            borderRadius: 20,
            padding: 28,
            background: "rgba(8,9,12,0.96)",
            border: "1px solid rgba(250,204,21,0.1)",
            fontFamily: "var(--font-mono)",
            color: "rgba(255,255,255,0.45)",
            fontSize: 13,
          }}
        >
          Loading live spreads…
        </div>
      ) : error ? (
        <div
          style={{
            borderRadius: 20,
            padding: 28,
            background: "rgba(8,9,12,0.96)",
            border: "1px solid rgba(239,68,68,0.2)",
            fontFamily: "var(--font-mono)",
            color: "#fca5a5",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : waitingSpreads.length > 0 ? (
        <div>
          {waitingSpreads.map((s) => (
            <WaitingSpreadCard key={cardKey(s)} spread={s} spreadType={spreadType} />
          ))}
          {liveSpreads.map((s) => (
            <IntradaySpreadCard key={cardKey(s)} spread={s} />
          ))}
        </div>
      ) : liveSpreads.length === 0 ? (
        <div
          style={{
            borderRadius: 20,
            padding: 28,
            background: "rgba(8,9,12,0.96)",
            border: "1px solid rgba(250,204,21,0.1)",
            fontFamily: "var(--font-mono)",
            color: "rgba(255,255,255,0.4)",
            fontSize: 13,
          }}
        >
          {emptyMessageMap[spreadType]}
        </div>
      ) : (
        <div>
          {liveSpreads.map((s) => (
            <IntradaySpreadCard key={cardKey(s)} spread={s} />
          ))}
        </div>
      )}
    </div>
  );
};

export default IntradaySpreadsPanel;
