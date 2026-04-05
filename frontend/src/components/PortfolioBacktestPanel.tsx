import React, { useEffect, useState } from "react";
import {
  fetchWatchlistSymbols,
  runWatchlistBacktest,
  type PortfolioBacktestResponse,
} from "../services/watchlistApi";

type MetricCardItem = {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(2);
};

const getTone = (
  value: number | null | undefined
): "positive" | "negative" | "neutral" => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral";
  }
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
};

const PortfolioBacktestPanel: React.FC = () => {
  const [data, setData] = useState<PortfolioBacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        const backtest = await runWatchlistBacktest(symbols);
        setData(backtest);
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Failed to run backtest");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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

  return (
    <div className="glass-card helper-card backtest-panel">
      <div className="portfolio-backtest-header">
        <div>
          <h2 className="glow-text">Portfolio Backtest</h2>
          <p>Equal-weight watchlist portfolio over the last 1 year.</p>
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

      <div className="portfolio-holdings-section">
        <div className="portfolio-section-heading-row">
          <h3>Matched Holdings</h3>
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
