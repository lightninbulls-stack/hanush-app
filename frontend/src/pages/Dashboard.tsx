import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import IntradaySpreadsPanel from "../components/IntradaySpreadsPanel";
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

  const isSpreadPage =
    activeTab === "Bull Call Spreads" || activeTab === "Bear Put Spreads";

  useEffect(() => {
    localStorage.setItem("starredStocks", JSON.stringify(starredSymbols));
  }, [starredSymbols]);

  useEffect(() => {
    if (isSpreadPage || activeTab === "Guide" || activeTab === "Profile / Settings") {
      setStocks([]);
      setLoading(false);
      return;
    }

    const getStocks = async () => {
      setLoading(true);
      try {
        if (activeTab === "Watchlist") {
          const data = await fetchStocksByCategory("Momentum");
          setStocks((data.stocks || []).filter((s: Stock) => starredSymbols.includes(s.symbol)));
        } else {
          const data = await fetchStocksByCategory(activeTab);
          setStocks(data.stocks || []);
        }
      } catch (error) {
        console.error("Error fetching stocks:", error);
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };

    getStocks();
  }, [activeTab, starredSymbols, isSpreadPage]);

  useEffect(() => {
    setSelectedStock(null);
  }, [activeTab]);

  const handleStarClick = (symbol: string) => {
    setStarredSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const handleStockClick = (symbol: string) => {
    setSelectedStock(symbol);
  };

  const renderMainContent = () => {
    if (selectedStock) {
      return (
        <div style={{ display: "grid", gap: "16px" }}>
          <button
            onClick={() => setSelectedStock(null)}
            style={{
              width: "fit-content",
              border: "none",
              borderRadius: "10px",
              padding: "10px 14px",
              cursor: "pointer",
              background: "rgba(255,255,255,0.08)",
              color: "#f8fafc",
            }}
          >
            ← Back to Dashboard
          </button>
          <TradingViewChart symbol={selectedStock} />
          <StockStats symbol={selectedStock} />
        </div>
      );
    }

    if (activeTab === "Guide") {
      return (
        <div style={panelStyle}>
          <h2 style={titleStyle}>User Guide</h2>
          <p style={subtitleStyle}>
            Welcome to Lightninbull Financial Analytics. This section helps you
            understand the metrics and strategies used in the platform.
          </p>
        </div>
      );
    }

    if (activeTab === "Profile / Settings") {
      return (
        <div style={panelStyle}>
          <h2 style={titleStyle}>Profile & Settings</h2>
          <p style={subtitleStyle}>
            Manage your account preferences and application settings here.
          </p>
        </div>
      );
    }

    if (activeTab === "Bull Call Spreads") {
      return <IntradaySpreadsPanel spreadType="bull_call" />;
    }

    if (activeTab === "Bear Put Spreads") {
      return <IntradaySpreadsPanel spreadType="bear_put" />;
    }

    return (
      <>
        <div style={panelStyle}>
          <h2 style={titleStyle}>{activeTab} Screener</h2>
          <p style={subtitleStyle}>
            Live insights and professional quantitative metrics for {activeTab}
          </p>
        </div>

        {loading ? (
          <div style={{ color: "#cbd5e1" }}>Loading {activeTab} data...</div>
        ) : (
          <StockTable
            category={activeTab}
            stocks={stocks}
            starredSymbols={starredSymbols}
            onStarClick={handleStarClick}
            onStockClick={handleStockClick}
          />
        )}
      </>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(30,41,59,0.9), rgba(2,6,23,1))",
      }}
    >
      <Sidebar
        activeCategory={activeTab}
        setActiveCategory={setActiveTab}
        starredCount={starredSymbols.length}
      />

      <main
        style={{
          padding: "24px",
          display: "grid",
          gap: "18px",
        }}
      >
        {renderMainContent()}
      </main>
    </div>
  );
};

const panelStyle: React.CSSProperties = {
  borderRadius: "18px",
  padding: "18px",
  background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9))",
  border: "1px solid rgba(255,255,255,0.08)",
};

const titleStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "28px",
  fontWeight: 800,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  color: "#94a3b8",
  marginTop: "8px",
  marginBottom: 0,
};

export default Dashboard;
