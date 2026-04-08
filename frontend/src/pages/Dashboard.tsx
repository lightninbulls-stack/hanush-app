import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import PortfolioBacktestPanel from "../components/PortfolioBacktestPanel";
import {
  fetchStocksByCategory,
  getCachedStocksByCategory,
  type Stock,
  type StockCategoryResponse,
} from "../services/api";
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

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

const buildWatchlistStocks = (
  starredSymbols: string[],
  results: StockCategoryResponse[]
): Stock[] => {
  const stockMap = new Map<string, Stock>();

  for (const result of results) {
    const categoryStocks: Stock[] = result?.stocks || [];
    for (const stock of categoryStocks) {
      const normalized = normalizeSymbol(stock.symbol);
      if (!stockMap.has(normalized)) {
        stockMap.set(normalized, {
          ...stock,
          symbol: normalized,
        });
      }
    }
  }

  const matchedStocks = starredSymbols
    .map((symbol) => stockMap.get(normalizeSymbol(symbol)))
    .filter((stock): stock is Stock => Boolean(stock));

  const missingSymbols = starredSymbols.filter(
    (symbol) => !stockMap.has(normalizeSymbol(symbol))
  );

  const placeholderStocks: Stock[] = missingSymbols.map((symbol, index) => ({
    rank: matchedStocks.length + index + 1,
    symbol: normalizeSymbol(symbol),
    sector: "Saved Watchlist",
    score: 0,
    return_1w: null,
    return_1m: null,
    return_3m: null,
    return_6m: null,
    volatility_6m: null,
    volatility_bucket: null,
  }));

  return [...matchedStocks, ...placeholderStocks];
};

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
        setStarredSymbols(symbols.map((s) => normalizeSymbol(s)));
      } catch (error) {
        console.error("Failed to load watchlist from localStorage:", error);
        setStarredSymbols([]);
      } finally {
        setWatchlistBootstrapped(true);
      }
    };

    bootstrapWatchlist();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const getStocks = async () => {
      if (!watchlistBootstrapped) {
        return;
      }

      try {
        if (activeTab === "Watchlist") {
          if (starredSymbols.length === 0) {
            setStocks([]);
            setLoading(false);
            return;
          }

          const cachedResults = WATCHLIST_SOURCE_CATEGORIES.map((category) =>
            getCachedStocksByCategory(category)
          ).filter(
            (result): result is StockCategoryResponse => Boolean(result)
          );

          if (cachedResults.length > 0) {
            setStocks(buildWatchlistStocks(starredSymbols, cachedResults));
          }

          const missingCategories = WATCHLIST_SOURCE_CATEGORIES.filter(
            (category) => !getCachedStocksByCategory(category)
          );

          if (missingCategories.length === 0) {
            setLoading(false);
            return;
          }

          setLoading(cachedResults.length === 0);

          const fetchedResults = await Promise.all(
            missingCategories.map((category) => fetchStocksByCategory(category))
          );

          if (cancelled) {
            return;
          }

          const combinedResults = [...cachedResults, ...fetchedResults];
          setStocks(buildWatchlistStocks(starredSymbols, combinedResults));
          return;
        }

        if (activeTab === "Portfolio Backtest") {
          setStocks([]);
          setLoading(false);
          return;
        }

        const cached = getCachedStocksByCategory(activeTab);
        if (cached) {
          setStocks(cached.stocks || []);
          setLoading(false);
          return;
        }

        setLoading(true);
        const data = await fetchStocksByCategory(activeTab);

        if (cancelled) {
          return;
        }

        setStocks(data.stocks || []);
      } catch (error) {
        console.error(`Failed to load ${activeTab} stocks:`, error);
        if (!cancelled) {
          setStocks([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    getStocks();

    return () => {
      cancelled = true;
    };
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
    const normalized = normalizeSymbol(symbol);
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

      setStarredSymbols(updated.map((s) => normalizeSymbol(s)));
    } catch (error) {
      console.error("Failed to update localStorage watchlist:", error);
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
