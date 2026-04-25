import React, { useEffect, useMemo, useState } from "react";
import {
  fetchWatchlistSymbols,
  runWatchlistBacktest,
  type PortfolioBacktestResponse,
  type PortfolioPoint,
} from "../services/watchlistApi";

type StrategyType  = "equal_weight" | "mvo" | "mvo_short";
type MetricTone    = "neutral" | "positive" | "negative";

type MetricCardItem = { label: string; value: string; tone?: MetricTone };
type ComparisonRow  = {
  label: string;
  portfolioValue: string;
  benchmarkValue: string;
  spreadValue: string;
  spreadTone: MetricTone;
};
type PerformanceComparisonChartProps = {
  portfolioCurve:  PortfolioPoint[];
  benchmarkCurve?: PortfolioPoint[] | null;
  benchmarkName?:  string | null;
};

const CHART_WIDTH     = 1000;
const CHART_HEIGHT    = 320;
const CHART_PADDING_X = 28;
const CHART_PADDING_Y = 24;

const formatPercent = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(2)}%`;
};
const formatSignedPercent = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
};
const formatNumber = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(2);
};
const formatSignedNumber = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
};
const getTone = (v: number | null | undefined): MetricTone => {
  if (v === null || v === undefined || Number.isNaN(v)) return "neutral";
  if (v > 0) return "positive";
  if (v < 0) return "negative";
  return "neutral";
};
const formatXAxisDate = (value: string | undefined): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
};
const getBenchmarkDisplayName = (value?: string | null): string => {
  if (!value) return "NIFTY 50";
  const n = String(value).trim().toUpperCase();
  if (["^NSEI","NSEI","NIFTY 50","NIFTY50","NIFTY_50","NIFTY-50","NIFTY50.NS"].includes(n)) return "NIFTY 50";
  return value;
};

const buildLinePath = (points: PortfolioPoint[], minValue: number, maxValue: number): string => {
  if (!points.length) return "";
  const innerWidth  = CHART_WIDTH  - CHART_PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const range       = maxValue - minValue || 1;
  const denom       = Math.max(points.length - 1, 1);
  return points
    .map((p, i) => {
      const x = CHART_PADDING_X + (i / denom) * innerWidth;
      const y = CHART_HEIGHT - CHART_PADDING_Y - ((p.nav - minValue) / range) * innerHeight;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

/* ── Performance chart ───────────────────────────────────────────────────── */
const PerformanceComparisonChart: React.FC<PerformanceComparisonChartProps> = ({
  portfolioCurve,
  benchmarkCurve,
  benchmarkName,
}) => {
  const benchmarkDisplayName = getBenchmarkDisplayName(benchmarkName);

  const chartData = useMemo(() => {
    if (!portfolioCurve.length || !benchmarkCurve?.length) return null;

    const allValues = [...portfolioCurve, ...benchmarkCurve].map((p) => p.nav);
    const rawMin    = Math.min(...allValues);
    const rawMax    = Math.max(...allValues);
    const padding   = Math.max((rawMax - rawMin) * 0.08, 0.02);
    const minValue  = Math.max(0, rawMin - padding);
    const maxValue  = rawMax + padding;

    return {
      minValue,
      maxValue,
      portfolioPath:   buildLinePath(portfolioCurve, minValue, maxValue),
      benchmarkPath:   buildLinePath(benchmarkCurve, minValue, maxValue),
      startLabel:      formatXAxisDate(portfolioCurve[0]?.date),
      endLabel:        formatXAxisDate(portfolioCurve[portfolioCurve.length - 1]?.date),
      portfolioEndNav: portfolioCurve[portfolioCurve.length - 1]?.nav ?? null,
      benchmarkEndNav: benchmarkCurve[benchmarkCurve.length - 1]?.nav ?? null,
    };
  }, [benchmarkCurve, portfolioCurve]);

  if (!chartData) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 300,
              color: "var(--lb-cream)",
              margin: "0 0 4px",
            }}
          >
            Portfolio vs Benchmark
          </h3>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "rgba(255,255,255,0.32)",
              margin: 0,
            }}
          >
            Normalized NAV comparison for the last 1 year using daily close data.
          </p>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: 1.5,
            color: "rgba(250,204,21,0.6)",
            background: "rgba(250,204,21,0.08)",
            border: "1px solid rgba(250,204,21,0.18)",
            padding: "4px 10px",
            borderRadius: 6,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          vs {benchmarkDisplayName}
        </span>
      </div>

      {/* Chart shell */}
      <div
        style={{
          background: "rgba(4,5,8,0.98)",
          border: "1px solid rgba(250,204,21,0.08)",
          borderRadius: 12,
          padding: 18,
        }}
      >
        {/* Legend + values */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { color: "#facc15", label: "Portfolio",          shadow: "0 0 6px rgba(250,204,21,0.5)" },
              { color: "rgba(255,255,255,0.3)", label: benchmarkDisplayName, shadow: "none" },
            ].map((l) => (
              <div
                key={l.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: l.color,
                    boxShadow: l.shadow,
                    display: "inline-block",
                  }}
                />
                {l.label}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              flexWrap: "wrap",
            }}
          >
            <span>
              Portfolio End NAV:{" "}
              <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                {formatNumber(chartData.portfolioEndNav)}x
              </strong>
            </span>
            <span>
              Benchmark End NAV:{" "}
              <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                {formatNumber(chartData.benchmarkEndNav)}x
              </strong>
            </span>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          style={{ width: "100%", display: "block" }}
          role="img"
          aria-label="Portfolio and benchmark normalized NAV comparison"
        >
          <line x1={CHART_PADDING_X} y1={CHART_HEIGHT - CHART_PADDING_Y}
                x2={CHART_WIDTH - CHART_PADDING_X} y2={CHART_HEIGHT - CHART_PADDING_Y}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <line x1={CHART_PADDING_X} y1={CHART_PADDING_Y}
                x2={CHART_PADDING_X} y2={CHART_HEIGHT - CHART_PADDING_Y}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <path d={chartData.benchmarkPath} fill="none"
                stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} strokeDasharray="5 3" />
          <path d={chartData.portfolioPath} fill="none"
                stroke="#facc15" strokeWidth={2}
                style={{ filter: "drop-shadow(0 0 4px rgba(250,204,21,0.4))" }} />
        </svg>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "rgba(255,255,255,0.24)",
            marginTop: 8,
          }}
        >
          <span>{chartData.startLabel}</span>
          <span>{chartData.endLabel}</span>
        </div>
      </div>
    </div>
  );
};

/* ── Main panel ─────────────────────────────────────────────────────────── */
const PortfolioBacktestPanel: React.FC = () => {
  const [strategyType, setStrategyType] = useState<StrategyType>("equal_weight");
  const [data,         setData]         = useState<PortfolioBacktestResponse | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const symbols = await fetchWatchlistSymbols();
        if (!symbols || symbols.length === 0) {
          if (!cancelled) { setLoading(false); setData(null); }
          return;
        }
        const result = await runWatchlistBacktest(symbols, strategyType);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to run backtest. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [strategyType]);

  const m            = data?.metrics;
  const benchmarkMetrics = data?.benchmark_metrics;
  const benchmarkLabel   = getBenchmarkDisplayName(data?.benchmark_name);

  const metricCards: MetricCardItem[] = m
    ? [
        { label: "Annualised Return",  value: formatPercent(m.annualised_return_pct),  tone: getTone(m.annualised_return_pct) },
        { label: "Total Return",       value: formatPercent(m.total_return_pct),        tone: getTone(m.total_return_pct) },
        { label: "Sharpe Ratio",       value: formatNumber(m.sharpe_ratio),             tone: getTone(m.sharpe_ratio) },
        { label: "Sortino Ratio",      value: formatNumber(m.sortino_ratio),            tone: getTone(m.sortino_ratio) },
        { label: "Max Drawdown",       value: formatPercent(m.max_drawdown_pct),        tone: getTone(m.max_drawdown_pct) },
        { label: "Volatility",         value: formatPercent(m.volatility_pct),          tone: "neutral" },
        { label: "1M Return",          value: formatPercent(m.return_1m_pct),           tone: getTone(m.return_1m_pct) },
        { label: "3M Return",          value: formatPercent(m.return_3m_pct),           tone: getTone(m.return_3m_pct) },
        { label: "6M Return",          value: formatPercent(m.return_6m_pct),           tone: getTone(m.return_6m_pct) },
        { label: "VaR (95%)",          value: formatPercent(m.var_95_pct),              tone: "neutral" },
      ]
    : [];

  const comparisonCards: MetricCardItem[] =
    m && benchmarkMetrics
      ? [
          {
            label: "Alpha (Ann. Return)",
            value: formatSignedPercent((m.annualised_return_pct ?? 0) - (benchmarkMetrics.annualised_return_pct ?? 0)),
            tone:  getTone((m.annualised_return_pct ?? 0) - (benchmarkMetrics.annualised_return_pct ?? 0)),
          },
          {
            label: "Sharpe Spread",
            value: formatSignedNumber((m.sharpe_ratio ?? 0) - (benchmarkMetrics.sharpe_ratio ?? 0)),
            tone:  getTone((m.sharpe_ratio ?? 0) - (benchmarkMetrics.sharpe_ratio ?? 0)),
          },
          {
            label: "DD Improvement",
            value: formatSignedPercent((m.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0)),
            tone:  getTone(-((m.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0))),
          },
        ]
      : [];

  const comparisonRows: ComparisonRow[] =
    m && benchmarkMetrics
      ? [
          { label: "Ann. Return",   portfolioValue: formatPercent(m.annualised_return_pct),  benchmarkValue: formatPercent(benchmarkMetrics.annualised_return_pct),  spreadValue: formatSignedPercent((m.annualised_return_pct ?? 0) - (benchmarkMetrics.annualised_return_pct ?? 0)),  spreadTone: getTone((m.annualised_return_pct ?? 0) - (benchmarkMetrics.annualised_return_pct ?? 0)) },
          { label: "Sharpe Ratio",  portfolioValue: formatNumber(m.sharpe_ratio),             benchmarkValue: formatNumber(benchmarkMetrics.sharpe_ratio),             spreadValue: formatSignedNumber((m.sharpe_ratio ?? 0) - (benchmarkMetrics.sharpe_ratio ?? 0)),                          spreadTone: getTone((m.sharpe_ratio ?? 0) - (benchmarkMetrics.sharpe_ratio ?? 0)) },
          { label: "Sortino Ratio", portfolioValue: formatNumber(m.sortino_ratio),            benchmarkValue: formatNumber(benchmarkMetrics.sortino_ratio),            spreadValue: formatSignedNumber((m.sortino_ratio ?? 0) - (benchmarkMetrics.sortino_ratio ?? 0)),                         spreadTone: getTone((m.sortino_ratio ?? 0) - (benchmarkMetrics.sortino_ratio ?? 0)) },
          { label: "Max Drawdown",  portfolioValue: formatPercent(m.max_drawdown_pct),        benchmarkValue: formatPercent(benchmarkMetrics.max_drawdown_pct),        spreadValue: formatSignedPercent((m.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0)),                spreadTone: getTone(-((m.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0))) },
          { label: "Volatility",    portfolioValue: formatPercent(m.volatility_pct),          benchmarkValue: formatPercent(benchmarkMetrics.volatility_pct),          spreadValue: formatSignedPercent((m.volatility_pct ?? 0) - (benchmarkMetrics.volatility_pct ?? 0)),                    spreadTone: "neutral" },
          { label: "1M Return",     portfolioValue: formatPercent(m.return_1m_pct),           benchmarkValue: formatPercent(benchmarkMetrics.return_1m_pct),           spreadValue: formatSignedPercent((m.return_1m_pct ?? 0) - (benchmarkMetrics.return_1m_pct ?? 0)),                     spreadTone: getTone((m.return_1m_pct ?? 0) - (benchmarkMetrics.return_1m_pct ?? 0)) },
          { label: "3M Return",     portfolioValue: formatPercent(m.return_3m_pct),           benchmarkValue: formatPercent(benchmarkMetrics.return_3m_pct),           spreadValue: formatSignedPercent((m.return_3m_pct ?? 0) - (benchmarkMetrics.return_3m_pct ?? 0)),                     spreadTone: getTone((m.return_3m_pct ?? 0) - (benchmarkMetrics.return_3m_pct ?? 0)) },
          { label: "6M Return",     portfolioValue: formatPercent(m.return_6m_pct),           benchmarkValue: formatPercent(benchmarkMetrics.return_6m_pct),           spreadValue: formatSignedPercent((m.return_6m_pct ?? 0) - (benchmarkMetrics.return_6m_pct ?? 0)),                     spreadTone: getTone((m.return_6m_pct ?? 0) - (benchmarkMetrics.return_6m_pct ?? 0)) },
          { label: "VaR (95%)",     portfolioValue: formatPercent(m.var_95_pct),              benchmarkValue: formatPercent(benchmarkMetrics.var_95_pct),              spreadValue: formatSignedPercent((m.var_95_pct ?? 0) - (benchmarkMetrics.var_95_pct ?? 0)),                           spreadTone: "neutral" },
        ]
      : [];

  if (loading) {
    return (
      <div
        style={{
          background: "rgba(8,9,12,0.96)",
          border: "1px solid rgba(250,204,21,0.1)",
          borderRadius: 20,
          padding: 36,
          textAlign: "center",
        }}
      >
        <div
          className="lb-eyebrow"
          style={{ marginBottom: 14, textAlign: "center" }}
        >
          Portfolio Backtest
        </div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(255,255,255,0.38)",
            fontSize: 13,
          }}
        >
          Running backtest simulation…
        </p>
        <div className="loading-track" style={{ maxWidth: 300, margin: "16px auto 0" }}>
          <div className="loading-bar" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: "rgba(8,9,12,0.96)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 20,
          padding: 36,
        }}
      >
        <p style={{ fontFamily: "var(--font-mono)", color: "#f87171", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          background: "rgba(8,9,12,0.96)",
          border: "1px solid rgba(250,204,21,0.1)",
          borderRadius: 20,
          padding: 36,
        }}
      >
        <div className="lb-eyebrow" style={{ marginBottom: 12 }}>Portfolio Backtest</div>
        <p style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.38)", fontSize: 13, margin: 0 }}>
          Add stocks to your Watchlist first to run a backtest.
        </p>
      </div>
    );
  }

  const sectionTitle =
    strategyType === "equal_weight"
      ? "Equal Weight Portfolio"
      : strategyType === "mvo"
      ? "MVO Portfolio"
      : "MVO Short Portfolio";

  return (
    <div
      style={{
        background: "rgba(8,9,12,0.96)",
        border: "1px solid rgba(250,204,21,0.1)",
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "24px 24px 0" }}>
        <div className="lb-eyebrow" style={{ marginBottom: 8 }}>Research Lab</div>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 300,
            color: "var(--lb-cream)",
            margin: "0 0 6px",
          }}
        >
          Portfolio Backtest
        </h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "rgba(255,255,255,0.35)",
            margin: "0 0 18px",
          }}
        >
          {strategyType === "equal_weight"
            ? "Equal-weight watchlist portfolio over the last 1 year."
            : strategyType === "mvo"
            ? "Mean-variance optimized watchlist portfolio over the last 1 year."
            : "Mean-variance optimized short-only watchlist portfolio over the last 1 year."}
        </p>

        {/* Strategy tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {(
            [
              { type: "equal_weight" as StrategyType, label: "Equal Weight"         },
              { type: "mvo"          as StrategyType, label: "MVO Weights"          },
              { type: "mvo_short"    as StrategyType, label: "MVO Short"            },
            ] as const
          ).map((opt) => (
            <button
              key={opt.type}
              onClick={() => setStrategyType(opt.type)}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: `1px solid ${strategyType === opt.type ? "rgba(250,204,21,0.5)" : "rgba(250,204,21,0.15)"}`,
                background: strategyType === opt.type ? "rgba(250,204,21,0.12)" : "rgba(250,204,21,0.04)",
                color: strategyType === opt.type ? "#facc15" : "rgba(255,255,255,0.45)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1,
                cursor: "pointer",
                transition: "all 0.18s ease",
                boxShadow: strategyType === opt.type ? "0 0 14px rgba(250,204,21,0.1)" : "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison summary cards */}
      {comparisonCards.length > 0 && (
        <div style={{ padding: "0 24px 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
              gap: 10,
            }}
          >
            {comparisonCards.map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(8,9,12,0.95)",
                  border: "1px solid rgba(250,204,21,0.1)",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: 1.5,
                    color: "rgba(255,255,255,0.3)",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {item.label}
                </span>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 24,
                    fontWeight: 300,
                    color:
                      item.tone === "positive"
                        ? "#4ade80"
                        : item.tone === "negative"
                        ? "#f87171"
                        : "var(--lb-cream)",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ padding: "0 24px" }}>
        <PerformanceComparisonChart
          portfolioCurve={data.curve}
          benchmarkCurve={data.benchmark_curve}
          benchmarkName={data.benchmark_name}
        />
      </div>

      {/* Comparison rows */}
      {comparisonRows.length > 0 && (
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ marginBottom: 14 }}>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                fontWeight: 300,
                color: "var(--lb-cream)",
                margin: "0 0 4px",
              }}
            >
              Metric Comparison
            </h3>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "rgba(255,255,255,0.32)",
                margin: 0,
              }}
            >
              Spread = Portfolio minus {benchmarkLabel}
            </p>
          </div>
          <div
            style={{
              overflowX: "auto",
              borderRadius: 10,
              border: "1px solid rgba(250,204,21,0.08)",
            }}
          >
            <table
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  {["Metric", "Portfolio", benchmarkLabel, "Spread"].map((h) => (
                    <th
                      key={h}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: 2,
                        color: "rgba(250,204,21,0.55)",
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(250,204,21,0.08)",
                        background: "rgba(0,0,0,0.3)",
                        textAlign: h === "Metric" ? "left" : "right",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    {[
                      { val: row.label,          tone: "neutral" as MetricTone, align: "left"  },
                      { val: row.portfolioValue,  tone: "neutral" as MetricTone, align: "right" },
                      { val: row.benchmarkValue,  tone: "neutral" as MetricTone, align: "right" },
                      { val: row.spreadValue,     tone: row.spreadTone,          align: "right" },
                    ].map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: "11px 14px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color:
                            cell.tone === "positive"
                              ? "#4ade80"
                              : cell.tone === "negative"
                              ? "#f87171"
                              : ci === 0
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(255,255,255,0.6)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          textAlign: cell.align as "left" | "right",
                          fontWeight: ci === 0 ? 500 : 400,
                        }}
                      >
                        {cell.val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portfolio metrics */}
      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ marginBottom: 14 }}>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 300,
              color: "var(--lb-cream)",
              margin: "0 0 4px",
            }}
          >
            {sectionTitle} Metrics
          </h3>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "rgba(255,255,255,0.32)",
              margin: 0,
            }}
          >
            Standalone watchlist performance statistics.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))",
            gap: 10,
          }}
        >
          {metricCards.map((item) => (
            <div
              key={item.label}
              style={{
                background: "rgba(8,9,12,0.95)",
                border: "1px solid rgba(250,204,21,0.1)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  letterSpacing: 1.5,
                  color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {item.label}
              </span>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 24,
                  fontWeight: 300,
                  color:
                    item.tone === "positive"
                      ? "#4ade80"
                      : item.tone === "negative"
                      ? "#f87171"
                      : "var(--lb-cream)",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Holdings */}
      {data.holdings && data.holdings.length > 0 && (
        <div style={{ padding: "0 24px 28px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                fontWeight: 300,
                color: "var(--lb-cream)",
                margin: 0,
              }}
            >
              {strategyType === "equal_weight"
                ? "Matched Holdings"
                : strategyType === "mvo"
                ? "Optimized Holdings"
                : "Optimized Short Holdings"}
            </h3>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: 1.5,
                color: "rgba(250,204,21,0.6)",
                background: "rgba(250,204,21,0.08)",
                border: "1px solid rgba(250,204,21,0.18)",
                padding: "4px 10px",
                borderRadius: 6,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {data.holdings.length} Stocks
            </span>
          </div>

          <div
            style={{
              overflowX: "auto",
              borderRadius: 10,
              border: "1px solid rgba(250,204,21,0.08)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    { label: "Symbol",       align: "left"   },
                    { label: "Weight",       align: "center" },
                    { label: "Start Price",  align: "right"  },
                    { label: "End Price",    align: "right"  },
                    { label: "Total Return", align: "right"  },
                  ].map((h) => (
                    <th
                      key={h.label}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: 2,
                        color: "rgba(250,204,21,0.55)",
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(250,204,21,0.08)",
                        background: "rgba(0,0,0,0.3)",
                        textAlign: h.align as "left" | "center" | "right",
                        textTransform: "uppercase",
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((row) => {
                  const retTone = getTone(row.total_return_pct);
                  return (
                    <tr key={row.symbol}>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.9)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          fontWeight: 500,
                          textAlign: "left",
                        }}
                      >
                        {row.symbol}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.6)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          textAlign: "center",
                        }}
                      >
                        {(row.weight * 100).toFixed(2)}%
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.6)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          textAlign: "right",
                        }}
                      >
                        {row.start_price.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.6)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          textAlign: "right",
                        }}
                      >
                        {row.end_price.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color:
                            retTone === "positive"
                              ? "#4ade80"
                              : retTone === "negative"
                              ? "#f87171"
                              : "rgba(255,255,255,0.6)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {row.total_return_pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioBacktestPanel;
