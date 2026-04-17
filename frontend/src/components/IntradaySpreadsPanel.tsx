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
  bull_call: "Call Debit Spreads",
  bear_put: "Put Debit Spreads",
};

const subtitleMap: Record<Props["spreadType"], string> = {
  bull_call: "Live intraday index call debit spread trades with MTM.",
  bear_put: "Live intraday index put debit spread trades with MTM.",
};

const waitingStates = new Set([
  "BOOTING",
  "WAITING_START_TIME",
  "LOADING_HISTORY",
  "WAITING_SIGNAL",
  "SIGNAL_TRIGGERED",
  "ENTERING_SPREAD",
]);

function WaitingSpreadCard({ spread }: { spread: IntradaySpread }) {
  const title =
    spread.spread_type === "bear_put"
      ? "Bear Put Spreads"
      : "Bull Call Spreads";

  return (
    <div
      className="dashboard-card"
      style={{
        padding: "18px",
        borderRadius: "16px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--primary-gold, #facc15)",
          }}
        >
          {title}
        </h3>

        <span
          style={{
            padding: "6px 10px",
            borderRadius: "999px",
            border: "1px solid rgba(255,215,0,0.18)",
            background: "rgba(255,255,255,0.04)",
            color: "#facc15",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {spread.ui_state || spread.status}
        </span>
      </div>

      <p
        style={{
          margin: "0 0 10px 0",
          color: "#d1d5db",
          fontSize: "15px",
          lineHeight: 1.5,
        }}
      >
        {spread.message || "Strategy is running..."}
      </p>

      {spread.progress_text ? (
        <p
          style={{
            margin: "0 0 14px 0",
            color: "#94a3b8",
            fontSize: "13px",
          }}
        >
          {spread.progress_text}
        </p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,215,0,0.10)",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "4px" }}>
            State
          </div>
          <div style={{ color: "#f8fafc", fontWeight: 700 }}>
            {spread.ui_state || spread.status}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,215,0,0.10)",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "4px" }}>
            Stop Loss
          </div>
          <div style={{ color: "#f8fafc", fontWeight: 700 }}>
            ₹ {spread.stop_loss?.toFixed(2) ?? "--"}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,215,0,0.10)",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "4px" }}>
            Target
          </div>
          <div style={{ color: "#f8fafc", fontWeight: 700 }}>
            ₹ {spread.target?.toFixed(2) ?? "--"}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const pnlClass =
    summary.totalPnl > 0
      ? "pnl pnl-positive"
      : summary.totalPnl < 0
      ? "pnl pnl-negative"
      : "pnl pnl-neutral";

  return (
    <div className="dashboard-panel-wrap">
      <div
        className="dashboard-card"
        style={{
          padding: "22px",
          borderRadius: "18px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              className="glow-text"
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 800,
              }}
            >
              {titleMap[spreadType]}
            </h2>

            <p
              style={{
                margin: "8px 0 0 0",
                color: "#cbd5e1",
                fontSize: "15px",
              }}
            >
              {subtitleMap[spreadType]}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                minWidth: "140px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,215,0,0.12)",
              }}
            >
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Open Trades
              </div>
              <div
                style={{
                  color: "#f8fafc",
                  fontWeight: 800,
                  fontSize: "22px",
                }}
              >
                {summary.openCount}
              </div>
            </div>

            <div
              style={{
                minWidth: "180px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,215,0,0.12)",
              }}
            >
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                Total Net PnL
              </div>
              <div
                className={pnlClass}
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                }}
              >
                ₹ {summary.totalPnl.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="dashboard-card" style={{ padding: "20px", borderRadius: "16px" }}>
          <p style={{ margin: 0, color: "#cbd5e1" }}>Loading live spreads...</p>
        </div>
      ) : error ? (
        <div className="dashboard-card" style={{ padding: "20px", borderRadius: "16px" }}>
          <p style={{ margin: 0, color: "#fca5a5" }}>{error}</p>
        </div>
      ) : waitingSpreads.length > 0 ? (
        <div>
          {waitingSpreads.map((spread) => (
            <WaitingSpreadCard
              key={`${spread.index}-${spread.strategy_name}-${spread.updated_at}-${spread.status}`}
              spread={spread}
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
        <div className="dashboard-card" style={{ padding: "20px", borderRadius: "16px" }}>
          <p style={{ margin: 0, color: "#cbd5e1" }}>{emptyMessageMap[spreadType]}</p>
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
