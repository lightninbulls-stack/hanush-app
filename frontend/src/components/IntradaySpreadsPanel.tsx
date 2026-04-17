import React, { useEffect, useMemo, useState } from "react";
import IntradaySpreadCard from "./IntradaySpreadCard";
import {
  fetchAllIntradaySpreads,
  type IntradaySpread,
} from "../services/intradaySpreads";

type Props = {
  spreadType: "bull_call" | "bear_put";
};

const emptyMessageMap: Record<Props["spreadType"], string> = {
  bull_call: "No live call debit spreads available.",
  bear_put: "No live put debit spreads available.",
};

const titleMap: Record<Props["spreadType"], string> = {
  bull_call: "Call debit Spreads",
  bear_put: "Put debit Spreads",
};

const subtitleMap: Record<Props["spreadType"], string> = {
  bull_call: "Live intraday index call debit spread trades with MTM.",
  bear_put: "Live intraday index put debit spread trades with MTM.",
};

const waitingTitleMap: Record<Props["spreadType"], string> = {
  bull_call: "Bull Call Spreads",
  bear_put: "Bear Put Spreads",
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
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `₹${value.toFixed(2)}`;
};

const getProgressWidth = (state?: string) => {
  switch (state) {
    case "BOOTING":
      return "12%";
    case "WAITING_START_TIME":
      return "18%";
    case "LOADING_HISTORY":
      return "35%";
    case "WAITING_SIGNAL":
      return "52%";
    case "SIGNAL_TRIGGERED":
      return "72%";
    case "ENTERING_SPREAD":
      return "88%";
    default:
      return "25%";
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

const WaitingSpreadCard: React.FC<{
  spread: IntradaySpread;
  spreadType: Props["spreadType"];
}> = ({ spread, spreadType }) => {
  const progressWidth = getProgressWidth(spread.ui_state || spread.status);
  const cardTitle = waitingTitleMap[spreadType];
  const isAnimated = getProgressActive(spread);

  return (
    <>
      <style>
        {`
          @keyframes lb-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes lb-progress-shimmer {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(220%); }
          }

          @keyframes lb-live-pulse {
            0% { opacity: 0.65; text-shadow: 0 0 0 rgba(250,204,21,0); }
            50% { opacity: 1; text-shadow: 0 0 14px rgba(250,204,21,0.45); }
            100% { opacity: 0.7; text-shadow: 0 0 0 rgba(250,204,21,0); }
          }
        `}
      </style>

      <div
        style={{
          marginTop: "18px",
          borderRadius: "24px",
          padding: "24px",
          background:
            "linear-gradient(135deg, rgba(8,8,8,0.98), rgba(12,18,30,0.94))",
          border: "1px solid rgba(255,215,0,0.12)",
          boxShadow: "0 10px 35px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "18px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "78px",
              height: "78px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "5px solid rgba(250,204,21,0.18)",
                borderTopColor: "#facc15",
                borderLeftColor: "#eab308",
                animation: isAnimated ? "lb-spin 1.35s linear infinite" : "none",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "10px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at center, rgba(35,35,35,0.95) 35%, rgba(10,10,10,1) 75%)",
                boxShadow: "inset 0 0 16px rgba(0,0,0,0.65)",
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: "26px",
                fontWeight: 800,
                color: "#f8fafc",
                lineHeight: 1.1,
              }}
            >
              {cardTitle}
            </h2>

            <p
              style={{
                margin: "10px 0 0 0",
                color: "#d1d5db",
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              {spread.message || "Waiting for strategy state update."}
            </p>

            {spread.progress_text ? (
              <p
                style={{
                  margin: "8px 0 0 0",
                  color: "#facc15",
                  fontSize: "14px",
                  fontWeight: 700,
                  animation: isAnimated ? "lb-live-pulse 1.5s ease-in-out infinite" : "none",
                }}
              >
                {spread.progress_text}
              </p>
            ) : null}
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            width: "100%",
            height: "8px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.10)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: progressWidth,
              height: "100%",
              borderRadius: "999px",
              background: "linear-gradient(90deg, #facc15, #eab308)",
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
                    "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))",
                  animation: "lb-progress-shimmer 1.4s linear infinite",
                }}
              />
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.06)",
              color: "#e5e7eb",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            State: <span style={{ fontWeight: 800 }}>{spread.ui_state || spread.status}</span>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.06)",
              color: "#e5e7eb",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Stop Loss: <span style={{ fontWeight: 800 }}>{formatCurrency(spread.stop_loss)}</span>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.06)",
              color: "#e5e7eb",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Target: <span style={{ fontWeight: 800 }}>{formatCurrency(spread.target)}</span>
          </div>
        </div>
      </div>
    </>
  );
};

