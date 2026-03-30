import React from "react";
import { type Stock } from "../services/api";

interface StockTableProps {
  category: string;
  stocks: Stock[];
  starredSymbols: string[];
  onStockClick: (symbol: string) => void;
  onStarClick: (symbol: string) => void;
}

const formatPct = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
};

const getTone = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "neutral";
  }
  return value >= 0 ? "positive" : "negative";
};

const StockTable: React.FC<StockTableProps> = ({
  category,
  stocks,
  starredSymbols,
  onStockClick,
  onStarClick,
}) => {
  if (category === "Low Vol") {
    return (
      <div className="premium-lowvol-wrap">
        <table className="premium-lowvol-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Ticker</th>
              <th>Score</th>
              <th>1W Return</th>
              <th>1M Return</th>
              <th>3M Return</th>
              <th>6M Return</th>
              <th>6M Volatility</th>
            </tr>
          </thead>

          <tbody>
            {stocks.map((stock) => (
              <tr
                key={stock.symbol}
                className="premium-lowvol-row"
                onClick={() => onStockClick(stock.symbol)}
              >
                <td className="premium-rank-cell">{stock.rank}</td>

                <td className="premium-ticker-cell">
                  <button
                    className={`star-btn premium-star-btn ${
                      starredSymbols.includes(stock.symbol) ? "active" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStarClick(stock.symbol);
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </button>

                  <div className="premium-ticker-meta">
                    <div className="premium-symbol glow-text">{stock.symbol}</div>
                    <div className="premium-sector">{stock.sector || "—"}</div>
                  </div>
                </td>

                <td>
                  <span className="premium-score-pill">{stock.score}</span>
                </td>

                <td>
                  <span className={`premium-badge ${getTone(stock.return_1w)}`}>
                    {formatPct(stock.return_1w)}
                  </span>
                </td>

                <td>
                  <span className={`premium-badge ${getTone(stock.return_1m)}`}>
                    {formatPct(stock.return_1m)}
                  </span>
                </td>

                <td>
                  <span className={`premium-badge ${getTone(stock.return_3m)}`}>
                    {formatPct(stock.return_3m)}
                  </span>
                </td>

                <td>
                  <span className={`premium-badge ${getTone(stock.return_6m)}`}>
                    {formatPct(stock.return_6m)}
                  </span>
                </td>

                <td>
                  <span className="premium-badge neutral">
                    {formatPct(stock.volatility_6m)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="stock-table-container">
      <div className="table-header">
        <span>#</span>
        <span>SYMBOL</span>
        <span>SECTOR / SCORE</span>
        <span>3M RETURN</span>
        <span>6M RETURN</span>
      </div>

      <div className="table-body">
        {stocks.map((stock) => (
          <div
            key={stock.symbol}
            className="stock-row glass-card"
            onClick={() => onStockClick(stock.symbol)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className={`star-btn ${
                  starredSymbols.includes(stock.symbol) ? "active" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onStarClick(stock.symbol);
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
              <span className="rank">{stock.rank}</span>
            </div>

            <div className="symbol-col">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="symbol-name glow-text">{stock.symbol}</span>
                {stock.rank <= 3 && (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      background: "linear-gradient(45deg, #ffd700, #b8860b)",
                      color: "#000",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 900,
                    }}
                  >
                    TOP {stock.rank}
                  </span>
                )}
              </div>
              <span className="sector-name">{stock.sector}</span>
            </div>

            <div className="score-col">
              <div className="sector-bar-container">
                <div
                  className="sector-bar"
                  style={{ width: `${stock.score}%` }}
                ></div>
              </div>
              <span className="score-text">{stock.score} / 100</span>
            </div>

            <div className="return-col">
              <span
                className={`return-badge ${
                  (stock.return_3m ?? 0) >= 0 ? "positive" : "negative"
                }`}
              >
                {(stock.return_3m ?? 0) >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(stock.return_3m ?? 0).toFixed(2)}%
              </span>
            </div>

            <div className="return-col">
              <span
                className={`return-badge ${
                  (stock.return_6m ?? 0) >= 0 ? "positive" : "negative"
                }`}
              >
                {(stock.return_6m ?? 0) >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(stock.return_6m ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockTable;
