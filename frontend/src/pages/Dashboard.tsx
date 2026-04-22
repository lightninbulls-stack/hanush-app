import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import PortfolioBacktestPanel from "../components/PortfolioBacktestPanel";
import IntradaySpreadsPanel from "../components/IntradaySpreadsPanel";
import IntradayStockSignalsPanel from "../components/IntradayStockSignalsPanel";
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

const UPSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL";
const DOWNSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL";

const NON_FEATURE_TABS = [
  "Watchlist",
  "Guide",
  "Profile / Settings",
  "Portfolio Backtest",
  "Bull Call Spreads",
  "Bear Put Spreads",
  "Upside Trend Stocks",
  "Downside Trend Stocks",
];

const WATCHLIST_SOURCE_CATEGORIES = [
  "Momentum",
  "Low Vol",
  "Value",
  "Quality",
  "Regime Upside",
  "Regime Downside",
  "Range Bound Upside",
  "Range Bound Downside",
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
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
          ).filter((result): result is StockCategoryResponse => Boolean(result));

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

        if (
          activeTab === "Portfolio Backtest" ||
          activeTab === "Bull Call Spreads" ||
          activeTab === "Bear Put Spreads" ||
          activeTab === "Upside Trend Stocks" ||
          activeTab === "Downside Trend Stocks" ||
          activeTab === "Guide" ||
          activeTab === "Profile / Settings"
        ) {
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
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#020617",
        color: "#ffffff",
      }}
    >
      {!isMobile && (
        <div
          style={{
            width: 320,
            minWidth: 320,
            borderRight: "1px solid rgba(148,163,184,0.08)",
          }}
        >
          <Sidebar
            activeCategory={activeTab}
            setActiveCategory={handleCategoryChange}
            starredCount={starredSymbols.length}
          />
        </div>
      )}

      {isMobile && mobileSidebarOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(2,6,23,0.72)",
            display: "flex",
          }}
        >
          <div
            style={{
              width: 320,
              maxWidth: "86vw",
              height: "100%",
              background: "#020617",
              borderRight: "1px solid rgba(148,163,184,0.08)",
            }}
          >
            <Sidebar
              activeCategory={activeTab}
              setActiveCategory={handleCategoryChange}
              starredCount={starredSymbols.length}
              isMobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
          </div>

          <div
            style={{ flex: 1 }}
            onClick={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      <main
        style={{
          flex: 1,
          padding: isMobile ? "16px" : "24px",
          overflowX: "hidden",
        }}
      >
        {isMobile && (
          <button
            onClick={() => setMobileSidebarOpen(true)}
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              background: "#0f172a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ☰ Menu
          </button>
        )}

        {selectedStock ? (
          <>
            <button
              onClick={handleBackToDashboard}
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.2)",
                background: "#0f172a",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ← Back to Dashboard
            </button>

            <TradingViewChart symbol={selectedStock} />

            <div style={{ marginTop: 20 }}>
              <StockStats symbol={selectedStock} />
            </div>
          </>
        ) : activeTab === "Guide" ? (
          <div style={{ color: "#fff" }}>
            <h2>User Guide</h2>
            <p>
              Welcome to Lightninbull Financial Analytics. This section helps you
              understand the metrics and strategies used in the platform.
            </p>
          </div>
        ) : activeTab === "Profile / Settings" ? (
          <div style={{ color: "#fff" }}>
            <h2>Profile & Settings</h2>
            <p>Manage your account preferences and application settings here.</p>
          </div>
        ) : activeTab === "Portfolio Backtest" ? (
          <PortfolioBacktestPanel />
        ) : activeTab === "Bull Call Spreads" ? (
          <IntradaySpreadsPanel spreadType="bull_call" />
        ) : activeTab === "Bear Put Spreads" ? (
          <IntradaySpreadsPanel spreadType="put_debit" />
        ) : activeTab === "Upside Trend Stocks" ? (
          <IntradayStockSignalsPanel
            strategyName={UPSIDE_STOCK_SIGNAL_KEY}
            title="Upside Trend Stocks"
            subtitle="Live intraday NSE cash-equity upside trend signals."
            emptyMessage="No upside trend stock signals available yet."
          />
        ) : activeTab === "Downside Trend Stocks" ? (
          <IntradayStockSignalsPanel
            strategyName={DOWNSIDE_STOCK_SIGNAL_KEY}
            title="Downside Trend Stocks"
            subtitle="Live intraday NSE cash-equity downside trend signals."
            emptyMessage="No downside trend stock signals available yet."
          />
        ) : (
          <>
            {showFeatureBackButton && (
              <button
                onClick={handleBackToDashboard}
                style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "#0f172a",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                ← Back to Dashboard
              </button>
            )}

            <div style={{ marginBottom: 18, color: "#fff" }}>
              <h2 style={{ marginBottom: 6 }}>{activeTab} Screener</h2>
              <p style={{ color: "#cbd5e1" }}>
                Live insights and professional quantitative metrics for {activeTab}
              </p>
            </div>

            {loading ? (
              <div style={{ color: "#cbd5e1" }}>
                Loading {activeTab} data...
              </div>
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
        )}
      </main>
    </div>
  );
};

export default Dashboard;
