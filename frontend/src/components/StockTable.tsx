import React from 'react';

import { type Stock } from '../services/api';

interface StockTableProps {
    stocks: Stock[];
    starredSymbols: string[];
    onStockClick: (symbol: string) => void;
    onStarClick: (symbol: string) => void;
}

const StockTable: React.FC<StockTableProps> = ({ stocks, starredSymbols, onStockClick, onStarClick }) => {
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
                    <div key={stock.symbol} className="stock-row glass-card" onClick={() => onStockClick(stock.symbol)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className={`star-btn ${starredSymbols.includes(stock.symbol) ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStarClick(stock.symbol);
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                            </button>
                            <span className="rank">{stock.rank}</span>
                        </div>
                        <div className="symbol-col">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="symbol-name glow-text">{stock.symbol}</span>
                                {stock.rank <= 3 && (
                                    <span style={{ 
                                        fontSize: '0.6rem', 
                                        background: 'linear-gradient(45deg, #ffd700, #b8860b)', 
                                        color: '#000', 
                                        padding: '2px 6px', 
                                        borderRadius: '4px', 
                                        fontWeight: 900 
                                    }}>
                                        TOP {stock.rank}
                                    </span>
                                )}
                            </div>
                            <span className="sector-name">{stock.sector}</span>
                        </div>
                        <div className="score-col">
                            <div className="sector-bar-container">
                                <div className="sector-bar" style={{ width: `${stock.score}%` }}></div>
                            </div>
                            <span className="score-text">{stock.score} / 100</span>
                        </div>
                        <div className="return-col">
                            <span className={`return-badge ${stock.return_3m >= 0 ? 'positive' : 'negative'}`}>
                                {stock.return_3m >= 0 ? '▲' : '▼'} {Math.abs(stock.return_3m)}%
                            </span>
                        </div>
                        <div className="return-col">
                            <span className={`return-badge ${stock.return_6m >= 0 ? 'positive' : 'negative'}`}>
                                {stock.return_6m >= 0 ? '▲' : '▼'} {Math.abs(stock.return_6m)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StockTable;
