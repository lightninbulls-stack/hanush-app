import React, { useCallback, useEffect, useRef, useState } from "react";
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
const SIDEBAR_DEFAULT = 240;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 380;

const normalizeSymbol = (value: string): string =>
  String(value || "").trim().toUpperCase();

const buildWatchlistStocks = (
  starredSymbols: string[],
  results: StockCategoryResponse[]
): Stock[] => {
  const stockMap = new Map<string, Stock>();

  for (const result of results) {
    for (const stock of result?.stocks || []) {
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
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("");
  const [previousTab, setPreviousTab] = useState("");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [starredSymbols, setStarredSymbols] = useState<string[]>([]);
  const [watchlistBootstrapped, setWatchlistBootstrapped] = useState(false);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.innerWidth <= MOBILE_BREAKPOINT
      : false
  );

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(SIDEBAR_DEFAULT);
  const resizerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      isDragging.current = true;
      dragStartX.current = event.clientX;
      dragStartW.current = sidebarWidth;

      if (resizerRef.current) {
        resizerRef.current.classList.add("dragging");
      }

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      event.preventDefault();
    },
    [sidebarWidth]
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging.current) return;

      const delta = event.clientX - dragStartX.current;
      const nextWidth = Math.max(
        SIDEBAR_MIN,
        Math.min(SIDEBAR_MAX, dragStartW.current + delta)
      );

      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;

      isDragging.current = false;

      if (resizerRef.current) {
        resizerRef.current.classList.remove("dragging");
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

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

    const loadStocks = async () => {
      if (!watchlistBootstrapped) return;

      if (!activeTab) {
        setStocks([]);
        setLoading(false);
        return;
      }

      if (activeTab === "Watchlist") {
        if (starredSymbols.length === 0) {
          setStocks([]);
          setLoading(false);
          return;
        }

        try {
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

          if (!cancelled) {
            setStocks(
              buildWatchlistStocks(starredSymbols, [
                ...cachedResults,
                ...fetchedResults,
              ])
            );
          }
        } catch {
          if (!cancelled) {
            setStocks([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }

        return;
      }

      if (
        [
          "Portfolio Backtest",
          "Bull Call Spreads",
          "Bear Put Spreads",
          "Upside Trend Stocks",
          "Downside Trend Stocks",
          "Guide",
          "Profile / Settings",
        ].includes(activeTab)
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

      try {
        const data = await fetchStocksByCategory(activeTab);

        if (!cancelled) {
          setStocks(data.stocks || []);
        }
      } catch {
        if (!cancelled) {
          setStocks([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadStocks();

    return () => {
      cancelled = true;
    };
  }, [activeTab, starredSymbols, watchlistBootstrapped]);

  useEffect(() => {
    setSelectedStock(null);
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const handleCategoryChange = (nextTab: string) => {
    if (nextTab !== activeTab) {
      setPreviousTab(activeTab);
      setActiveTab(nextTab);
      setSelectedStock(null);
    }

    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleStarClick = async (symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    const wasStarred = starredSymbols.includes(normalized);
    const previousSymbols = [...starredSymbols];

    const nextSymbols = wasStarred
      ? starredSymbols.filter((item) => item !== normalized)
      : [...starredSymbols, normalized];

    setStarredSymbols(Array.from(new Set(nextSymbols.map(normalizeSymbol))));

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

        if (selectedStock === normalized) {
          setSelectedStock(null);
        }
      }
    } catch {
      setStarredSymbols(previousSymbols);
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

  const showFeatureBackButton =
    !selectedStock && activeTab && !NON_FEATURE_TABS.includes(activeTab);

  return (
    <div className="lb-dashboard-shell">
      <div
        style={
          isMobile
            ? {}
            : {
                width: sidebarWidth,
                minWidth: SIDEBAR_MIN,
                maxWidth: SIDEBAR_MAX,
                flexShrink: 0,
              }
        }
      >
        <Sidebar
          activeCategory={activeTab}
          setActiveCategory={handleCategoryChange}
          starredCount={starredSymbols.length}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          sidebarWidth={isMobile ? undefined : sidebarWidth}
        />
      </div>

      {!isMobile && (
        <div
          ref={resizerRef}
          className="lb-resizer"
          onMouseDown={onMouseDown}
          title="Drag to resize sidebar"
        />
      )}

      <div className="lb-dashboard-main">
        <div className="lb-topbar">
          {isMobile ? (
            <button
              className="lb-ghost-button"
              onClick={() => setMobileSidebarOpen(true)}
            >
              ☰ Menu
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--lb-green)",
                  boxShadow: "0 0 6px rgba(34,197,94,0.6)",
                }}
              />

              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--lb-text-m)",
                }}
              >
                Live
              </span>
            </div>
          )}

          <button className="lb-gold-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="lb-content-area">
          {!activeTab ? (
            <DashboardWelcome onNavigate={handleCategoryChange} />
          ) : selectedStock ? (
            <>
              <button
                className="lb-ghost-button"
                onClick={handleBackToDashboard}
                style={{ marginBottom: 16 }}
              >
                ← Back
              </button>

              <TradingViewChart symbol={selectedStock} />
              <StockStats symbol={selectedStock} />
            </>
          ) : activeTab === "Guide" ? (
            <DashboardWelcome onNavigate={handleCategoryChange} />
          ) : activeTab === "Profile / Settings" ? (
            <div className="lb-card" style={{ maxWidth: 680 }}>
              <div className="lb-eyebrow" style={{ marginBottom: 12 }}>
                Account
              </div>

              <h2 className="lb-section-title" style={{ marginBottom: 8 }}>
                Profile &amp; Settings
              </h2>

              <p className="lb-text">Manage your account preferences here.</p>
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
                  className="lb-ghost-button"
                  onClick={handleBackToDashboard}
                  style={{ marginBottom: 16 }}
                >
                  ← Back
                </button>
              )}

              <div className="lb-page-heading">
                <div className="lb-eyebrow" style={{ marginBottom: 6 }}>
                  Quant Screener
                </div>

                <h2 className="lb-section-title">{activeTab}</h2>

                <p className="lb-section-desc">
                  Live quantitative metrics &amp; model insights
                </p>
              </div>

              {loading ? (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--lb-text-m)",
                    padding: "32px 0",
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
