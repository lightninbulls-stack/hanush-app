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
    return "0.00%";
  }
  return `${value.toFixed(2)}%`;
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
      <div className="stock-table-container">
        <div className="table-header lowvol-header">
          <span>Rank</span>
          <span>Ticker</span>
          <span>Score</span>
          <span>1W Return (%)</span>
          <span>1M Return (%)</span>
          <span>3M Return (%)</span>
          <span>6M Return (%)</span>
          <span>6M Volatility (%)</span>
        </div>

        <div className="table-body">
          {stocks.map((stock) => (
            <div
              key={stock.symbol}
              className="stock-row glass-card lowvol-row"
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
                <span className="symbol-name glow-text">{stock.symbol}</span>
              </div>

              <div className="score-col">
                <span className="score-text">{stock.score}</span>
              </div>

              <div className="return-col">
                <span
                  className={`return-badge ${
                    (stock.return_1w ?? 0) >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatPct(stock.return_1w)}
                </span>
              </div>

              <div className="return-col">
                <span
                  className={`return-badge ${
                    (stock.return_1m ?? 0) >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatPct(stock.return_1m)}
                </span>
              </div>

              <div className="return-col">
                <span
                  className={`return-badge ${
                    (stock.return_3m ?? 0) >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatPct(stock.return_3m)}
                </span>
              </div>

              <div className="return-col">
                <span
                  className={`return-badge ${
                    (stock.return_6m ?? 0) >= 0 ? "positive" : "negative"
                  }`}
                >
                  {formatPct(stock.return_6m)}
                </span>
              </div>

              <div className="return-col">
                <span className="return-badge neutral">
                  {formatPct(stock.volatility_6m)}
                </span>
              </div>
            </div>
          ))}
        </div>
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
