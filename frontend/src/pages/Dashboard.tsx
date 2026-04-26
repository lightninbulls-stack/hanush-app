import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import PortfolioBacktestPanel from "../components/PortfolioBacktestPanel";
import IntradaySpreadsPanel from "../components/IntradaySpreadsPanel";
import IntradayStockSignalsPanel from "../components/IntradayStockSignalsPanel";
import DashboardWelcome from "../components/DashboardWelcome";

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

import {
  fetchSubscriptionStatus,
  type SubscriptionStatus,
} from "../services/subscriptionApi";

const UPSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL";
const DOWNSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL";

const FREE_STOCK_LIMIT = 3;

const PREMIUM_LOCKED_TABS = [
  "Portfolio Backtest",
  "Bull Call Spreads",
  "Bear Put Spreads",
  "Upside Trend Stocks",
  "Downside Trend Stocks",
];

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
  "Consistent Trending",
  "Slow Movement",
  "Cheap Value",
  "Best Quality",
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
        stockMap.set(normalized, { ...stock, symbol: normalized });
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
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    is_active: false,
    valid_till: null,
    days_left: 0,
  });

  const isPremium = subscription.is_active;

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const [activeTab, setActiveTab] = useState("");
  const [previousTab, setPreviousTab] = useState("");
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
    const loadSubscription = async () => {
      try {
        const status = await fetchSubscriptionStatus();
        setSubscription(status);
      } catch {
        setSubscription({
          is_active: false,
          valid_till: null,
          days_left: 0,
        });
      }
    };

    loadSubscription();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setMobileSidebarOpen(false);
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const bootstrapWatchlist = async () => {
      try {
        const symbols = await fetchWatchlistSymbols();
        setStarredSymbols(symbols.map(normalizeSymbol));
      } catch {
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
      if (!watchlistBootstrapped) return;

      if (!activeTab) {
        setStocks([]);
        setLoading(false);
        return;
      }

      try {
        if (activeTab === "Watchlist") {
          if (starredSymbols.length === 0) {
            setStocks([]);
            setLoading(false);
            return;
          }

          const cachedResults = WATCHLIST_SOURCE_CATEGORIES.map((cat) =>
            getCachedStocksByCategory(cat)
          ).filter((r): r is StockCategoryResponse => Boolean(r));

          if (cachedResults.length > 0) {
            setStocks(buildWatchlistStocks(starredSymbols, cachedResults));
          }

          const missingCategories = WATCHLIST_SOURCE_CATEGORIES.filter(
            (cat) => !getCachedStocksByCategory(cat)
          );

          if (missingCategories.length === 0) {
            setLoading(false);
            return;
          }

          setLoading(cachedResults.length === 0);

          const fetchedResults = await Promise.all(
            missingCategories.map((cat) => fetchStocksByCategory(cat))
          );

          if (cancelled) return;

          setStocks(
            buildWatchlistStocks(starredSymbols, [
              ...cachedResults,
              ...fetchedResults,
            ])
          );

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

        if (cancelled) return;

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

    setStarredSymbols(Array.from(new Set(optimistic.map(normalizeSymbol))));

    try {
      if (wasStarred) {
        await removeWatchlistSymbol(normalized);
      } else {
        await addWatchlistSymbol(normalized);
      }

      if (activeTab === "Watchlist" && wasStarred) {
        setStocks((prev) =>
          prev.filter((stock) => normalizeSymbol(stock.symbol) !== normalized)
        );
      }
    } catch (error) {
      console.error("Failed to update watchlist:", error);
      setStarredSymbols(previous);
    }
  };

  const handleStockClick = (symbol: string) => {
    setSelectedStock(normalizeSymbol(symbol));
  };

  const handleBackToDashboard = () => {
    if (selectedStock) {
      setSelectedStock(null);
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

    setActiveTab("");
  };

  const isLockedPremiumTab =
    !isPremium && PREMIUM_LOCKED_TABS.includes(activeTab);

  const visibleStocks = isPremium ? stocks : stocks.slice(0, FREE_STOCK_LIMIT);

  const showFeatureBackButton =
    !selectedStock && activeTab && !NON_FEATURE_TABS.includes(activeTab);

  const PremiumLockCard = () => (
    <div className="lb-card" style={{ maxWidth: 760, padding: 30 }}>
      <div className="lb-eyebrow" style={{ marginBottom: 14 }}>
        Premium Feature
      </div>

      <h2 className="lb-title" style={{ fontSize: 32, marginBottom: 12 }}>
        Unlock Full Quant Dashboard
      </h2>

      <p className="lb-text" style={{ marginBottom: 20 }}>
        Free users can explore the top 3 stock ideas. Subscribe to unlock all
        stocks, intraday option spreads, intraday stock signals, and portfolio
        backtesting.
      </p>

      <button
        className="lb-gold-button"
        onClick={() => navigate("/pricing")}
      >
        Unlock Premium
      </button>
    </div>
  );

  const FreeLimitCard = () => {
    if (isPremium || stocks.length <= FREE_STOCK_LIMIT) return null;

    return (
      <div
        className="lb-card"
        style={{
          marginTop: 20,
          padding: 24,
          border: "1px solid rgba(226,184,75,0.28)",
          background:
            "linear-gradient(135deg, rgba(226,184,75,0.10), rgba(0,0,0,0.45))",
        }}
      >
        <div className="lb-eyebrow" style={{ marginBottom: 10 }}>
          Free Preview
        </div>

        <h3 className="lb-title" style={{ fontSize: 24, marginBottom: 8 }}>
          Showing Top {FREE_STOCK_LIMIT} Stocks Only
        </h3>

        <p className="lb-text" style={{ marginBottom: 18 }}>
          Subscribe to unlock the complete list of {stocks.length} stocks,
          premium signals, and full dashboard features.
        </p>

        <button
          className="lb-gold-button"
          onClick={() => navigate("/pricing")}
        >
          Unlock Full List
        </button>
      </div>
    );
  };

  return (
    <div className="lb-dashboard-shell">
      {!isMobile && (
        <Sidebar
          activeCategory={activeTab}
          setActiveCategory={handleCategoryChange}
          starredCount={starredSymbols.length}
        />
      )}

      {isMobile && (
        <Sidebar
          activeCategory={activeTab}
          setActiveCategory={handleCategoryChange}
          starredCount={starredSymbols.length}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      )}

      <main className="lb-dashboard-main">
        <div className="lb-topbar">
          {isMobile ? (
            <button
              className="lb-ghost-button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰ Menu
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {!isPremium && (
              <button
                className="lb-gold-button"
                onClick={() => navigate("/pricing")}
              >
                Upgrade
              </button>
            )}

            {isPremium && (
              <span
                style={{
                  color: "#66ffb2",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              >
                Premium Active • {subscription.days_left} days left
              </span>
            )}

            <button className="lb-gold-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div
          style={{
            padding: isMobile ? "20px 16px" : "28px 28px 28px 24px",
            boxSizing: "border-box",
          }}
        >
          {!activeTab ? (
            <DashboardWelcome onNavigate={handleCategoryChange} />
          ) : selectedStock ? (
            <>
              <button
                className="lb-ghost-button"
                onClick={handleBackToDashboard}
                style={{ marginBottom: 20 }}
              >
                ← Back
              </button>

              <TradingViewChart symbol={selectedStock} />
              <StockStats symbol={selectedStock} />
            </>
          ) : activeTab === "Guide" ? (
            <>
              <DashboardWelcome onNavigate={handleCategoryChange} />

              <div className="lb-card" style={{ maxWidth: 720, marginTop: 24 }}>
                <div className="lb-eyebrow" style={{ marginBottom: 16 }}>
                  Guide
                </div>

                <h2 className="lb-title" style={{ fontSize: 32, marginBottom: 12 }}>
                  User Guide
                </h2>

                <p className="lb-text">
                  Welcome to Lightninbull Financial Analytics. Free users can
                  view the top 3 stocks from each model. Premium users unlock
                  the full dashboard, option spreads, intraday signals, and
                  portfolio backtesting.
                </p>
              </div>
            </>
          ) : activeTab === "Profile / Settings" ? (
            <div className="lb-card" style={{ maxWidth: 720 }}>
              <div className="lb-eyebrow" style={{ marginBottom: 16 }}>
                Account
              </div>

              <h2 className="lb-title" style={{ fontSize: 32, marginBottom: 12 }}>
                Profile &amp; Settings
              </h2>

              <p className="lb-text">
                Manage your account preferences and application settings here.
              </p>

              <div style={{ marginTop: 20 }}>
                {isPremium ? (
                  <p style={{ color: "#66ffb2" }}>
                    Premium subscription active. Days left:{" "}
                    {subscription.days_left}
                  </p>
                ) : (
                  <button
                    className="lb-gold-button"
                    onClick={() => navigate("/pricing")}
                  >
                    Upgrade to Premium
                  </button>
                )}
              </div>
            </div>
          ) : isLockedPremiumTab ? (
            <PremiumLockCard />
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
                  className="lb-ghost-button"
                  onClick={handleBackToDashboard}
                  style={{ marginBottom: 20 }}
                >
                  ← Back
                </button>
              )}

              <div style={{ marginBottom: 24 }}>
                <div className="lb-eyebrow" style={{ marginBottom: 8 }}>
                  Quant Screener
                </div>

                <h2 className="lb-title" style={{ fontSize: 28, marginBottom: 6 }}>
                  {activeTab}
                </h2>

                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.38)",
                    margin: 0,
                  }}
                >
                  {isPremium
                    ? `Full premium list for ${activeTab}`
                    : `Free preview: top ${FREE_STOCK_LIMIT} stocks from ${activeTab}`}
                </p>
              </div>

              {loading ? (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.4)",
                    padding: "40px 0",
                  }}
                >
                  Loading {activeTab} data…
                </div>
              ) : stocks.length === 0 ? (
                <div
                  className="lb-card"
                  style={{
                    padding: 28,
                    color: "rgba(255,255,255,0.45)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  No stocks available for {activeTab}.
                </div>
              ) : (
                <>
                  <StockTable
                    category={activeTab}
                    stocks={visibleStocks}
                    starredSymbols={starredSymbols}
                    onStarClick={handleStarClick}
                    onStockClick={handleStockClick}
                  />

                  <FreeLimitCard />
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
