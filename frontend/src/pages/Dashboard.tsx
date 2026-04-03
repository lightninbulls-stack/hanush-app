import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import { fetchStocksByCategory, type Stock } from "../services/api";
import {
  fetchWatchlistSymbols,
  addWatchlistSymbol,
  removeWatchlistSymbol,
} from "../services/watchlistApi";

const NON_FEATURE_TABS = ["Watchlist", "Guide", "Profile / Settings"];

const WATCHLIST_SOURCE_CATEGORIES = [
  "Momentum",
  "Low Vol",
  "Value",
  "Quality",
  "Regime Upside",
  "Regime Downside",
  "Aggressive Call Option Stocks",
  "Aggressive Put Option Stocks",
];

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("Momentum");
  const [previousTab, setPreviousTab] = useState("Watchlist");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [starredSymbols, setStarredSymbols] = useState<string[]>(() => {
    const saved = localStorage.getItem("starredStocks");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("starredStocks", JSON.stringify(starredSymbols));
  }, [starredSymbols]);

  useEffect(() => {
    const getStocks = async () => {
      setLoading(true);

      try {
        if (activeTab === "Watchlist") {
          if (starredSymbols.length === 0) {
            setStocks([]);
            return;
          }

          const results = await Promise.all(
            WATCHLIST_SOURCE_CATEGORIES.map((category) =>
              fetchStocksByCategory(category)
            )
          );

          const stockMap = new Map<string, Stock>();

          for (const result of results) {
            const categoryStocks: Stock[] = result?.stocks || [];
            for (const stock of categoryStocks) {
              if (!stockMap.has(stock.symbol)) {
                stockMap.set(stock.symbol, stock);
              }
            }
          }

          const watchlistStocks = starredSymbols
            .map((symbol) => stockMap.get(symbol))
            .filter((stock): stock is Stock => Boolean(stock));

          setStocks(watchlistStocks);
        } else {
          const data = await fetchStocksByCategory(activeTab);
          setStocks(data.stocks || []);
        }
      } finally {
        setLoading(false);
      }
    };

    getStocks();
  }, [activeTab, starredSymbols]);

  useEffect(() => {
    setSelectedStock(null);
  }, [activeTab]);

  const handleCategoryChange = (nextTab: string) => {
    if (nextTab !== activeTab) {
      setPreviousTab(activeTab);
      setActiveTab(nextTab);
    }
  };

  const handleStarClick = (symbol: string) => {
    setStarredSymbols((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleStockClick = (symbol: string) => {
    setSelectedStock(symbol);
  };

  const handleBackToDashboard = () => {
    if (selectedStock) {
      setSelectedStock(null);
      return;
    }

    if (previousTab && previousTab !== activeTab) {
      setActiveTab(previousTab);
      return;
    }

    setActiveTab("Watchlist");
  };

  const showFeatureBackButton =
    !selectedStock && !NON_FEATURE_TABS.includes(activeTab);

  return (
    <div className="main-layout">
      <Sidebar
        activeCategory={activeTab}
        setActiveCategory={handleCategoryChange}
        starredCount={starredSymbols.length}
      />

      <div className="content-area">
        {selectedStock ? (
          <div className="detail-container">
            <button className="back-btn" onClick={handleBackToDashboard}>
              <span>←</span> Back to Dashboard
            </button>

            <TradingViewChart symbol={selectedStock} />
            <StockStats symbol={selectedStock} />
          </div>
        ) : activeTab === "Guide" ? (
          <div className="glass-card helper-card">
            <h2 className="glow-text">User Guide</h2>
            <p>
              Welcome to Lightninbull Financial Analytics. This section helps you
              understand the metrics and strategies used in the platform.
            </p>
          </div>
        ) : activeTab === "Profile / Settings" ? (
          <div className="glass-card helper-card">
            <h2 className="glow-text">Profile & Settings</h2>
            <p>Manage your account preferences and application settings here.</p>
          </div>
        ) : (
          <>
            {showFeatureBackButton && (
              <div className="screener-toolbar">
                <button
                  className="back-btn screen-back-btn"
                  onClick={handleBackToDashboard}
                >
                  <span>←</span> Back to Dashboard
                </button>
              </div>
            )}

            <div className="screener-header compact-screener-header">
              <h2 className="glow-text">
                {activeTab}{" "}
                <span style={{ color: "var(--primary-gold)" }}>Screener</span>
              </h2>
              <p className="screener-subtitle">
                Live insights and professional quantitative metrics for {activeTab}
              </p>
            </div>

            <div className="table-view-container">
              {loading ? (
                <div className="loader-container">
                  <div className="loader"></div>
                  <p className="loader-text">Loading {activeTab} data...</p>
                </div>
              ) : (
                <StockTable
                  category={activeTab}
                  stocks={stocks}
                  starredSymbols={starredSymbols}
                  onStockClick={handleStockClick}
                  onStarClick={handleStarClick}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
