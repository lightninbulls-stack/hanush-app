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

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
};

const formatSignedPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(2);
};

const formatSignedNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
};

const getTone = (value: number | null | undefined): MetricTone => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral";
  }
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
};

const formatXAxisDate = (value: string | undefined): string => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

const getBenchmarkDisplayName = (value?: string | null): string => {
  if (!value) {
    return "NIFTY 50";
  }

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
  if (!points.length) {
    return "";
  }

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

const PerformanceComparisonChart: React.FC<PerformanceComparisonChartProps> = ({
  portfolioCurve,
  benchmarkCurve,
  benchmarkName,
}) => {
  const benchmarkDisplayName = getBenchmarkDisplayName(benchmarkName);

  const chartData = useMemo(() => {
    if (!portfolioCurve.length || !benchmarkCurve?.length) {
      return null;
    }

    const allValues = [...portfolioCurve, ...benchmarkCurve].map(
      (point) => point.nav
    );
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
      endLabel: formatXAxisDate(
        portfolioCurve[portfolioCurve.length - 1]?.date
      ),
      portfolioEndNav: portfolioCurve[portfolioCurve.length - 1]?.nav ?? null,
      benchmarkEndNav: benchmarkCurve[benchmarkCurve.length - 1]?.nav ?? null,
    };
  }, [benchmarkCurve, portfolioCurve]);

  if (!chartData) {
    return null;
  }

  return (
    <div className="portfolio-comparison-section">
      <div className="portfolio-section-heading-row">
        <div>
          <h3>Portfolio vs Benchmark</h3>
          <p className="portfolio-section-copy">
            Normalized NAV comparison for the last 1 year using daily close
            data.
          </p>
        </div>
        <span className="portfolio-section-badge">vs {benchmarkDisplayName}</span>
      </div>

      <div className="portfolio-curve-shell">
        <div className="portfolio-curve-header">
          <div className="portfolio-legend">
            <div className="portfolio-legend-item">
              <span className="portfolio-legend-dot portfolio-dot" />
              <span>Portfolio</span>
            </div>
            <div className="portfolio-legend-item">
              <span className="portfolio-legend-dot benchmark-dot" />
              <span>{benchmarkDisplayName}</span>
            </div>
          </div>

          <div className="portfolio-curve-values">
            <span>
              Portfolio End NAV:{" "}
              <strong>{formatNumber(chartData.portfolioEndNav)}x</strong>
            </span>
            <span>
              Benchmark End NAV:{" "}
              <strong>{formatNumber(chartData.benchmarkEndNav)}x</strong>
            </span>
          </div>
        </div>

        <svg
          className="portfolio-curve-chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Portfolio and benchmark normalized NAV comparison"
        >
          <line
            x1={CHART_PADDING_X}
            y1={CHART_HEIGHT - CHART_PADDING_Y}
            x2={CHART_WIDTH - CHART_PADDING_X}
            y2={CHART_HEIGHT - CHART_PADDING_Y}
            className="portfolio-axis-line"
          />
          <line
            x1={CHART_PADDING_X}
            y1={CHART_PADDING_Y}
            x2={CHART_PADDING_X}
            y2={CHART_HEIGHT - CHART_PADDING_Y}
            className="portfolio-axis-line"
          />
          <path
            d={chartData.benchmarkPath}
            className="portfolio-curve benchmark"
          />
          <path
            d={chartData.portfolioPath}
            className="portfolio-curve portfolio"
          />
        </svg>

        <div className="portfolio-curve-footer">
          <span>{chartData.startLabel}</span>
          <span>{chartData.endLabel}</span>
        </div>
      </div>
    </div>
  );
};

