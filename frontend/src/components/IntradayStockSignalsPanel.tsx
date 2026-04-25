import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAllIntradaySpreads,
  type IntradaySpread,
  type StockSignalRow,
} from "../services/intradaySpreads";

type Props = {
  strategyName: string;
  title: string;
  subtitle: string;
  emptyMessage: string;
};

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return Number(value).toFixed(2);
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return `${Number(value).toFixed(2)}%`;
}

function formatUpdatedAt(value?: string) {
  if (!value) return "--";
  try { return new Date(value).toLocaleTimeString(); }
  catch { return value; }
}

function getTopCapture(signals: StockSignalRow[]) {
  const entered = signals.filter(
    (s) =>
      s.signal_status === "ENTERED" &&
      s.points_captured !== null &&
      s.points_captured !== undefined
  );
  if (entered.length === 0) return null;
  return [...entered].sort(
    (a, b) => (b.points_captured || 0) - (a.points_captured || 0)
  )[0];
}

const IntradayStockSignalsPanel: React.FC<Props> = ({
  strategyName,
  title,
  subtitle,
  emptyMessage,
}) => {
  const [spread,  setSpread]  = useState<IntradaySpread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    const load = async () => {
      try {
        const data = await fetchAllIntradaySpreads();
        if (!isMounted) return;
        setSpread(data?.[strategyName] || null);
        setError("");
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setError("Unable to fetch intraday stock signals.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    intervalId = window.setInterval(load, 1500);
    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [strategyName]);

  const signals = useMemo<StockSignalRow[]>(() => {
    const rows = [...(spread?.signals || [])];
    return rows.sort((a, b) => {
      const aE = a.signal_status === "ENTERED" ? 0 : 1;
      const bE = b.signal_status === "ENTERED" ? 0 : 1;
      if (aE !== bE) return aE - bE;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [spread]);

  const enteredCount =
    spread?.entered_count ??
    signals.filter((s) => s.signal_status === "ENTERED").length;

  const totalCount = spread?.total_count ?? signals.length;
  const bestCapture = getTopCapture(signals);
  const isDownside  = strategyName.includes("DOWNSIDE");

  const statusColor =
    spread?.status === "RUNNING"
      ? "#22c55e"
      : spread?.status === "ERROR"
      ? "#ef4444"
      : "#f59e0b";

  return (
    <div
      style={{
        borderRadius: 24,
        padding: 28,
        background: "#000",
        border: "1px solid rgba(250,204,21,0.16)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        color: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <div className="lb-eyebrow" style={{ marginBottom: 8 }}>
            Signal Engine
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              fontWeight: 300,
              color: "#f7f0df",
              lineHeight: 1,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.42)",
              fontSize: 12,
              lineHeight: 1.8,
            }}
          >
            {subtitle}
          </p>
          <p
            style={{
              marginTop: 4,
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.25)",
              fontSize: 11,
            }}
          >
            {spread?.strategy_name || strategyName}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              color: statusColor,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 1,
            }}
          >
            {spread?.status || "WAITING"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(255,255,255,0.3)",
              fontSize: 11,
              marginTop: 4,
            }}
          >
            Updated: {formatUpdatedAt(spread?.updated_at)}
          </div>
        </div>
      </div>

      {/* Chips */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Entered",       value: String(enteredCount) },
          { label: "Total Stocks",  value: String(totalCount) },
          {
            label: "Best Capture",
            value: bestCapture
              ? `${bestCapture.symbol} (${formatPrice(bestCapture.points_captured)})`
              : "--",
          },
        ].map((chip) => (
          <div
            key={chip.label}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(250,204,21,0.14)",
              fontFamily: "var(--font-mono)",
              color: "#e5e7eb",
              fontSize: 12,
              minWidth: 130,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.35)", display: "block", fontSize: 9, letterSpacing: 1.5, marginBottom: 4 }}>
              {chip.label.toUpperCase()}
            </span>
            <strong style={{ color: "#f7f0df", fontSize: 13 }}>{chip.value}</strong>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          Loading signals…
        </p>
      ) : error ? (
        <p style={{ fontFamily: "var(--font-mono)", color: "#f87171", fontSize: 12 }}>{error}</p>
      ) : signals.length === 0 ? (
        <p style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
          {emptyMessage}
        </p>
      ) : (
        <div className="lb-signals-table-wrap">
          <table className="lb-signals-table">
            <thead>
              <tr>
                {[
                  "Symbol",
                  "Status",
                  "Entry Time",
                  "Avg Price",
                  "Current LTP",
                  isDownside ? "Min LTP" : "Max LTP",
                  "Points",
                  "%",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((row) => {
                const isEntered = row.signal_status === "ENTERED";
                const pts = row.points_captured;
                const ptsColor =
                  pts === null || pts === undefined
                    ? "rgba(255,255,255,0.6)"
                    : pts > 0
                    ? "#4ade80"
                    : pts < 0
                    ? "#f87171"
                    : "rgba(255,255,255,0.6)";

                const favorablePrice = isDownside
                  ? row.min_ltp ?? row.favorable_price ?? row.max_ltp
                  : row.max_ltp ?? row.favorable_price;

                return (
                  <tr key={row.instrument_token}>
                    <td
                      style={{
                        color: isEntered ? "#f7f0df" : "rgba(255,255,255,0.55)",
                        fontWeight: isEntered ? 600 : 400,
                        fontFamily: "var(--font-serif)",
                        fontSize: 14,
                      }}
                    >
                      {row.symbol}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: 6,
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          background: isEntered
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(255,255,255,0.06)",
                          color: isEntered ? "#4ade80" : "rgba(255,255,255,0.45)",
                          border: isEntered
                            ? "1px solid rgba(34,197,94,0.25)"
                            : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {row.signal_status}
                      </span>
                    </td>
                    <td style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                      {row.entry_time || "--"}
                    </td>
                    <td>{formatPrice(row.avg_price)}</td>
                    <td>{formatPrice(row.current_ltp)}</td>
                    <td>{formatPrice(favorablePrice)}</td>
                    <td style={{ color: ptsColor, fontWeight: 600 }}>
                      {formatPrice(pts)}
                    </td>
                    <td
                      style={{
                        color:
                          (row.pct_captured || 0) > 0
                            ? "#4ade80"
                            : (row.pct_captured || 0) < 0
                            ? "#f87171"
                            : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {formatPercent(row.pct_captured)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default IntradayStockSignalsPanel;
