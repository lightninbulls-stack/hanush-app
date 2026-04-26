import React, { useEffect, useMemo, useState } from "react";
import {
  fetchWatchlistSymbols,
  runWatchlistBacktest,
  type PortfolioBacktestResponse,
  type PortfolioPoint,
} from "../services/watchlistApi";

type StrategyType = "equal_weight" | "mvo" | "mvo_short";
type MetricTone = "neutral" | "positive" | "negative";

type MetricCardItem = {
  label: string;
  value: string;
  tone?: MetricTone;
};

type ComparisonRow = {
  label: string;
  portfolioValue: string;
  benchmarkValue: string;
  spreadValue: string;
  spreadTone: MetricTone;
};

type PerformanceComparisonChartProps = {
  portfolioCurve: PortfolioPoint[];
  benchmarkCurve?: PortfolioPoint[] | null;
  benchmarkName?: string | null;
};

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 320;
const CHART_PADDING_X = 28;
const CHART_PADDING_Y = 24;

const DEFAULT_RETAIL_CAPITAL = 100000;
const MIN_RETAIL_CAPITAL = 10000;
const MAX_RETAIL_CAPITAL = 1000000000;

const clampCapital = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_RETAIL_CAPITAL;
  return Math.max(MIN_RETAIL_CAPITAL, Math.min(MAX_RETAIL_CAPITAL, value));
};

const buildRetailAllocation = (
  weight: number,
  endPrice: number,
  capital: number
) => {
  const allocationAmount = Math.abs(weight) * capital;

  if (!endPrice || endPrice <= 0) {
    return {
      allocation_amount: allocationAmount,
      suggested_quantity: 0,
      actual_invested_amount: 0,
      remaining_cash: allocationAmount,
    };
  }

  const suggestedQuantity = Math.floor(allocationAmount / endPrice);
  const actualInvestedAmount = suggestedQuantity * endPrice;
  const remainingCash = allocationAmount - actualInvestedAmount;

  return {
    allocation_amount: allocationAmount,
    suggested_quantity: suggestedQuantity,
    actual_invested_amount: actualInvestedAmount,
    remaining_cash: remainingCash,
  };
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
};

const formatSignedPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(2);
};

const formatSignedNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const getTone = (value: number | null | undefined): MetricTone => {
  if (value === null || value === undefined || Number.isNaN(value)) return "neutral";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
};