const PortfolioBacktestPanel: React.FC = () => {
  const [data, setData] = useState<PortfolioBacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [strategyType, setStrategyType] =
    useState<StrategyType>("equal_weight");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const symbols = await fetchWatchlistSymbols();

        if (!symbols.length) {
          setError("Your watchlist is empty. Add symbols first.");
          setData(null);
          return;
        }

        const backtest = await runWatchlistBacktest(symbols, strategyType);
        setData(backtest);
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Failed to run backtest");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [strategyType]);

  if (loading) {
    return (
      <div className="glass-card helper-card backtest-panel">
        <div className="portfolio-backtest-header">
          <h2 className="glow-text">Portfolio Backtest</h2>
          <p>Running 1Y watchlist backtest...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card helper-card backtest-panel">
        <div className="portfolio-backtest-header">
          <h2 className="glow-text">Portfolio Backtest</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const m = data.metrics;
  const benchmarkMetrics = data.benchmark_metrics;
  const benchmarkLabel = getBenchmarkDisplayName(data.benchmark_name);

  const metricCards: MetricCardItem[] = [
    {
      label: "Cumulative Return",
      value: formatPercent(m.cumulative_return_pct),
      tone: getTone(m.cumulative_return_pct),
    },
    {
      label: "CAGR",
      value: formatPercent(m.cagr_pct),
      tone: getTone(m.cagr_pct),
    },
    {
      label: "Volatility",
      value: formatPercent(m.annualized_volatility_pct),
      tone: "neutral",
    },
    {
      label: "Sharpe",
      value: formatNumber(m.sharpe),
      tone: getTone(m.sharpe),
    },
    {
      label: "Max Drawdown",
      value: formatPercent(m.max_drawdown_pct),
      tone: getTone(m.max_drawdown_pct),
    },
    {
      label: "1W Return",
      value: formatPercent(m.return_1w_pct),
      tone: getTone(m.return_1w_pct),
    },
    {
      label: "1M Return",
      value: formatPercent(m.return_1m_pct),
      tone: getTone(m.return_1m_pct),
    },
    {
      label: "3M Return",
      value: formatPercent(m.return_3m_pct),
      tone: getTone(m.return_3m_pct),
    },
    {
      label: "6M Return",
      value: formatPercent(m.return_6m_pct),
      tone: getTone(m.return_6m_pct),
    },
    {
      label: "Portfolio VaR (95%)",
      value: formatPercent(m.var_95_pct),
      tone: "negative",
    },
  ];

  const comparisonCards: MetricCardItem[] = benchmarkMetrics
    ? [
        {
          label: "Return Spread",
          value: formatSignedPercent(
            m.cumulative_return_pct - benchmarkMetrics.cumulative_return_pct
          ),
          tone: getTone(
            m.cumulative_return_pct - benchmarkMetrics.cumulative_return_pct
          ),
        },
        {
          label: "CAGR Spread",
          value: formatSignedPercent(m.cagr_pct - benchmarkMetrics.cagr_pct),
          tone: getTone(m.cagr_pct - benchmarkMetrics.cagr_pct),
        },
        {
          label: "Beta to Benchmark",
          value: formatNumber(m.beta_to_benchmark),
          tone: "neutral",
        },
        {
          label: "Correlation",
          value: formatNumber(m.correlation_to_benchmark),
          tone: "neutral",
        },
      ]
    : [];

  const comparisonRows: ComparisonRow[] = benchmarkMetrics
    ? [
        {
          label: "Cumulative Return",
          portfolioValue: formatPercent(m.cumulative_return_pct),
          benchmarkValue: formatPercent(benchmarkMetrics.cumulative_return_pct),
          spreadValue: formatSignedPercent(
            m.cumulative_return_pct - benchmarkMetrics.cumulative_return_pct
          ),
          spreadTone: getTone(
            m.cumulative_return_pct - benchmarkMetrics.cumulative_return_pct
          ),
        },
        {
          label: "CAGR",
          portfolioValue: formatPercent(m.cagr_pct),
          benchmarkValue: formatPercent(benchmarkMetrics.cagr_pct),
          spreadValue: formatSignedPercent(
            m.cagr_pct - benchmarkMetrics.cagr_pct
          ),
          spreadTone: getTone(m.cagr_pct - benchmarkMetrics.cagr_pct),
        },
        {
          label: "Volatility",
          portfolioValue: formatPercent(m.annualized_volatility_pct),
          benchmarkValue: formatPercent(
            benchmarkMetrics.annualized_volatility_pct
          ),
          spreadValue: formatSignedPercent(
            m.annualized_volatility_pct -
              benchmarkMetrics.annualized_volatility_pct
          ),
          spreadTone: "neutral",
        },
        {
          label: "Sharpe",
          portfolioValue: formatNumber(m.sharpe),
          benchmarkValue: formatNumber(benchmarkMetrics.sharpe),
          spreadValue: formatSignedNumber(m.sharpe - benchmarkMetrics.sharpe),
          spreadTone: getTone(m.sharpe - benchmarkMetrics.sharpe),
        },
        {
          label: "Max Drawdown",
          portfolioValue: formatPercent(m.max_drawdown_pct),
          benchmarkValue: formatPercent(benchmarkMetrics.max_drawdown_pct),
          spreadValue: formatSignedPercent(
            m.max_drawdown_pct - benchmarkMetrics.max_drawdown_pct
          ),
          spreadTone: getTone(
            m.max_drawdown_pct - benchmarkMetrics.max_drawdown_pct
          ),
        },
        {
          label: "1M Return",
          portfolioValue: formatPercent(m.return_1m_pct),
          benchmarkValue: formatPercent(benchmarkMetrics.return_1m_pct),
          spreadValue: formatSignedPercent(
            (m.return_1m_pct ?? 0) - (benchmarkMetrics.return_1m_pct ?? 0)
          ),
          spreadTone: getTone(
            (m.return_1m_pct ?? 0) - (benchmarkMetrics.return_1m_pct ?? 0)
          ),
        },
        {
          label: "3M Return",
          portfolioValue: formatPercent(m.return_3m_pct),
          benchmarkValue: formatPercent(benchmarkMetrics.return_3m_pct),
          spreadValue: formatSignedPercent(
            (m.return_3m_pct ?? 0) - (benchmarkMetrics.return_3m_pct ?? 0)
          ),
          spreadTone: getTone(
            (m.return_3m_pct ?? 0) - (benchmarkMetrics.return_3m_pct ?? 0)
          ),
        },
        {
          label: "6M Return",
          portfolioValue: formatPercent(m.return_6m_pct),
          benchmarkValue: formatPercent(benchmarkMetrics.return_6m_pct),
          spreadValue: formatSignedPercent(
            (m.return_6m_pct ?? 0) - (benchmarkMetrics.return_6m_pct ?? 0)
          ),
          spreadTone: getTone(
            (m.return_6m_pct ?? 0) - (benchmarkMetrics.return_6m_pct ?? 0)
          ),
        },
        {
          label: "VaR (95%)",
          portfolioValue: formatPercent(m.var_95_pct),
          benchmarkValue: formatPercent(benchmarkMetrics.var_95_pct),
          spreadValue: formatSignedPercent(
            (m.var_95_pct ?? 0) - (benchmarkMetrics.var_95_pct ?? 0)
          ),
          spreadTone: "neutral",
        },
      ]
    : [];

  return (
    <div className="glass-card helper-card backtest-panel">
      <div className="portfolio-backtest-header">
        <div>
          <h2 className="glow-text">Portfolio Backtest</h2>
          <p>
            {strategyType === "equal_weight"
              ? "Equal-weight watchlist portfolio over the last 1 year."
              : strategyType === "mvo"
              ? "Mean-variance optimized watchlist portfolio over the last 1 year."
              : "Mean-variance optimized short-only watchlist portfolio over the last 1 year."}
          </p>

          <div className="portfolio-header-meta">
            <button
              className={`tv-time-btn ${
                strategyType === "equal_weight" ? "active" : ""
              }`}
              onClick={() => setStrategyType("equal_weight")}
            >
              Equal Weighted Portfolio
            </button>

            <button
              className={`tv-time-btn ${
                strategyType === "mvo" ? "active" : ""
              }`}
              onClick={() => setStrategyType("mvo")}
            >
              Mean Variance Optimization Weights Portfolio
            </button>

            <button
              className={`tv-time-btn ${
                strategyType === "mvo_short" ? "active" : ""
              }`}
              onClick={() => setStrategyType("mvo_short")}
            >
              Mean Variance Optimization Short
            </button>
          </div>
        </div>
      </div>

      {comparisonCards.length > 0 && (
        <div className="portfolio-comparison-grid">
          {comparisonCards.map((item) => (
            <div
              key={item.label}
              className={`portfolio-comparison-card tone-${
                item.tone || "neutral"
              }`}
            >
              <span className="portfolio-metric-label">{item.label}</span>
              <div className="portfolio-metric-value">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      <PerformanceComparisonChart
        portfolioCurve={data.curve}
        benchmarkCurve={data.benchmark_curve}
        benchmarkName={data.benchmark_name}
      />

      {comparisonRows.length > 0 && (
        <div className="portfolio-comparison-section">
          <div className="portfolio-section-heading-row">
            <div>
              <h3>Metric Comparison</h3>
              <p className="portfolio-section-copy">
                Spread is shown as Portfolio minus {benchmarkLabel}.
              </p>
            </div>
          </div>

          <div className="factor-table-shell portfolio-table-shell">
            <table className="factor-table portfolio-comparison-table">
              <thead>
                <tr>
                  <th className="align-left">Metric</th>
                  <th className="align-right">Portfolio</th>
                  <th className="align-right">{benchmarkLabel}</th>
                  <th className="align-right">Spread</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td className="align-left portfolio-symbol-cell">
                      {row.label}
                    </td>
                    <td className="align-right">{row.portfolioValue}</td>
                    <td className="align-right">{row.benchmarkValue}</td>
                    <td
                      className={`align-right comparison-spread-cell tone-${row.spreadTone}`}
                    >
                      {row.spreadValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="portfolio-holdings-section">
        <div className="portfolio-section-heading-row">
          <div>
            <h3>
              {strategyType === "equal_weight"
                ? "Portfolio Metrics"
                : strategyType === "mvo"
                ? "MVO Portfolio Metrics"
                : "MVO Short Portfolio Metrics"}
            </h3>
            <p className="portfolio-section-copy">
              {strategyType === "equal_weight"
                ? "Standalone equal-weight watchlist performance statistics."
                : strategyType === "mvo"
                ? "Standalone mean-variance optimized watchlist performance statistics."
                : "Standalone mean-variance optimized short-only watchlist performance statistics."}
            </p>
          </div>
        </div>

        <div className="portfolio-metrics-grid">
          {metricCards.map((item) => (
            <div
              key={item.label}
              className={`portfolio-metric-card tone-${item.tone || "neutral"}`}
            >
              <span className="portfolio-metric-label">{item.label}</span>
              <div className="portfolio-metric-value">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="portfolio-holdings-section">
        <div className="portfolio-section-heading-row">
          <h3>
            {strategyType === "equal_weight"
              ? "Matched Holdings"
              : strategyType === "mvo"
              ? "Optimized Holdings"
              : "Optimized Short Holdings"}
          </h3>
          <span className="portfolio-section-badge">
            {data.holdings.length} Stocks
          </span>
        </div>

        <div className="factor-table-shell portfolio-table-shell">
          <table className="factor-table portfolio-holdings-table">
            <colgroup>
              <col style={{ width: "28%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="align-left">Symbol</th>
                <th className="align-center">Weight</th>
                <th className="align-right">Start Price</th>
                <th className="align-right">End Price</th>
                <th className="align-right">Total Return</th>
              </tr>
            </thead>
            <tbody>
              {data.holdings.map((row) => {
                const returnTone = getTone(row.total_return_pct);

                return (
                  <tr key={row.symbol}>
                    <td className="align-left portfolio-symbol-cell">
                      {row.symbol}
                    </td>
                    <td className="align-center">
                      {(row.weight * 100).toFixed(2)}%
                    </td>
                    <td className="align-right">
                      {row.start_price.toFixed(2)}
                    </td>
                    <td className="align-right">
                      {row.end_price.toFixed(2)}
                    </td>
                    <td
                      className={`align-right portfolio-return-cell tone-${returnTone}`}
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
    </div>
  );
};

export default PortfolioBacktestPanel;
