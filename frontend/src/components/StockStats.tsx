import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

type StockInfo = {
  symbol:      string;
  name?:       string;
  sector?:     string;
  market_cap?: number | null;
  pe_ratio?:   number | null;
  high_52w?:   number | null;
  low_52w?:    number | null;
  summary?:    string | null;
  price?:      number | null;
  change_pct?: number | null;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatPrice(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(value);
}

function formatRatio(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(2);
}

function formatMarketCap(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} Lakh`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(value);
}

function formatChangePct(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function cleanSymbol(symbol?: string): string {
  if (!symbol) return "—";
  return symbol.replace(".NS", "").replace(".BSE", "");
}

const StockStats: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [info,    setInfo]    = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    axios
      .get<StockInfo>(`${API_BASE_URL}/stocks/info/${symbol}`)
      .then((res) => {
        if (mounted) setInfo(res.data);
      })
      .catch(() => {
        if (mounted) setInfo(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [symbol]);

  const rangePosition = useMemo(() => {
    if (
      info?.price == null || info?.high_52w == null || info?.low_52w == null
    ) return null;
    const range = info.high_52w - info.low_52w;
    if (range <= 0) return null;
    return Math.max(0, Math.min(100, ((info.price - info.low_52w) / range) * 100));
  }, [info]);

  const tone = useMemo<"positive" | "negative" | "default">(() => {
    const val = info?.change_pct;
    if (val == null || Number.isNaN(val)) return "default";
    if (val > 0) return "positive";
    if (val < 0) return "negative";
    return "default";
  }, [info]);

  if (loading) {
    return (
      <div className="lb-stockstats-card">
        <div className="lb-eyebrow" style={{ marginBottom: 16 }}>Fundamentals</div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24,
            fontWeight: 300,
            color: "var(--lb-cream)",
            margin: "0 0 8px",
          }}
        >
          Analyzing fundamentals…
        </h3>
        <p className="lb-text">
          Fetching company profile, valuation, and price-range context.
        </p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="lb-stockstats-card">
        <div className="lb-eyebrow" style={{ marginBottom: 16 }}>Fundamentals</div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24,
            fontWeight: 300,
            color: "var(--lb-cream)",
            margin: "0 0 8px",
          }}
        >
          No data available
        </h3>
        <p className="lb-text">
          We could not load the company fundamentals for this symbol.
        </p>
      </div>
    );
  }

  const tiles = [
    { label: "Market Cap", value: formatMarketCap(info.market_cap) },
    { label: "P/E Ratio",  value: formatRatio(info.pe_ratio)       },
    { label: "52W High",   value: formatPrice(info.high_52w)        },
    { label: "52W Low",    value: formatPrice(info.low_52w)         },
  ];

  return (
    <div className="lb-stockstats-card">
      {/* Header */}
      <div className="lb-stockstats-header">
        <div>
          <div className="lb-eyebrow" style={{ marginBottom: 8 }}>
            Fundamental Snapshot
          </div>
          <h3 className="lb-stockstats-name">
            {info.name || cleanSymbol(info.symbol)}
          </h3>
          <div className="lb-stockstats-subline">
            <span>{cleanSymbol(info.symbol)}</span>
            <span className="lb-stockstats-dot">•</span>
            <span>{info.sector || "Sector not available"}</span>
          </div>
        </div>

        <div className={`lb-stockstats-change ${tone}`}>
          {formatChangePct(info.change_pct)}
        </div>
      </div>

      {/* Current price */}
      <div className="lb-stockstats-price-block">
        <span className="lb-stockstats-price-label">Current Price</span>
        <strong className="lb-stockstats-price">{formatPrice(info.price)}</strong>
      </div>

      {/* Stat tiles */}
      <div className="lb-stockstats-grid">
        {tiles.map((t) => (
          <div key={t.label} className="lb-stockstats-tile">
            <span className="lb-stockstats-tile-label">{t.label}</span>
            <strong className="lb-stockstats-tile-value">{t.value}</strong>
          </div>
        ))}
      </div>

      {/* 52-week range */}
      <div className="lb-range-card">
        <div className="lb-range-head">
          <span>52-Week Range</span>
          <span>
            {formatPrice(info.low_52w)} — {formatPrice(info.high_52w)}
          </span>
        </div>
        <div className="lb-range-bar">
          <div
            className="lb-range-marker"
            style={{ left: rangePosition !== null ? `${rangePosition}%` : "0%" }}
          />
        </div>
        <div className="lb-range-foot">
          <span>Low</span>
          <span>Current</span>
          <span>High</span>
        </div>
      </div>

      {/* Business summary */}
      {info.summary && (
        <div>
          <div
            className="lb-eyebrow"
            style={{ marginBottom: 10, color: "rgba(255,255,255,0.3)" }}
          >
            Business Overview
          </div>
          <p className="lb-summary-text">
            {info.summary.length > 700
              ? `${info.summary.slice(0, 700)}…`
              : info.summary}
          </p>
        </div>
      )}
    </div>
  );
};

export default StockStats;