const formatXAxisDate = (value: string | undefined): string => {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

const getBenchmarkDisplayName = (value?: string | null): string => {
  if (!value) return "NIFTY 50";

  const normalized = String(value).trim().toUpperCase();

  if (
    [
      "^NSEI",
      "NSEI",
      "NIFTY 50",
      "NIFTY50",
      "NIFTY_50",
      "NIFTY-50",
      "NIFTY50.NS",
    ].includes(normalized)
  ) {
    return "NIFTY 50";
  }

  return value;
};

const buildLinePath = (
  points: PortfolioPoint[],
  minValue: number,
  maxValue: number
): string => {
  if (!points.length) return "";

  const innerWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const range = maxValue - minValue || 1;
  const denominator = Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = CHART_PADDING_X + (index / denominator) * innerWidth;
      const y =
        CHART_HEIGHT -
        CHART_PADDING_Y -
        ((point.nav - minValue) / range) * innerHeight;

      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const metricDefinitions = [
  ["CAGR", "Yearly growth speed. Example: 20% CAGR means ₹1,00,000 grows around ₹1,20,000 in one year."],
  ["Total Return", "Total profit or loss during the full backtest period. This is the actual overall return."],
  ["Sharpe Ratio", "Shows whether returns are good compared to the risk taken. Higher Sharpe means better quality returns."],
  ["Max Drawdown", "The biggest fall from the highest portfolio value. This tells how much pain the investor may face."],
  ["Volatility", "How much the portfolio moves up and down. Higher volatility means more fluctuation."],
  ["VaR (95%)", "Estimated normal-day downside risk. Example: 2% VaR means ₹1,00,000 may lose around ₹2,000 on a bad normal day."],
  ["Alpha (CAGR)", "How much extra yearly return the portfolio generated compared with NIFTY 50."],
  ["Sharpe Spread", "Portfolio Sharpe minus NIFTY 50 Sharpe. It compares risk-adjusted performance."],
  ["DD Improvement", "Shows whether the portfolio fell less than NIFTY 50 during bad periods."],
  ["1W Return", "Portfolio performance over roughly the last 5 trading sessions."],
  ["2W Return", "Portfolio performance over roughly the last 10 trading sessions."],
  ["1M Return", "Portfolio performance over roughly the last 21 trading sessions."],
  ["3M Return", "Portfolio performance over roughly the last 63 trading sessions."],
  ["6M Return", "Portfolio performance over roughly the last 126 trading sessions."],
];

const PerformanceComparisonChart: React.FC<PerformanceComparisonChartProps> = ({
  portfolioCurve,
  benchmarkCurve,
  benchmarkName,
}) => {
  const benchmarkDisplayName = getBenchmarkDisplayName(benchmarkName);

  const chartData = useMemo(() => {
    if (!portfolioCurve.length || !benchmarkCurve?.length) return null;

    const allValues = [...portfolioCurve, ...benchmarkCurve].map((point) => point.nav);
    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const padding = Math.max((rawMax - rawMin) * 0.08, 0.02);
    const minValue = Math.max(0, rawMin - padding);
    const maxValue = rawMax + padding;

    return {
      minValue,
      maxValue,
      portfolioPath: buildLinePath(portfolioCurve, minValue, maxValue),
      benchmarkPath: buildLinePath(benchmarkCurve, minValue, maxValue),
      startLabel: formatXAxisDate(portfolioCurve[0]?.date),
      endLabel: formatXAxisDate(portfolioCurve[portfolioCurve.length - 1]?.date),
      portfolioEndNav: portfolioCurve[portfolioCurve.length - 1]?.nav ?? null,
      benchmarkEndNav: benchmarkCurve[benchmarkCurve.length - 1]?.nav ?? null,
    };
  }, [benchmarkCurve, portfolioCurve]);

  if (!chartData) return null;

  return (
    <div style={{ marginBottom: 28 }}>
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

      <div
        style={{
          background: "rgba(4,5,8,0.98)",
          border: "1px solid rgba(250,204,21,0.08)",
          borderRadius: 12,
          padding: 18,
        }}
      >
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
              { color: "#facc15", label: "Portfolio", shadow: "0 0 6px rgba(250,204,21,0.5)" },
              { color: "rgba(255,255,255,0.3)", label: benchmarkDisplayName, shadow: "none" },
            ].map((legend) => (
              <div
                key={legend.label}
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
                    background: legend.color,
                    boxShadow: legend.shadow,
                    display: "inline-block",
                  }}
                />
                {legend.label}
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
          <line
            x1={CHART_PADDING_X}
            y1={CHART_HEIGHT - CHART_PADDING_Y}
            x2={CHART_WIDTH - CHART_PADDING_X}
            y2={CHART_HEIGHT - CHART_PADDING_Y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />

          <line
            x1={CHART_PADDING_X}
            y1={CHART_PADDING_Y}
            x2={CHART_PADDING_X}
            y2={CHART_HEIGHT - CHART_PADDING_Y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />

          <path
            d={chartData.benchmarkPath}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />

          <path
            d={chartData.portfolioPath}
            fill="none"
            stroke="#facc15"
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 4px rgba(250,204,21,0.4))" }}
          />
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

const PortfolioBacktestPanel: React.FC = () => {
  const [strategyType, setStrategyType] =
    useState<StrategyType>("equal_weight");
  const [data, setData] = useState<PortfolioBacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retailCapital, setRetailCapital] = useState(DEFAULT_RETAIL_CAPITAL);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const symbols = await fetchWatchlistSymbols();

        if (!symbols || symbols.length === 0) {
          if (!cancelled) {
            setLoading(false);
            setData(null);
          }

          return;
        }

        const result = await runWatchlistBacktest(symbols, strategyType);

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError("Failed to run backtest. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [strategyType]);

  const metrics = data?.metrics;
  const benchmarkMetrics = data?.benchmark_metrics;
  const benchmarkLabel = getBenchmarkDisplayName(data?.benchmark_name);

  const allocationHoldings = useMemo(() => {
    if (!data?.holdings) return [];

    return data.holdings.map((holding) => ({
      ...holding,
      ...buildRetailAllocation(holding.weight, holding.end_price, retailCapital),
    }));
  }, [data?.holdings, retailCapital]);

  const metricCards: MetricCardItem[] = metrics
    ? [
        { label: "CAGR", value: formatPercent(metrics.cagr_pct), tone: getTone(metrics.cagr_pct) },
        { label: "Total Return", value: formatPercent(metrics.cumulative_return_pct), tone: getTone(metrics.cumulative_return_pct) },
        { label: "Sharpe Ratio", value: formatNumber(metrics.sharpe), tone: getTone(metrics.sharpe) },
        { label: "Max Drawdown", value: formatPercent(metrics.max_drawdown_pct), tone: getTone(metrics.max_drawdown_pct) },
        { label: "Volatility", value: formatPercent(metrics.annualized_volatility_pct), tone: "neutral" },
        { label: "1W Return", value: formatPercent(metrics.return_1w_pct), tone: getTone(metrics.return_1w_pct) },
        { label: "2W Return", value: formatPercent(metrics.return_2w_pct), tone: getTone(metrics.return_2w_pct) },
        { label: "1M Return", value: formatPercent(metrics.return_1m_pct), tone: getTone(metrics.return_1m_pct) },
        { label: "3M Return", value: formatPercent(metrics.return_3m_pct), tone: getTone(metrics.return_3m_pct) },
        { label: "6M Return", value: formatPercent(metrics.return_6m_pct), tone: getTone(metrics.return_6m_pct) },
        { label: "VaR (95%)", value: formatPercent(metrics.var_95_pct), tone: "neutral" },
      ]
    : [];

  const comparisonCards: MetricCardItem[] =
    metrics && benchmarkMetrics
      ? [
          {
            label: "Alpha (CAGR)",
            value: formatSignedPercent((metrics.cagr_pct ?? 0) - (benchmarkMetrics.cagr_pct ?? 0)),
            tone: getTone((metrics.cagr_pct ?? 0) - (benchmarkMetrics.cagr_pct ?? 0)),
          },
          {
            label: "Sharpe Spread",
            value: formatSignedNumber((metrics.sharpe ?? 0) - (benchmarkMetrics.sharpe ?? 0)),
            tone: getTone((metrics.sharpe ?? 0) - (benchmarkMetrics.sharpe ?? 0)),
          },
          {
            label: "DD Improvement",
            value: formatSignedPercent((metrics.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0)),
            tone: getTone(-((metrics.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0))),
          },
        ]
      : [];

  const comparisonRows: ComparisonRow[] =
    metrics && benchmarkMetrics
      ? [
          {
            label: "CAGR",
            portfolioValue: formatPercent(metrics.cagr_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.cagr_pct),
            spreadValue: formatSignedPercent((metrics.cagr_pct ?? 0) - (benchmarkMetrics.cagr_pct ?? 0)),
            spreadTone: getTone((metrics.cagr_pct ?? 0) - (benchmarkMetrics.cagr_pct ?? 0)),
          },
          {
            label: "Total Return",
            portfolioValue: formatPercent(metrics.cumulative_return_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.cumulative_return_pct),
            spreadValue: formatSignedPercent((metrics.cumulative_return_pct ?? 0) - (benchmarkMetrics.cumulative_return_pct ?? 0)),
            spreadTone: getTone((metrics.cumulative_return_pct ?? 0) - (benchmarkMetrics.cumulative_return_pct ?? 0)),
          },
          {
            label: "Sharpe Ratio",
            portfolioValue: formatNumber(metrics.sharpe),
            benchmarkValue: formatNumber(benchmarkMetrics.sharpe),
            spreadValue: formatSignedNumber((metrics.sharpe ?? 0) - (benchmarkMetrics.sharpe ?? 0)),
            spreadTone: getTone((metrics.sharpe ?? 0) - (benchmarkMetrics.sharpe ?? 0)),
          },
          {
            label: "Max Drawdown",
            portfolioValue: formatPercent(metrics.max_drawdown_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.max_drawdown_pct),
            spreadValue: formatSignedPercent((metrics.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0)),
            spreadTone: getTone(-((metrics.max_drawdown_pct ?? 0) - (benchmarkMetrics.max_drawdown_pct ?? 0))),
          },
          {
            label: "Volatility",
            portfolioValue: formatPercent(metrics.annualized_volatility_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.annualized_volatility_pct),
            spreadValue: formatSignedPercent((metrics.annualized_volatility_pct ?? 0) - (benchmarkMetrics.annualized_volatility_pct ?? 0)),
            spreadTone: "neutral",
          },
          {
            label: "1W Return",
            portfolioValue: formatPercent(metrics.return_1w_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.return_1w_pct),
            spreadValue: formatSignedPercent((metrics.return_1w_pct ?? 0) - (benchmarkMetrics.return_1w_pct ?? 0)),
            spreadTone: getTone((metrics.return_1w_pct ?? 0) - (benchmarkMetrics.return_1w_pct ?? 0)),
          },
          {
            label: "2W Return",
            portfolioValue: formatPercent(metrics.return_2w_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.return_2w_pct),
            spreadValue: formatSignedPercent((metrics.return_2w_pct ?? 0) - (benchmarkMetrics.return_2w_pct ?? 0)),
            spreadTone: getTone((metrics.return_2w_pct ?? 0) - (benchmarkMetrics.return_2w_pct ?? 0)),
          },
          {
            label: "1M Return",
            portfolioValue: formatPercent(metrics.return_1m_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.return_1m_pct),
            spreadValue: formatSignedPercent((metrics.return_1m_pct ?? 0) - (benchmarkMetrics.return_1m_pct ?? 0)),
            spreadTone: getTone((metrics.return_1m_pct ?? 0) - (benchmarkMetrics.return_1m_pct ?? 0)),
          },
          {
            label: "3M Return",
            portfolioValue: formatPercent(metrics.return_3m_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.return_3m_pct),
            spreadValue: formatSignedPercent((metrics.return_3m_pct ?? 0) - (benchmarkMetrics.return_3m_pct ?? 0)),
            spreadTone: getTone((metrics.return_3m_pct ?? 0) - (benchmarkMetrics.return_3m_pct ?? 0)),
          },
          {
            label: "6M Return",
            portfolioValue: formatPercent(metrics.return_6m_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.return_6m_pct),
            spreadValue: formatSignedPercent((metrics.return_6m_pct ?? 0) - (benchmarkMetrics.return_6m_pct ?? 0)),
            spreadTone: getTone((metrics.return_6m_pct ?? 0) - (benchmarkMetrics.return_6m_pct ?? 0)),
          },
          {
            label: "VaR (95%)",
            portfolioValue: formatPercent(metrics.var_95_pct),
            benchmarkValue: formatPercent(benchmarkMetrics.var_95_pct),
            spreadValue: formatSignedPercent((metrics.var_95_pct ?? 0) - (benchmarkMetrics.var_95_pct ?? 0)),
            spreadTone: "neutral",
          },
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
        <div className="lb-eyebrow" style={{ marginBottom: 14 }}>
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
        <p
          style={{
            fontFamily: "var(--font-mono)",
            color: "#f87171",
            fontSize: 13,
            margin: 0,
          }}
        >
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
        <div className="lb-eyebrow" style={{ marginBottom: 12 }}>
          Portfolio Backtest
        </div>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            color: "rgba(255,255,255,0.38)",
            fontSize: 13,
            margin: 0,
          }}
        >
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
      <div style={{ padding: "24px 24px 0" }}>
        <div className="lb-eyebrow" style={{ marginBottom: 8 }}>
          Research Lab
        </div>

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

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {[
            { type: "equal_weight" as StrategyType, label: "Equal Weight" },
            { type: "mvo" as StrategyType, label: "MVO Weights" },
            { type: "mvo_short" as StrategyType, label: "MVO Short" },
          ].map((option) => (
            <button
              key={option.type}
              onClick={() => setStrategyType(option.type)}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: `1px solid ${
                  strategyType === option.type
                    ? "rgba(250,204,21,0.5)"
                    : "rgba(250,204,21,0.15)"
                }`,
                background:
                  strategyType === option.type
                    ? "rgba(250,204,21,0.12)"
                    : "rgba(250,204,21,0.04)",
                color:
                  strategyType === option.type
                    ? "#facc15"
                    : "rgba(255,255,255,0.45)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1,
                cursor: "pointer",
                transition: "all 0.18s ease",
                boxShadow:
                  strategyType === option.type
                    ? "0 0 14px rgba(250,204,21,0.1)"
                    : "none",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

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

      <div style={{ padding: "0 24px" }}>
        <PerformanceComparisonChart
          portfolioCurve={data.curve}
          benchmarkCurve={data.benchmark_curve}
          benchmarkName={data.benchmark_name}
        />
      </div>

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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Metric", "Portfolio", benchmarkLabel, "Spread"].map((header) => (
                    <th
                      key={header}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: 2,
                        color: "rgba(250,204,21,0.55)",
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(250,204,21,0.08)",
                        background: "rgba(0,0,0,0.3)",
                        textAlign: header === "Metric" ? "left" : "right",
                        textTransform: "uppercase",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    {[
                      { value: row.label, tone: "neutral" as MetricTone, align: "left" },
                      { value: row.portfolioValue, tone: "neutral" as MetricTone, align: "right" },
                      { value: row.benchmarkValue, tone: "neutral" as MetricTone, align: "right" },
                      { value: row.spreadValue, tone: row.spreadTone, align: "right" },
                    ].map((cell, index) => (
                      <td
                        key={index}
                        style={{
                          padding: "11px 14px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color:
                            cell.tone === "positive"
                              ? "#4ade80"
                              : cell.tone === "negative"
                              ? "#f87171"
                              : index === 0
                              ? "rgba(255,255,255,0.85)"
                              : "rgba(255,255,255,0.6)",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          textAlign: cell.align as "left" | "right",
                          fontWeight: index === 0 ? 500 : 400,
                        }}
                      >
                        {cell.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {allocationHoldings.length > 0 && (
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
            <div>
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

              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.32)",
                  margin: "6px 0 0",
                }}
              >
                Retail allocation guide recalculates based on your investment amount.
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
              {allocationHoldings.length} Stocks
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
              padding: 14,
              borderRadius: 12,
              border: "1px solid rgba(250,204,21,0.1)",
              background: "rgba(8,9,12,0.95)",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 1.5,
                  color: "rgba(250,204,21,0.6)",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Investment Amount
              </div>

              <input
                type="number"
                min={MIN_RETAIL_CAPITAL}
                max={MAX_RETAIL_CAPITAL}
                step={10000}
                value={retailCapital}
                onChange={(event) => {
                  setRetailCapital(Number(event.target.value));
                }}
                onBlur={() => {
                  setRetailCapital((value) => clampCapital(value));
                }}
                style={{
                  width: 220,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(250,204,21,0.18)",
                  background: "rgba(0,0,0,0.35)",
                  color: "var(--lb-cream)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "rgba(255,255,255,0.38)",
                lineHeight: 1.6,
              }}
            >
              Default is ₹1,00,000. You can test allocation from ₹10,000 to ₹100 crore.
            </p>
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
                    { label: "Symbol", align: "left" },
                    { label: "Weight", align: "center" },
                    { label: "Start Price", align: "right" },
                    { label: "End Price", align: "right" },
                    { label: "Invest ₹", align: "right" },
                    { label: "Qty", align: "center" },
                    { label: "Actual ₹", align: "right" },
                    { label: "Cash Left", align: "right" },
                    { label: "Total Return", align: "right" },
                  ].map((header) => (
                    <th
                      key={header.label}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: 2,
                        color: "rgba(250,204,21,0.55)",
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(250,204,21,0.08)",
                        background: "rgba(0,0,0,0.3)",
                        textAlign: header.align as "left" | "center" | "right",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {allocationHoldings.map((row) => {
                  const returnTone = getTone(row.total_return_pct);

                  return (
                    <tr key={row.symbol}>
                      {[
                        { value: row.symbol, align: "left", color: "rgba(255,255,255,0.9)", weight: 500 },
                        { value: `${(row.weight * 100).toFixed(2)}%`, align: "center", color: "rgba(255,255,255,0.6)", weight: 400 },
                        { value: row.start_price.toFixed(2), align: "right", color: "rgba(255,255,255,0.6)", weight: 400 },
                        { value: row.end_price.toFixed(2), align: "right", color: "rgba(255,255,255,0.6)", weight: 400 },
                        { value: formatCurrency(row.allocation_amount), align: "right", color: "rgba(255,255,255,0.72)", weight: 400 },
                        { value: row.suggested_quantity ?? "—", align: "center", color: "rgba(255,255,255,0.72)", weight: 400 },
                        { value: formatCurrency(row.actual_invested_amount), align: "right", color: "rgba(255,255,255,0.72)", weight: 400 },
                        { value: formatCurrency(row.remaining_cash), align: "right", color: "rgba(255,255,255,0.52)", weight: 400 },
                        {
                          value: `${row.total_return_pct.toFixed(2)}%`,
                          align: "right",
                          color:
                            returnTone === "positive"
                              ? "#4ade80"
                              : returnTone === "negative"
                              ? "#f87171"
                              : "rgba(255,255,255,0.6)",
                          weight: 600,
                        },
                      ].map((cell, index) => (
                        <td
                          key={index}
                          style={{
                            padding: "11px 14px",
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            color: cell.color,
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            textAlign: cell.align as "left" | "center" | "right",
                            fontWeight: cell.weight,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cell.value}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ padding: "0 24px 32px" }}>
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
            Metric Definitions
          </h3>

          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "rgba(255,255,255,0.32)",
              margin: 0,
            }}
          >
            Simple explanations for retail investors.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))",
            gap: 12,
          }}
        >
          {metricDefinitions.map(([title, description]) => (
            <div
              key={title}
              style={{
                background: "rgba(8,9,12,0.95)",
                border: "1px solid rgba(250,204,21,0.1)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: "rgba(250,204,21,0.62)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {title}
              </div>

              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.42)",
                  margin: 0,
                }}
              >
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortfolioBacktestPanel;
