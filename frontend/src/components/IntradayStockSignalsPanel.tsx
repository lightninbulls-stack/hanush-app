import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAllIntradaySpreads,
  type IntradaySpread,
  type StockSignalRow,
} from "../services/intradaySpreads";

type Props = {
  strategyName: string;
  title: string;
  subtitle: string;
  emptyMessage: string;
};

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return Number(value).toFixed(2);
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return `${Number(value).toFixed(2)}%`;
}

function formatUpdatedAt(value?: string) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return value;
  }
}

function getTopCapture(signals: StockSignalRow[]) {
  const entered = signals.filter(
    (s) =>
      s.signal_status === "ENTERED" &&
      s.points_captured !== null &&
      s.points_captured !== undefined
  );

  if (entered.length === 0) return null;

  return [...entered].sort(
    (a, b) => (b.points_captured || 0) - (a.points_captured || 0)
  )[0];
}

const cardStyle: React.CSSProperties = {
  borderRadius: "30px",
  padding: "28px",
  background: "#000000",
  border: "1px solid rgba(244, 208, 111, 0.20)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
  color: "#ffffff",
};

const chipStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(244, 208, 111, 0.14)",
  color: "#e5e7eb",
  fontSize: "14px",
  minWidth: "145px",
};

const headerValueStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#9ca3af",
};

const tableHeaderStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontWeight: 600,
  fontSize: "13px",
  color: "#9ca3af",
  textAlign: "left",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  fontSize: "14px",
  color: "#e5e7eb",
};

const IntradayStockSignalsPanel: React.FC<Props> = ({
  strategyName,
  title,
  subtitle,
  emptyMessage,
}) => {
  const [spread, setSpread] = useState<IntradaySpread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    const load = async () => {
      try {
        const data = await fetchAllIntradaySpreads();
        if (!isMounted) return;

        const selected = data?.[strategyName] || null;
        setSpread(selected);
        setError("");
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setError("Unable to fetch intraday stock signals.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    intervalId = window.setInterval(load, 1500);

    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [strategyName]);

  const signals = useMemo<StockSignalRow[]>(() => {
    const rows = [...(spread?.signals || [])];

    return rows.sort((a, b) => {
      const aEntered = a.signal_status === "ENTERED" ? 0 : 1;
      const bEntered = b.signal_status === "ENTERED" ? 0 : 1;

      if (aEntered !== bEntered) return aEntered - bEntered;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [spread]);

  const enteredCount =
    spread?.entered_count ??
    signals.filter((s) => s.signal_status === "ENTERED").length;

  const totalCount = spread?.total_count ?? signals.length;

  const bestCapture = getTopCapture(signals);

  const isDownside = strategyName.includes("DOWNSIDE");

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "38px", fontWeight: 800 }}>
            {title}
          </h2>
          <div style={{ marginTop: 8, color: "#d1d5db", fontSize: 15 }}>
            {subtitle}
          </div>
          <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 13 }}>
            {spread?.strategy_name || strategyName}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              color:
                spread?.status === "RUNNING"
                  ? "#22c55e"
                  : spread?.status === "ERROR"
                  ? "#ef4444"
                  : "#f59e0b",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {spread?.status || "WAITING"}
          </div>
          <div style={headerValueStyle}>
            Updated: {formatUpdatedAt(spread?.updated_at)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={chipStyle}>Entered: {enteredCount}</div>
        <div style={chipStyle}>Total Stocks: {totalCount}</div>
        <div style={chipStyle}>
          Best Capture:{" "}
          {bestCapture
            ? `${bestCapture.symbol} (${formatPrice(
                bestCapture.points_captured
              )})`
            : "--"}
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: "red" }}>{error}</div>
      ) : (
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Trading Symbol</th>
              <th style={tableHeaderStyle}>Status</th>
              <th style={tableHeaderStyle}>Entry Time</th>
              <th style={tableHeaderStyle}>Avg Price</th>
              <th style={tableHeaderStyle}>Current LTP</th>
              <th style={tableHeaderStyle}>
                {isDownside ? "Min LTP" : "Max LTP"}
              </th>
              <th style={tableHeaderStyle}>Points</th>
              <th style={tableHeaderStyle}>%</th>
            </tr>
          </thead>

          <tbody>
            {signals.map((row) => (
              <tr key={row.instrument_token}>
                <td style={tableCellStyle}>{row.symbol}</td>
                <td style={tableCellStyle}>{row.signal_status}</td>
                <td style={tableCellStyle}>{row.entry_time}</td>
                <td style={tableCellStyle}>{formatPrice(row.avg_price)}</td>
                <td style={tableCellStyle}>
                  {formatPrice(row.current_ltp)}
                </td>

                <td style={tableCellStyle}>
                  {formatPrice(
                    isDownside
                      ? row.min_ltp ?? row.favorable_price ?? row.max_ltp
                      : row.max_ltp ?? row.favorable_price
                  )}
                </td>

                <td style={tableCellStyle}>
                  {formatPrice(row.points_captured)}
                </td>
                <td style={tableCellStyle}>
                  {formatPercent(row.pct_captured)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default IntradayStockSignalsPanel;