const IntradaySpreadsPanel: React.FC<Props> = ({ spreadType }) => {
  const [spreads, setSpreads] = useState<IntradaySpread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let intervalId: number | undefined;
    let isMounted = true;

    const load = async () => {
      try {
        const data = await fetchAllIntradaySpreads();

        if (!isMounted) return;

        const allSpreads = Object.values(data || {});
        const filtered = allSpreads
          .filter((item) => item?.spread_type === spreadType)
          .sort((a, b) => a.index.localeCompare(b.index));

        setSpreads(filtered);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        console.error(err);
        setError("Unable to fetch live spread data.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    intervalId = window.setInterval(load, 1500);

    return () => {
      isMounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [spreadType]);

  const summary = useMemo(() => {
    const openCount = spreads.filter((s) => s.status === "OPEN").length;
    const totalPnl = spreads.reduce((acc, item) => acc + (item.net_pnl || 0), 0);

    return { openCount, totalPnl };
  }, [spreads]);

  const waitingSpreads = spreads.filter((spread) =>
    waitingStates.has(spread.ui_state || spread.status)
  );

  const liveSpreads = spreads.filter(
    (spread) => !waitingStates.has(spread.ui_state || spread.status)
  );

  const pnlColor =
    summary.totalPnl > 0
      ? "#22c55e"
      : summary.totalPnl < 0
      ? "#ef4444"
      : "#22c55e";

  return (
    <div>
      <div
        style={{
          borderRadius: "24px",
          padding: "24px 20px",
          background:
            "linear-gradient(135deg, rgba(8,8,8,0.98), rgba(10,20,40,0.92))",
          border: "1px solid rgba(255,215,0,0.10)",
          boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
          marginBottom: "18px",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: "28px",
            fontWeight: 800,
          }}
        >
          {titleMap[spreadType]}
        </h2>

        <p
          style={{
            margin: "8px 0 18px 0",
            color: "#cbd5e1",
            fontSize: "15px",
          }}
        >
          {subtitleMap[spreadType]}
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.06)",
              color: "#f8fafc",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Open Trades: <span style={{ fontWeight: 800 }}>{summary.openCount}</span>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.06)",
              color: pnlColor,
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            Total Net PnL: ₹ {summary.totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            borderRadius: "24px",
            padding: "24px",
            background:
              "linear-gradient(135deg, rgba(8,8,8,0.98), rgba(10,20,40,0.92))",
            border: "1px solid rgba(255,215,0,0.10)",
            color: "#e5e7eb",
          }}
        >
          Loading live spreads...
        </div>
      ) : error ? (
        <div
          style={{
            borderRadius: "24px",
            padding: "24px",
            background:
              "linear-gradient(135deg, rgba(8,8,8,0.98), rgba(10,20,40,0.92))",
            border: "1px solid rgba(239,68,68,0.18)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      ) : waitingSpreads.length > 0 ? (
        <div>
          {waitingSpreads.map((spread) => (
            <WaitingSpreadCard
              key={`${spread.index}-${spread.strategy_name}-${spread.updated_at}-${spread.status}`}
              spread={spread}
              spreadType={spreadType}
            />
          ))}

          {liveSpreads.map((spread) => (
            <IntradaySpreadCard
              key={`${spread.index}-${spread.strategy_name}-${spread.updated_at}-${spread.status}`}
              spread={spread}
            />
          ))}
        </div>
      ) : liveSpreads.length === 0 ? (
        <div
          style={{
            borderRadius: "24px",
            padding: "24px",
            background:
              "linear-gradient(135deg, rgba(8,8,8,0.98), rgba(10,20,40,0.92))",
            border: "1px solid rgba(255,215,0,0.10)",
            color: "#e5e7eb",
          }}
        >
          {emptyMessageMap[spreadType]}
        </div>
      ) : (
        <div>
          {liveSpreads.map((spread) => (
            <IntradaySpreadCard
              key={`${spread.index}-${spread.strategy_name}-${spread.updated_at}-${spread.status}`}
              spread={spread}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default IntradaySpreadsPanel;
