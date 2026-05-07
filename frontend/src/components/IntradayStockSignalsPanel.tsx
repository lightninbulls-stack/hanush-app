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

  const enteredCount     = spread?.entered_count ?? signals.length;
  const totalCount       = spread?.total_count ?? signals.length;
  const portfolioStopped = spread?.portfolio_stopped ?? false;
  const portfolioStopPct = spread?.portfolio_stop_pct ?? 2.5;
  const capitalPerStock  = spread?.capital_per_stock ?? 10000;
  const leverage         = spread?.leverage ?? 5;
  const maxStocks        = spread?.max_stocks ?? 10;
  const totalInvested    = spread?.total_invested ?? 0;
  const totalRealPnl     = spread?.total_real_pnl ?? 0;

  // Detect direction so all labels/examples flip for short side
  const isDownside = strategyName.toUpperCase().includes("DOWNSIDE") || strategyName.toUpperCase().includes("BEAR");
  const powerLabel    = isDownside ? "SELLING POWER / STOCK" : "BUYING POWER / STOCK";
  const powerNote     = isDownside ? `₹${capitalPerStock.toLocaleString("en-IN")} × ${leverage} = ₹${(capitalPerStock*leverage).toLocaleString("en-IN")} to short` : `₹${capitalPerStock.toLocaleString("en-IN")} × ${leverage} = ₹${(capitalPerStock*leverage).toLocaleString("en-IN")} to deploy`;
  const investedLabel = "Exposure ₹";   // leveraged exposure, NOT actual capital
  const actualCapital = capitalPerStock * maxStocks;

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
                  "Symbol", "Status", "Entry Time", "Entry Price",
                  "Current LTP", "Qty", investedLabel,
                  "P&L Pts", "P&L %", "Real P&L ₹",
                  "Target", "Stop Loss",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((row) => {
                const status = row.signal_status;
                const isEntered      = status === "ENTERED";
                const isTargetHit    = status === "TARGET_HIT";
                const isSlHit        = status === "STOP_LOSS_HIT";
                const isPortfolioStop = status === "PORTFOLIO_STOP_HIT";
                const entryPrice = row.entry_price ?? row.avg_price;
                const pnlPts  = row.pnl_points;
                const pnlPct  = row.pnl_pct;
                const realPnl = row.real_pnl;

                const statusBg = isEntered
                  ? "rgba(34,197,94,0.12)" : isTargetHit
                  ? "rgba(250,204,21,0.12)" : (isSlHit || isPortfolioStop)
                  ? "rgba(239,68,68,0.12)"  : "rgba(255,255,255,0.06)";
                const statusClr = isEntered
                  ? "#4ade80" : isTargetHit
                  ? "#fbbf24" : (isSlHit || isPortfolioStop)
                  ? "#f87171" : "rgba(255,255,255,0.45)";
                const statusBdr = isEntered
                  ? "1px solid rgba(34,197,94,0.25)" : isTargetHit
                  ? "1px solid rgba(250,204,21,0.3)"  : (isSlHit || isPortfolioStop)
                  ? "1px solid rgba(239,68,68,0.3)"   : "1px solid rgba(255,255,255,0.08)";

                return (
                  <tr key={row.instrument_token}>
                    <td style={{ color: isEntered ? "#f7f0df" : "rgba(255,255,255,0.55)", fontWeight: isEntered ? 600 : 400, fontFamily: "var(--font-serif)", fontSize: 14 }}>
                      {row.symbol}
                    </td>
                    <td>
                      <span style={{ display:"inline-block", padding:"3px 9px", borderRadius:6, fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, letterSpacing:0.5, background:statusBg, color:statusClr, border:statusBdr }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ color:"rgba(255,255,255,0.45)", fontSize:11 }}>{row.entry_time || "--"}</td>
                    <td>{formatPrice(entryPrice)}</td>
                    <td style={{ color:"#f7f0df", fontWeight:600, fontFamily:"var(--font-mono)", fontSize:13 }}>
                      {formatPrice(row.current_ltp)}
                    </td>
                    {/* Qty */}
                    <td style={{ color:"#e2e8f0", fontFamily:"var(--font-mono)", fontSize:12 }}>
                      {row.qty ?? "--"}
                    </td>
                    {/* Invested ₹ */}
                    <td style={{ color:"#94a3b8", fontFamily:"var(--font-mono)", fontSize:12 }}>
                      {row.invested_amount != null ? `₹${row.invested_amount.toLocaleString("en-IN")}` : "--"}
                    </td>
                    {/* P&L pts */}
                    <td style={{ color:pnlColor(pnlPts), fontWeight:700, fontFamily:"var(--font-mono)", fontSize:13 }}>
                      {formatPnlPoints(pnlPts)}
                    </td>
                    {/* P&L % */}
                    <td style={{ color:pnlColor(pnlPct), fontFamily:"var(--font-mono)", fontSize:12 }}>
                      {formatPnlPct(pnlPct)}
                    </td>
                    {/* Real P&L ₹ */}
                    <td style={{ color:pnlColor(realPnl), fontWeight:700, fontFamily:"var(--font-mono)", fontSize:13 }}>
                      {realPnl != null ? `₹${realPnl > 0 ? "+" : ""}${realPnl.toLocaleString("en-IN")}` : "--"}
                    </td>
                    <td style={{ color:"#4ade80", fontFamily:"var(--font-mono)", fontSize:12 }}>{formatPrice(row.target_price)}</td>
                    <td style={{ color:"#f87171", fontFamily:"var(--font-mono)", fontSize:12 }}>{formatPrice(row.stop_loss_price)}</td>
                  </tr>
                );
              })}
            </tbody>

            {/* Portfolio totals footer */}
            {signals.some(s => s.signal_status === "ENTERED") && (
              <tfoot>
                <tr style={{ borderTop:"1px solid rgba(255,255,255,0.1)" }}>
                  <td colSpan={6} style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"rgba(255,255,255,0.35)", paddingTop:10 }}>
                    PORTFOLIO TOTAL
                  </td>
                  <td style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"#94a3b8", paddingTop:10 }}>
                    <div>₹{totalInvested.toLocaleString("en-IN")} <span style={{fontSize:9, color:"rgba(255,255,255,0.3)"}}>EXPOSURE ({leverage}×)</span></div>
                    <div style={{fontSize:10, color:"rgba(250,204,21,0.55)", marginTop:2}}>₹{actualCapital.toLocaleString("en-IN")} <span style={{fontSize:9, color:"rgba(255,255,255,0.3)"}}>ACTUAL MARGIN</span></div>
                  </td>
                  <td colSpan={2} />
                  <td style={{ fontFamily:"var(--font-mono)", fontWeight:700, fontSize:13, color:pnlColor(totalRealPnl), paddingTop:10 }}>
                    ₹{totalRealPnl > 0 ? "+" : ""}{totalRealPnl.toLocaleString("en-IN")}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── How it works explanation ── */}
      <div style={{ marginTop:28, padding:"18px 20px", borderRadius:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"rgba(255,255,255,0.3)", letterSpacing:1.5, marginBottom:12 }}>
          HOW THIS WORKS
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:24 }}>
          {[
            { label:"Margin capital / stock", value:`₹${capitalPerStock.toLocaleString("en-IN")}`, note:"Your actual money at risk per trade" },
            { label:"Intraday leverage", value:`${leverage}×`, note:"Broker multiplies your margin by 5×" },
            { label: powerLabel, value:`₹${(capitalPerStock * leverage).toLocaleString("en-IN")}`, note: powerNote },
            { label:"Max stocks", value:`${maxStocks} stocks`, note:"Cap to control risk concentration" },
            { label:"Total actual capital", value:`₹${(capitalPerStock * maxStocks).toLocaleString("en-IN")}`, note:`${maxStocks} × ₹${capitalPerStock.toLocaleString("en-IN")} margin = your real money` },
            { label:"Qty formula", value:`⌊₹${(capitalPerStock * leverage).toLocaleString("en-IN")} ÷ price⌋`, note:"Whole shares only, no fractions" },
          ].map(item => (
            <div key={item.label} style={{ minWidth:160 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:1, marginBottom:3 }}>{item.label.toUpperCase()}</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"#f7f0df", marginBottom:2 }}>{item.value}</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"rgba(255,255,255,0.35)" }}>{item.note}</div>
            </div>
          ))}
        </div>

        {/* Capital vs Exposure clarification */}
        <div style={{ marginTop:14, padding:"10px 14px", borderRadius:8, background:"rgba(250,204,21,0.06)", border:"1px solid rgba(250,204,21,0.2)", fontFamily:"var(--font-mono)", fontSize:11, color:"rgba(255,255,255,0.6)", lineHeight:1.8 }}>
          <strong style={{ color:"rgba(250,204,21,0.85)" }}>⚡ Capital vs Exposure — </strong>
          Your real investment is only <strong style={{ color:"#f7f0df" }}>₹{(capitalPerStock * maxStocks).toLocaleString("en-IN")}</strong> ({maxStocks} × ₹{capitalPerStock.toLocaleString("en-IN")} margin).
          The <strong style={{ color:"#94a3b8" }}>Exposure ₹</strong> column shows how much stock you <em>control</em> via {leverage}× leverage — roughly ₹{(capitalPerStock * leverage).toLocaleString("en-IN")} per stock.
          Your P&L and risk are calculated on the exposure, but you only put up ₹{(capitalPerStock * maxStocks).toLocaleString("en-IN")} of actual capital.
        </div>

        <div style={{ marginTop:10, padding:"10px 14px", borderRadius:8, background:"rgba(250,204,21,0.04)", border:"1px solid rgba(250,204,21,0.12)", fontFamily:"var(--font-mono)", fontSize:11, color:"rgba(255,255,255,0.45)", lineHeight:1.7 }}>
          <strong style={{ color:"rgba(250,204,21,0.7)" }}>Example — </strong>
          {isDownside ? (
            <>
              Stock at ₹4,000 · Selling power ₹50,000 → Qty = ⌊50,000 ÷ 4,000⌋ = <strong style={{ color:"#f7f0df" }}>12 shares</strong> · Exposure = ₹48,000 · Margin = ₹10,000 &nbsp;|&nbsp;
              Target −1% → exit at ₹3,960 · price fell → profit · Real P&L = (₹4,000 − ₹3,960) × 12 = <strong style={{ color:"#4ade80" }}>+₹480</strong> &nbsp;|&nbsp;
              Stop +1.5% → exit at ₹4,060 · price rose → loss · Real P&L = −₹60 × 12 = <strong style={{ color:"#f87171" }}>−₹720</strong>
            </>
          ) : (
            <>
              Stock at ₹4,000 · Buying power ₹50,000 → Qty = ⌊50,000 ÷ 4,000⌋ = <strong style={{ color:"#f7f0df" }}>12 shares</strong> · Exposure = ₹48,000 · Margin = ₹10,000 &nbsp;|&nbsp;
              Target +1% → exit at ₹4,040 · price rose → profit · Real P&L = (₹4,040 − ₹4,000) × 12 = <strong style={{ color:"#4ade80" }}>+₹480</strong> &nbsp;|&nbsp;
              Stop −1.5% → exit at ₹3,940 · price fell → loss · Real P&L = −₹60 × 12 = <strong style={{ color:"#f87171" }}>−₹720</strong>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntradayStockSignalsPanel;
