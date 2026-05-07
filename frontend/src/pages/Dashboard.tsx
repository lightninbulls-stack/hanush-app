import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import StockTable from "../components/StockTable";
import TradingViewChart from "../components/TradingViewChart";
import StockStats from "../components/StockStats";
import PortfolioBacktestPanel from "../components/PortfolioBacktestPanelGate";
import IntradaySpreadsPanel from "../components/IntradaySpreadsPanel";
import IntradayStockSignalsPanel from "../components/IntradayStockSignalsPanel";
import DashboardWelcome from "../components/DashboardWelcome";
import AiMarketMentor from "../components/AiMarketMentor";


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
  WATCHLIST_UPDATED_EVENT,
} from "../services/watchlistApi";

import {
  fetchSubscriptionStatus,
  getCachedSubscriptionStatus,
  fetchUserProfile,
  type SubscriptionStatus,
  type UserProfile,
} from "../services/subscriptionApi";

const UPSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL";
const DOWNSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL";
const NSE_TOP_200_FO_CATEGORY = "NSE TOP 200 F&O Universe";

const FREE_STOCK_LIMIT = 2;
const FREE_LOCKED_PREVIEW_LIMIT = 3;
const FREE_WATCHLIST_ADD_LIMIT = 4;

const PREMIUM_LOCKED_TABS = [
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
  NSE_TOP_200_FO_CATEGORY,
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

  // Initialise from localStorage cache so isPremium is correct on first render,
  // no flash of "non-premium" while the API call is in-flight.
  const [subscription, setSubscription] = useState<SubscriptionStatus>(
    getCachedSubscriptionStatus
  );

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const isPremium = subscription.is_active;

  const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

  const loadApiKey = async () => {
    setApiKeyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/auth/me/api-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setApiKey(json.api_key ?? null);
    } catch {
      // silently ignore
    } finally {
      setApiKeyLoading(false);
    }
  };

  const regenerateApiKey = async () => {
    setApiKeyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/auth/me/regenerate-api-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setApiKey(json.api_key ?? null);
    } catch {
      // silently ignore
    } finally {
      setApiKeyLoading(false);
    }
  };

  const copyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

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
        const status = await fetchSubscriptionStatus(); // also writes to localStorage cache
        setSubscription(status);
      } catch {
        // API failed — keep whatever is already in state (loaded from cache above)
      }
    };

    const loadProfile = async () => {
      try {
        const profile = await fetchUserProfile();
        setUserProfile(profile);
      } catch {
        // silently ignore — profile is non-critical
      }
    };

    loadSubscription();
    loadProfile();
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
    const handleWatchlistUpdated = async () => {
      try {
        const symbols = await fetchWatchlistSymbols();
        setStarredSymbols(symbols.map(normalizeSymbol));
      } catch {
        setStarredSymbols([]);
      }
    };

    window.addEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdated);
    window.addEventListener("storage", handleWatchlistUpdated);

    return () => {
      window.removeEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdated);
      window.removeEventListener("storage", handleWatchlistUpdated);
    };
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

    if (!wasStarred && !isPremium && starredSymbols.length >= FREE_WATCHLIST_ADD_LIMIT) {
      window.alert(
        `Free users can add up to ${FREE_WATCHLIST_ADD_LIMIT} stocks to Watchlist. Upgrade to add more stocks.`
      );
      navigate("/pricing");
      return;
    }

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

  const handleBulkAddToWatchlist = (symbols: string[]) => {
    const normalized = symbols.map(normalizeSymbol);
    setStarredSymbols((prev) =>
      Array.from(new Set([...prev, ...normalized]))
    );
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

  const visibleStocks = isPremium
    ? stocks
    : stocks.slice(0, FREE_LOCKED_PREVIEW_LIMIT);

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
        Free users can explore the top {FREE_STOCK_LIMIT} stock ideas with one locked preview.
        Subscribe to unlock all stocks, intraday option spreads, and intraday stock signals.
      </p>

      <button className="lb-gold-button" onClick={() => navigate("/pricing")}>
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
          Showing Top {FREE_STOCK_LIMIT} Stocks + 1 Locked Preview
        </h3>

        <p className="lb-text" style={{ marginBottom: 18 }}>
          Subscribe to unlock the complete list of {stocks.length} stocks,
          premium signals, and full dashboard features.
        </p>

        <button className="lb-gold-button" onClick={() => navigate("/pricing")}>
          Unlock Full List
        </button>
      </div>
    );
  };

  const WatchlistLimitBanner = () => {
    if (isPremium) return null;
    if (activeTab !== "Watchlist") return null;
    if (starredSymbols.length < FREE_WATCHLIST_ADD_LIMIT) return null;

    return (
      <div
        className="lb-card"
        style={{
          marginTop: 20,
          padding: 20,
          border: "1px solid rgba(250,204,21,0.35)",
          background:
            "linear-gradient(135deg, rgba(250,204,21,0.08), rgba(0,0,0,0.45))",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#facc15",
            marginBottom: 6,
            letterSpacing: 1,
          }}
        >
          WATCHLIST LIMIT REACHED
        </div>

        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          You’ve reached your free limit ({FREE_WATCHLIST_ADD_LIMIT} stocks)
        </div>

        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 16,
          }}
        >
          Upgrade to track more opportunities.
        </div>

        <button className="lb-gold-button" onClick={() => navigate("/pricing")}>
          Upgrade to Premium
        </button>
      </div>
    );
  };

  return (
    <div className="lb-dashboard-shell">
      <AiMarketMentor
        onNavigate={handleCategoryChange}
        starredSymbols={starredSymbols}
        onBulkAddToWatchlist={handleBulkAddToWatchlist}
        isPremium={isPremium}
      />
      {!isMobile && (
        <Sidebar
          activeCategory={activeTab}
          setActiveCategory={handleCategoryChange}
          starredCount={starredSymbols.length}
          isPremium={isPremium}
          daysLeft={subscription.days_left}
        />
      )}

      {isMobile && (
        <Sidebar
          activeCategory={activeTab}
          setActiveCategory={handleCategoryChange}
          starredCount={starredSymbols.length}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          isPremium={isPremium}
          daysLeft={subscription.days_left}
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
              <button className="lb-gold-button" onClick={() => navigate("/pricing")}>
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
                  view the top {FREE_STOCK_LIMIT} stocks plus one locked preview from each model.
                  Premium users unlock the full dashboard, option spreads, and intraday signals.
                  Equal weight portfolio backtesting is available for every user.
                </p>
              </div>
            </>
          ) : activeTab === "Profile / Settings" ? (
            <div style={{ maxWidth: 520 }}>
              <div className="lb-eyebrow" style={{ marginBottom: 12 }}>Account</div>
              <h2 className="lb-title" style={{ fontSize: 28, marginBottom: 24 }}>
                Profile
              </h2>

              {/* User info card */}
              <div style={{
                background: "rgba(8,9,12,0.96)",
                border: "1px solid rgba(250,204,21,0.12)",
                borderRadius: 16,
                padding: "28px 28px 24px",
                marginBottom: 16,
              }}>
                {/* Avatar initial */}
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "linear-gradient(135deg,#facc15,#d6a21f)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 600,
                    color: "#1a1200", flexShrink: 0,
                  }}>
                    {(userProfile?.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 300, color: "var(--lb-cream)" }}>
                      {userProfile?.name ?? "—"}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
                      Member since {userProfile?.member_since ?? "—"}
                    </div>
                  </div>
                </div>

                {/* Fields */}
                {[
                  { label: "NAME", value: userProfile?.name ?? "—" },
                  { label: "EMAIL", value: userProfile?.email ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex", flexDirection: "column", gap: 4,
                    padding: "14px 0",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "rgba(250,204,21,0.55)", textTransform: "uppercase" }}>
                      {label}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                      {value}
                    </span>
                  </div>
                ))}

                {/* Subscription badge */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: 4,
                  padding: "14px 0",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "rgba(250,204,21,0.55)", textTransform: "uppercase" }}>
                    SUBSCRIPTION
                  </span>
                  {isPremium ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 14px", borderRadius: 99,
                        background: "rgba(74,222,128,0.1)",
                        border: "1px solid rgba(74,222,128,0.3)",
                        fontFamily: "var(--font-mono)", fontSize: 11,
                        color: "#4ade80", letterSpacing: 0.5,
                      }}>
                        ● Premium Active
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.38)" }}>
                        {subscription.days_left} days left
                        {subscription.valid_till ? ` · expires ${new Date(subscription.valid_till).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 14px", borderRadius: 99,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        fontFamily: "var(--font-mono)", fontSize: 11,
                        color: "rgba(255,255,255,0.38)", letterSpacing: 0.5,
                      }}>
                        ○ Free Plan
                      </span>
                      <button className="lb-gold-button" onClick={() => navigate("/pricing")}
                        style={{ padding: "5px 16px", fontSize: 11 }}>
                        Upgrade to Premium
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* API Key section — premium only */}
              {isPremium && (
                <div style={{
                  background: "rgba(8,9,12,0.96)",
                  border: "1px solid rgba(250,204,21,0.12)",
                  borderRadius: 16,
                  padding: "24px 28px",
                  marginBottom: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "rgba(250,204,21,0.55)", textTransform: "uppercase" }}>
                      Signal API Key
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 0.5 }}>
                      Premium
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.7, margin: "0 0 14px" }}>
                    Use this key to access live BUY / SHORT signals via the LightninBull API from your own trading system.
                  </p>

                  {apiKey ? (
                    <>
                      {/* Key display */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "#0a0b0e", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8, padding: "10px 14px", marginBottom: 12,
                      }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 12,
                          color: "#facc15", flex: 1, wordBreak: "break-all",
                        }}>
                          {apiKey}
                        </span>
                        <button
                          onClick={copyApiKey}
                          style={{
                            background: apiKeyCopied ? "rgba(74,222,128,0.12)" : "rgba(250,204,21,0.08)",
                            border: apiKeyCopied ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(250,204,21,0.2)",
                            color: apiKeyCopied ? "#4ade80" : "#facc15",
                            fontFamily: "var(--font-mono)", fontSize: 10,
                            padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                            whiteSpace: "nowrap", transition: "all 0.2s",
                          }}
                        >
                          {apiKeyCopied ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          onClick={regenerateApiKey}
                          disabled={apiKeyLoading}
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.38)",
                            fontFamily: "var(--font-mono)", fontSize: 10,
                            padding: "6px 14px", borderRadius: 6,
                            cursor: apiKeyLoading ? "not-allowed" : "pointer",
                            letterSpacing: 0.5,
                          }}
                        >
                          {apiKeyLoading ? "Regenerating…" : "Regenerate key"}
                        </button>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.22)", alignSelf: "center" }}>
                          Regenerating invalidates your old key immediately.
                        </span>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={loadApiKey}
                      disabled={apiKeyLoading}
                      style={{
                        background: "rgba(250,204,21,0.08)",
                        border: "1px solid rgba(250,204,21,0.25)",
                        color: "#facc15",
                        fontFamily: "var(--font-mono)", fontSize: 11,
                        padding: "8px 20px", borderRadius: 8,
                        cursor: apiKeyLoading ? "not-allowed" : "pointer",
                        letterSpacing: 0.5,
                      }}
                    >
                      {apiKeyLoading ? "Loading…" : "Reveal API Key"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : isLockedPremiumTab ? (
            <PremiumLockCard />
          ) : activeTab === "Portfolio Backtest" ? (
            <PortfolioBacktestPanel isPremium={isPremium} />
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
                    : `Free preview: top ${FREE_STOCK_LIMIT} stocks + 1 locked preview from ${activeTab}`}
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
                    lockedFromIndex={isPremium ? undefined : FREE_STOCK_LIMIT}
                    onUnlockClick={() => navigate("/pricing")}
                  />

                  <FreeLimitCard />
                  <WatchlistLimitBanner />
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
