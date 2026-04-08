import React from "react";
import { type Stock } from "../services/api";

interface StockTableProps {
  category: string;
  stocks: Stock[];
  starredSymbols: string[];
  onStockClick: (symbol: string) => void;
  onStarClick: (symbol: string) => void;
}

type ColumnKey =
  | "rank"
  | "ticker"
  | "score"
  | "return_1w"
  | "return_1m"
  | "return_3m"
  | "return_6m"
  | "volatility_6m";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  align?: "left" | "center" | "right";
};

const formatPct = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
};

const getTone = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "neutral";
  }
  return value >= 0 ? "positive" : "negative";
};

const getColumnsForCategory = (_category: string): ColumnDef[] => {
  return [
    { key: "rank", label: "Rank", align: "center" },
    { key: "ticker", label: "Ticker", align: "left" },
    { key: "score", label: "Score", align: "center" },
    { key: "return_1w", label: "1W Return", align: "center" },
    { key: "return_1m", label: "1M Return", align: "center" },
    { key: "return_3m", label: "3M Return", align: "center" },
    { key: "return_6m", label: "6M Return", align: "center" },
    { key: "volatility_6m", label: "6M Volatility", align: "center" },
  ];
};

const renderCell = (
  stock: Stock,
  column: ColumnDef,
  starredSymbols: string[],
  onStarClick: (symbol: string) => void
) => {
  switch (column.key) {
    case "rank":
      return <span className="factor-rank">{stock.rank}</span>;

    case "ticker":
      return (
        <div className="factor-ticker-cell">
          <button
            className={`star-btn factor-star-btn ${
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

          <div className="factor-ticker-meta">
            <div className="factor-symbol glow-text">{stock.symbol}</div>
            <div className="factor-sector">{stock.sector || "—"}</div>
          </div>
        </div>
      );

    case "score":
      return <span className="score-chip">{stock.score}</span>;

    case "return_1w":
      return (
        <span className={`metric-pill ${getTone(stock.return_1w)}`}>
          {formatPct(stock.return_1w)}
        </span>
      );

    case "return_1m":
      return (
        <span className={`metric-pill ${getTone(stock.return_1m)}`}>
          {formatPct(stock.return_1m)}
        </span>
      );

    case "return_3m":
      return (
        <span className={`metric-pill ${getTone(stock.return_3m)}`}>
          {formatPct(stock.return_3m)}
        </span>
      );

    case "return_6m":
      return (
        <span className={`metric-pill ${getTone(stock.return_6m)}`}>
          {formatPct(stock.return_6m)}
        </span>
      );

    case "volatility_6m":
      return (
        <span className="metric-pill neutral">
          {formatPct(stock.volatility_6m)}
        </span>
      );

    default:
      return null;
  }
};

const StockTable: React.FC<StockTableProps> = ({
  category,
  stocks,
  starredSymbols,
  onStockClick,
  onStarClick,
}) => {
  const columns = getColumnsForCategory(category);

  return (
    <div className="factor-table-shell">
      <table className="factor-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`align-${column.align || "center"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {stocks.map((stock) => (
            <tr
              key={`${category}-${stock.symbol}-${stock.rank}`}
              onClick={() => onStockClick(stock.symbol)}
            >
              {columns.map((column) => (
                <td
                  key={`${stock.symbol}-${column.key}`}
                  className={`align-${column.align || "center"}`}
                >
                  {renderCell(stock, column, starredSymbols, onStarClick)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockTable;
