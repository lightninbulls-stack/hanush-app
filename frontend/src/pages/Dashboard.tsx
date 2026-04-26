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

const UPSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL";
const DOWNSIDE_STOCK_SIGNAL_KEY = "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL";

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

    const getStocks = async () => {
      if (!watchlistBootstrapped) return;
      if (!activeTab) return;

      setSelectedStock(null);

      if (
        activeTab === "Guide" ||
        activeTab === "Profile / Settings" ||
        activeTab === "Portfolio Backtest" ||
        activeTab === "Bull Call Spreads" ||
        activeTab === "Bear Put Spreads" ||
        activeTab === "Upside Trend Stocks" ||
        activeTab === "Downside Trend Stocks"
      ) {
        setStocks([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        if (activeTab === "Watchlist") {
          const results = await Promise.all(
            WATCHLIST_SOURCE_CATEGORIES.map((category) =>
              fetchStocksByCategory(category)
            )
          );

          if (cancelled) return;

          const watchlistStocks = buildWatchlistStocks(starredSymbols, results);
          setStocks(watchlistStocks);
          return;
        }

        const cached = getCachedStocksByCategory(activeTab);

        if (cached) {
          setStocks(cached.stocks || []);
          return;
        }

        const data = await fetchStocksByCategory(activeTab);

        if (cancelled) return;

        setStocks(data.stocks || []);
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
  }, [activeTab, watchlistBootstrapped, starredSymbols]);

  const handleCategoryChange = (tab: string) => {
    setPreviousTab(activeTab);
    setSelectedStock(null);
    setActiveTab(tab);
  };

  const handleStockClick = (symbol: string) => {
    setSelectedStock(normalizeSymbol(symbol));
  };

  const handleBackToTable = () => {
    setSelectedStock(null);
  };

  const handleStarClick = async (symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    const isAlreadyStarred = starredSymbols.includes(normalized);

    try {
      const updatedSymbols = isAlreadyStarred
        ? await removeWatchlistSymbol(normalized)
        : await addWatchlistSymbol(normalized);

      setStarredSymbols(updatedSymbols.map(normalizeSymbol));

      if (activeTab === "Watchlist" && isAlreadyStarred) {
        setStocks((prev) =>
          prev.filter((stock) => normalizeSymbol(stock.symbol) !== normalized)
        );

        if (selectedStock === normalized) {
          setSelectedStock(null);
        }
      }
    } catch (err) {
      console.error("Failed to update watchlist:", err);
    }
  };

  return (
    <div className="lb-dashboard-shell">
      <Sidebar
        activeCategory={activeTab}
        setActiveCategory={handleCategoryChange}
        starredCount={starredSymbols.length}
      />

      <main className="lb-dashboard-main">
        <div className="lb-topbar">
          <div />
          <button className="lb-gold-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div style={{ padding: "28px" }}>
          {!activeTab && <DashboardWelcome onNavigate={handleCategoryChange} />}

          {activeTab === "Guide" && (
            <DashboardWelcome onNavigate={handleCategoryChange} />
          )}

          {activeTab === "Portfolio Backtest" && <PortfolioBacktestPanel />}

          {activeTab === "Bull Call Spreads" && (
            <IntradaySpreadsPanel spreadType="bull_call" />
          )}

          {activeTab === "Bear Put Spreads" && (
            <IntradaySpreadsPanel spreadType="put_debit" />
          )}

          {activeTab === "Upside Trend Stocks" && (
            <IntradayStockSignalsPanel
              strategyName={UPSIDE_STOCK_SIGNAL_KEY}
              title="Upside Trend Stocks"
              subtitle="Live intraday NSE upside signals"
              emptyMessage="No signals"
            />
          )}

          {activeTab === "Downside Trend Stocks" && (
            <IntradayStockSignalsPanel
              strategyName={DOWNSIDE_STOCK_SIGNAL_KEY}
              title="Downside Trend Stocks"
              subtitle="Live intraday NSE downside signals"
              emptyMessage="No signals"
            />
          )}

          {loading && (
            <div
              style={{
                padding: 24,
                color: "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Loading stocks…
            </div>
          )}

          {!loading && selectedStock && (
            <div>
              <button
                onClick={handleBackToTable}
                style={{
                  marginBottom: 18,
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(250,204,21,0.22)",
                  background: "rgba(250,204,21,0.08)",
                  color: "#facc15",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                ← Back to stocks
              </button>

              <TradingViewChart symbol={selectedStock} />
              <StockStats symbol={selectedStock} />
            </div>
          )}

          {!loading && !selectedStock && stocks.length > 0 && (
            <StockTable
              category={activeTab}
              stocks={stocks}
              starredSymbols={starredSymbols}
              onStarClick={handleStarClick}
              onStockClick={handleStockClick}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
