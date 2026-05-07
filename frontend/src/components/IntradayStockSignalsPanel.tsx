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

function formatUpdatedAt(value?: string) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return value;
  }
}

function pnlColor(val: number | null | undefined): string {
  if (val === null || val === undefined) return "rgba(255,255,255,0.45)";
  if (val > 0) return "#4ade80";
  if (val < 0) return "#f87171";
  return "rgba(255,255,255,0.45)";
}

function formatPnlPoints(val: number | null | undefined): string {
  if (val === null || val === undefined) return "--";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}`;
}

function formatPnlPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return "--";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

const IntradayStockSignalsPanel: React.FC<Props> = ({
  strategyName,
  title,
  subtitle,
  emptyMessage,
}) => {
  const [spread, setSpread] = useState<IntradaySpread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    return rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [spread]);

  const enteredCount = spread?.entered_count ?? signals.length;
  const totalCount = spread?.total_count ?? signals.length;
  const portfolioStopped = spread?.portfolio_stopped ?? false;
  const portfolioStopPct = spread?.portfolio_stop_pct ?? 2.5;

  // Portfolio-level PnL: from backend or computed from entered signals
  const portfolioPnl = useMemo(() => {
    const active = signals.filter((s) => s.signal_status === "ENTERED");
    if (spread?.portfolio_pnl_pct !== undefined && spread?.portfolio_pnl_pct !== null) {
      return {
        avgPct: spread.portfolio_pnl_pct,
        totalPoints: active.reduce((sum, s) => sum + (s.pnl_points ?? 0), 0),
        count: active.length,
      };
    }
    if (active.length === 0) return null;
    const totalPoints = active.reduce((sum, s) => sum + (s.pnl_points ?? 0), 0);
    const avgPct = active.reduce((sum, s) => sum + (s.pnl_pct ?? 0), 0) / active.length;
    return { totalPoints, avgPct, count: active.length };
  }, [signals, spread]);

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
      {/* ── Header ── */}
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

      {/* ── Summary chips ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Entered", value: String(enteredCount) },
          { label: "Total Stocks", value: String(totalCount) },
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
            <span
              style={{
                color: "rgba(255,255,255,0.35)",
                display: "block",
                fontSize: 9,
                letterSpacing: 1.5,
                marginBottom: 4,
              }}
            >
              {chip.label.toUpperCase()}
            </span>
            <strong style={{ color: "#f7f0df", fontSize: 13 }}>{chip.value}</strong>
          </div>
        ))}

        {/* Portfolio PnL chip */}
        {portfolioPnl !== null && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: portfolioStopped
                ? "rgba(239,68,68,0.10)"
                : portfolioPnl.avgPct > 0
                ? "rgba(34,197,94,0.08)"
                : portfolioPnl.avgPct < 0
                ? "rgba(248,113,113,0.08)"
                : "rgba(255,255,255,0.04)",
              border: portfolioStopped
                ? "1px solid rgba(239,68,68,0.45)"
                : portfolioPnl.avgPct > 0
                ? "1px solid rgba(34,197,94,0.25)"
                : portfolioPnl.avgPct < 0
                ? "1px solid rgba(248,113,113,0.25)"
                : "1px solid rgba(250,204,21,0.14)",
              fontFamily: "var(--font-mono)",
              minWidth: 190,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.35)", display: "block", fontSize: 9, letterSpacing: 1.5, marginBottom: 4 }}>
              PORTFOLIO P&amp;L · SL AT -{portfolioStopPct}%
            </span>
            <strong style={{ color: pnlColor(portfolioPnl.avgPct), fontSize: 15, display: "block" }}>
              {formatPnlPoints(portfolioPnl.totalPoints)} pts
            </strong>
            <span style={{ color: pnlColor(portfolioPnl.avgPct), fontSize: 11 }}>
              avg {formatPnlPct(portfolioPnl.avgPct)}
              {portfolioStopped && <span style={{ color: "#ef4444", marginLeft: 6 }}>● STOPPED</span>}
            </span>
          </div>
        )}
      </div>

      {/* ── Portfolio stop banner ── */}
      {portfolioStopped && (
        <div style={{
          marginBottom: 18,
          padding: "12px 16px",
          borderRadius: 10,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.35)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>🛑</span>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: "#ef4444", letterSpacing: 0.5 }}>
              PORTFOLIO STOP LOSS HIT — -{portfolioStopPct}%
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              All active positions closed. No new entries will be taken today.
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
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
                  "Entry Price",
                  "Current LTP",
                  "P&L Points",
                  "P&L %",
                  "Target",
                  "Stop Loss",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((row) => {
                const status = row.signal_status;
                const isEntered = status === "ENTERED";
                const isTargetHit = status === "TARGET_HIT";
                const isSlHit = status === "STOP_LOSS_HIT";
                const isPortfolioStop = status === "PORTFOLIO_STOP_HIT";
                const entryPrice = row.entry_price ?? row.avg_price;
                const pnlPts = row.pnl_points;
                const pnlPct = row.pnl_pct;

                const statusBg = isEntered
                  ? "rgba(34,197,94,0.12)"
                  : isTargetHit
                  ? "rgba(250,204,21,0.12)"
                  : isSlHit || isPortfolioStop
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(255,255,255,0.06)";
                const statusColor = isEntered
                  ? "#4ade80"
                  : isTargetHit
                  ? "#fbbf24"
                  : isSlHit || isPortfolioStop
                  ? "#f87171"
                  : "rgba(255,255,255,0.45)";
                const statusBorder = isEntered
                  ? "1px solid rgba(34,197,94,0.25)"
                  : isTargetHit
                  ? "1px solid rgba(250,204,21,0.3)"
                  : isSlHit || isPortfolioStop
                  ? "1px solid rgba(239,68,68,0.3)"
                  : "1px solid rgba(255,255,255,0.08)";

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
                          background: statusBg,
                          color: statusColor,
                          border: statusBorder,
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                      {row.entry_time || "--"}
                    </td>
                    <td>{formatPrice(entryPrice)}</td>
                    <td
                      style={{
                        color: "#f7f0df",
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                      }}
                    >
                      {formatPrice(row.current_ltp)}
                    </td>
                    {/* Stock-level P&L */}
                    <td
                      style={{
                        color: pnlColor(pnlPts),
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                      }}
                    >
                      {formatPnlPoints(pnlPts)}
                    </td>
                    <td
                      style={{
                        color: pnlColor(pnlPct),
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                      }}
                    >
                      {formatPnlPct(pnlPct)}
                    </td>
                    <td>{formatPrice(row.target_price)}</td>
                    <td>{formatPrice(row.stop_loss_price)}</td>
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
