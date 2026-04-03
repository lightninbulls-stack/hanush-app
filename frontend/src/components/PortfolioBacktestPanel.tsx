import React, { useEffect, useState } from "react";
import {
  fetchWatchlistSymbols,
  runWatchlistBacktest,
  type PortfolioBacktestResponse,
} from "../services/watchlistApi";

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
      <div className="glass-card helper-card">
        <h2 className="glow-text">Portfolio Backtest</h2>
        <p>Running 1Y watchlist backtest...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card helper-card">
        <h2 className="glow-text">Portfolio Backtest</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const m = data.metrics;

  return (
    <div className="glass-card helper-card">
      <h2 className="glow-text">Portfolio Backtest</h2>
      <p>Equal-weight watchlist portfolio over the last 1 year.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginTop: "18px",
        }}
      >
        <div className="stat-card">
          <strong>Cumulative Return</strong>
          <div>{m.cumulative_return_pct}%</div>
        </div>
        <div className="stat-card">
          <strong>CAGR</strong>
          <div>{m.cagr_pct}%</div>
        </div>
        <div className="stat-card">
          <strong>Volatility</strong>
          <div>{m.annualized_volatility_pct}%</div>
        </div>
        <div className="stat-card">
          <strong>Sharpe</strong>
          <div>{m.sharpe}</div>
        </div>
        <div className="stat-card">
          <strong>Max Drawdown</strong>
          <div>{m.max_drawdown_pct}%</div>
        </div>
        <div className="stat-card">
          <strong>1M Return</strong>
          <div>{m.return_1m_pct ?? "—"}%</div>
        </div>
        <div className="stat-card">
          <strong>3M Return</strong>
          <div>{m.return_3m_pct ?? "—"}%</div>
        </div>
        <div className="stat-card">
          <strong>6M Return</strong>
          <div>{m.return_6m_pct ?? "—"}%</div>
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ marginBottom: "12px" }}>Matched Holdings</h3>
        <table className="factor-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Weight</th>
              <th>Start Price</th>
              <th>End Price</th>
              <th>Total Return</th>
            </tr>
          </thead>
          <tbody>
            {data.holdings.map((row) => (
              <tr key={row.symbol}>
                <td>{row.symbol}</td>
                <td>{(row.weight * 100).toFixed(2)}%</td>
                <td>{row.start_price.toFixed(2)}</td>
                <td>{row.end_price.toFixed(2)}</td>
                <td>{row.total_return_pct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortfolioBacktestPanel;
