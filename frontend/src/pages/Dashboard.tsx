import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import PortfolioBacktestPanel from "../components/PortfolioBacktestPanel";
import { fetchStocksByCategory, type Stock } from "../services/api";
import {
  fetchWatchlistSymbols,
  addWatchlistSymbol,
  removeWatchlistSymbol,
} from "../services/watchlistApi";

const NON_FEATURE_TABS = [
  "Watchlist",
  "Guide",
  "Profile / Settings",
  "Portfolio Backtest",
];

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

const MOBILE_BREAKPOINT = 900;

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("Momentum");
  const [previousTab, setPreviousTab] = useState("Watchlist");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [starredSymbols, setStarredSymbols] = useState<string[]>([]);
  const [watchlistBootstrapped, setWatchlistBootstrapped] = useState(false);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);

      if (!mobile) {
        setMobileSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const bootstrapWatchlist = async () => {
      try {
        const symbols = await fetchWatchlistSymbols();
        setStarredSymbols(symbols.map((s) => s.trim().toUpperCase()));
      } catch (error) {
        console.error("Failed to load watchlist from Cloudflare:", error);
        setStarredSymbols([]);
      } finally {
        setWatchlistBootstrapped(true);
      }
    };

    bootstrapWatchlist();
  }, []);

  useEffect(() => {
    const getStocks = async () => {
      if (!watchlistBootstrapped) {
        return;
      }

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
              const normalizedSymbol = stock.symbol.trim().toUpperCase();
              if (!stockMap.has(normalizedSymbol)) {
                stockMap.set(normalizedSymbol, {
                  ...stock,
                  symbol: normalizedSymbol,
                });
              }
            }
          }

          const matchedStocks = starredSymbols
            .map((symbol) => stockMap.get(symbol.trim().toUpperCase()))
            .filter((stock): stock is Stock => Boolean(stock));

          const missingSymbols = starredSymbols.filter(
            (symbol) => !stockMap.has(symbol.trim().toUpperCase())
          );

          const placeholderStocks: Stock[] = missingSymbols.map((symbol, index) => ({
            rank: matchedStocks.length + index + 1,
            symbol,
            sector: "Saved Watchlist",
            score: 0,
            return_1w: null,
            return_1m: null,
            return_3m: null,
            return_6m: null,
            volatility_6m: null,
            volatility_bucket: null,
          }));

          setStocks([...matchedStocks, ...placeholderStocks]);
        } else if (activeTab === "Portfolio Backtest") {
          setStocks([]);
        } else {
          const data = await fetchStocksByCategory(activeTab);
          const normalizedStocks = (data.stocks || []).map((stock: Stock) => ({
            ...stock,
            symbol: stock.symbol.trim().toUpperCase(),
          }));
          setStocks(normalizedStocks);
        }
      } catch (error) {
        console.error(`Failed to load ${activeTab} stocks:`, error);
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };

    getStocks();
  }, [activeTab, starredSymbols, watchlistBootstrapped]);

  useEffect(() => {
    setSelectedStock(null);
  }, [activeTab]);

  const handleCategoryChange = (nextTab: string) => {
    if (nextTab !== activeTab) {
      setPreviousTab(activeTab);
      setActiveTab(nextTab);
    }

    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleStarClick = async (symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    const wasStarred = starredSymbols.includes(normalized);
    const previous = [...starredSymbols];

    const optimistic = wasStarred
      ? starredSymbols.filter((s) => s !== normalized)
      : [...starredSymbols, normalized];

    setStarredSymbols(optimistic);

    try {
      const updated = wasStarred
        ? await removeWatchlistSymbol(normalized)
        : await addWatchlistSymbol(normalized);

      setStarredSymbols(updated.map((s) => s.trim().toUpperCase()));
    } catch (error) {
      console.error("Failed to update Cloudflare watchlist:", error);
      setStarredSymbols(previous);
    }
  };

  const handleStockClick = (symbol: string) => {
    setSelectedStock(symbol);

    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleBackToDashboard = () => {
    if (selectedStock) {
      setSelectedStock(null);

      if (isMobile) {
        setMobileSidebarOpen(true);
      }
      return;
    }

    if (isMobile) {
      setMobileSidebarOpen(true);
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
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="content-area">
        {isMobile && (
          <div className="mobile-topbar">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(true)}
            >
              ☰ Menu
            </button>
          </div>
        )}

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
        ) : activeTab === "Portfolio Backtest" ? (
          <PortfolioBacktestPanel />
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
