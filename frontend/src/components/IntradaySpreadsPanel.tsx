import React, { useEffect, useMemo, useState } from "react";
import IntradaySpreadCard from "./IntradaySpreadCard";
import {
  fetchAllIntradaySpreads,
  type IntradaySpread,
} from "../services/intradaySpreads";

type Props = {
  spreadType: "bull_call" | "bear_put";
};

const emptyMessageMap = {
  bull_call: "No live bull call spreads available.",
  bear_put: "No live bear put spreads available.",
};

const titleMap = {
  bull_call: "Bull Call Spreads",
  bear_put: "Bear Put Spreads",
};

const subtitleMap = {
  bull_call: "Live intraday index bull call spread trades with leg-level MTM.",
  bear_put: "Live intraday index bear put spread trades with leg-level MTM.",
};

const IntradaySpreadsPanel: React.FC<Props> = ({ spreadType }) => {
  const [spreads, setSpreads] = useState<IntradaySpread[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

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

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div
        style={{
          borderRadius: "18px",
          padding: "18px",
          background:
            "linear-gradient(180deg, rgba(12,18,32,0.95), rgba(17,24,39,0.95))",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: "28px", fontWeight: 800, color: "#f8fafc" }}>
          {titleMap[spreadType]}
        </div>
        <div style={{ color: "#94a3b8", marginTop: "6px", fontSize: "14px" }}>
          {subtitleMap[spreadType]}
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "16px",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.05)",
              color: "#e2e8f0",
              fontSize: "14px",
            }}
          >
            Open Trades: <strong>{summary.openCount}</strong>
          </div>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.05)",
              color: summary.totalPnl >= 0 ? "#22c55e" : "#ef4444",
              fontSize: "14px",
            }}
          >
            Total Net PnL: <strong>₹ {summary.totalPnl.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#cbd5e1", fontSize: "15px" }}>Loading live spreads...</div>
      ) : error ? (
        <div style={{ color: "#f87171", fontSize: "15px" }}>{error}</div>
      ) : spreads.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: "15px" }}>
          {emptyMessageMap[spreadType]}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {spreads.map((spread) => (
            <IntradaySpreadCard
              key={spread.strategy_name}
              spread={spread}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default IntradaySpreadsPanel;
