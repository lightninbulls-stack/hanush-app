import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import { fetchStocksByCategory, type Stock } from "../services/api";

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("Momentum");
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
          const data = await fetchStocksByCategory("Momentum");
          setStocks(
            data.stocks.filter((s: Stock) => starredSymbols.includes(s.symbol))
          );
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

  return (
    <div className="main-layout">
      <Sidebar
        activeCategory={activeTab}
        setActiveCategory={setActiveTab}
        starredCount={starredSymbols.length}
      />

      <div className="content-area">
        {selectedStock ? (
          <div className="detail-container">
            <button className="back-btn" onClick={() => setSelectedStock(null)}>
              <span>←</span> Back to Dashboard
            </button>
            <TradingViewChart symbol={selectedStock} />
            <StockStats symbol={selectedStock} />
          </div>
        ) : activeTab === "Guide" ? (
          <div className="glass-card" style={{ padding: "40px", margin: "40px" }}>
            <h2 className="glow-text">User Guide</h2>
            <p
              style={{
                marginTop: "20px",
                color: "var(--text-dim)",
                lineHeight: "1.6",
              }}
            >
              Welcome to Lightninbull Financial Analytics. This section helps you
              understand the metrics and strategies used in the platform.
            </p>
          </div>
        ) : activeTab === "Profile / Settings" ? (
          <div className="glass-card" style={{ padding: "40px", margin: "40px" }}>
            <h2 className="glow-text">Profile & Settings</h2>
            <p style={{ marginTop: "20px", color: "var(--text-dim)" }}>
              Manage your account preferences and application settings here.
            </p>
          </div>
        ) : (
          <>
            <div className="screener-header">
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
                  <p
                    style={{
                      marginTop: "20px",
                      color: "var(--text-dim)",
                      fontWeight: 500,
                    }}
                  >
                    Loading {activeTab} data...
                  </p>
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
