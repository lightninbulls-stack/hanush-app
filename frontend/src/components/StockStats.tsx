import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../pages/PlatformShell.css";

type StockInfo = {
  symbol: string;
  name?: string;
  sector?: string;
  market_cap?: number | null;
  pe_ratio?: number | null;
  high_52w?: number | null;
  low_52w?: number | null;
  summary?: string | null;
  price?: number | null;
  change_pct?: number | null;
};

type StatTileProps = {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatPrice(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRatio(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(2);
}

function formatMarketCap(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const abs = Math.abs(value);

  if (abs >= 1e7) {
    return `₹${(value / 1e7).toFixed(2)} Cr`;
  }

  if (abs >= 1e5) {
    return `₹${(value / 1e5).toFixed(2)} Lakh`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatChangePct(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function cleanSymbol(symbol?: string): string {
  if (!symbol) return "—";
  return symbol.replace(".NS", "").replace(".BSE", "");
}

function StatTile({ label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="lb-stockstats-tile">
      <span className="lb-stockstats-tile-label">{label}</span>
      <strong className={`lb-stockstats-tile-value ${tone}`}>{value}</strong>
    </div>
  );
}

const StockStats: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const fetchInfo = async () => {
      setLoading(true);

      try {
        const response = await axios.get<StockInfo>(
          `${API_BASE_URL}/stocks/info/${symbol}`
        );

        if (mounted) {
          setInfo(response.data);
        }
      } catch (error) {
        console.error("Error fetching stock info:", error);
        if (mounted) {
          setInfo(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchInfo();

    return () => {
      mounted = false;
    };
  }, [symbol]);

  const rangePosition = useMemo(() => {
    if (
      info?.price === null ||
      info?.price === undefined ||
      info?.high_52w === null ||
      info?.high_52w === undefined ||
      info?.low_52w === null ||
      info?.low_52w === undefined
    ) {
      return null;
    }

    const range = info.high_52w - info.low_52w;
    if (range <= 0) {
      return null;
    }

    const raw = ((info.price - info.low_52w) / range) * 100;
    return Math.max(0, Math.min(100, raw));
  }, [info]);

  const tone = useMemo<"default" | "positive" | "negative">(() => {
    const val = info?.change_pct;
    if (val === null || val === undefined || Number.isNaN(val)) {
      return "default";
    }
    if (val > 0) return "positive";
    if (val < 0) return "negative";
    return "default";
  }, [info]);

  if (loading) {
    return (
      <div className="lb-stockstats-card">
        <div className="lb-stockstats-loading">
          <div className="lb-eyebrow">Fundamentals</div>
          <h3>Analyzing fundamentals...</h3>
          <p>Fetching company profile, valuation, and price-range context.</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="lb-stockstats-card">
        <div className="lb-stockstats-loading">
          <div className="lb-eyebrow">Fundamentals</div>
          <h3>No data available</h3>
          <p>We could not load the company fundamentals for this symbol.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lb-stockstats-card">
      <div className="lb-stockstats-header">
        <div>
          <div className="lb-eyebrow">Fundamental Snapshot</div>
          <h3 className="lb-stockstats-name">{info.name || cleanSymbol(info.symbol)}</h3>
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

      <div className="lb-stockstats-price-block">
        <span className="lb-stockstats-price-label">Current Price</span>
        <strong className="lb-stockstats-price">{formatPrice(info.price)}</strong>
      </div>

      <div className="lb-stockstats-grid">
        <StatTile label="Market Cap" value={formatMarketCap(info.market_cap)} />
        <StatTile label="P/E Ratio" value={formatRatio(info.pe_ratio)} />
        <StatTile label="52W High" value={formatPrice(info.high_52w)} />
        <StatTile label="52W Low" value={formatPrice(info.low_52w)} />
      </div>

      <div className="lb-stockstats-range-card">
        <div className="lb-stockstats-range-head">
          <span>52-Week Range</span>
          <span>
            {formatPrice(info.low_52w)} — {formatPrice(info.high_52w)}
          </span>
        </div>

        <div className="lb-stockstats-range-bar">
          <div
            className="lb-stockstats-range-marker"
            style={{
              left: rangePosition !== null ? `${rangePosition}%` : "0%",
            }}
          />
        </div>

        <div className="lb-stockstats-range-foot">
          <span>Low</span>
          <span>Current</span>
          <span>High</span>
        </div>
      </div>

      {info.summary ? (
        <div className="lb-stockstats-summary">
          <div className="lb-stockstats-section-title">Business Overview</div>
          <p>
            {info.summary.length > 700
              ? `${info.summary.slice(0, 700)}...`
              : info.summary}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default StockStats;
