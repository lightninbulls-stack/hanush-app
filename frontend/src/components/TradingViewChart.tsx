import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import axios from "axios";

interface TradingViewChartProps {
  symbol: string;
}

const API_BASE_URL      = import.meta.env.VITE_API_URL || "http://localhost:8000";
const IST_OFFSET_SECONDS = 5.5 * 60 * 60;

const timeframes = [
  { label: "5M",  value: "5m"  },
  { label: "15M", value: "15m" },
  { label: "1H",  value: "1h"  },
  { label: "1D",  value: "1d"  },
  { label: "1W",  value: "1wk" },
  { label: "1MO", value: "1mo" },
];

const monthNames = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const isIntradayInterval = (interval: string) =>
  interval === "5m" || interval === "15m" || interval === "1h";

const pad2 = (v: number) => v.toString().padStart(2, "0");

const toTimestampSeconds = (time: unknown): number => {
  if (typeof time === "number") return time;
  if (typeof time === "string") return Math.floor(new Date(time).getTime() / 1000);
  if (
    time && typeof time === "object" &&
    "year" in time && "month" in time && "day" in time
  ) {
    const d = time as { year: number; month: number; day: number };
    return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 1000);
  }
  return 0;
};

const getIstDate = (time: unknown): Date => {
  const ts = toTimestampSeconds(time);
  return new Date((ts + IST_OFFSET_SECONDS) * 1000);
};

const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const [interval, setInterval] = useState("1d");

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container  = chartContainerRef.current;
    const isIntraday = isIntradayInterval(interval);

    const chart = createChart(container, {
      width:  container.clientWidth,
      height: 520,
      layout: {
        background: { type: ColorType.Solid, color: "#05070a" },
        textColor: "rgba(255,255,255,0.65)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: isIntraday,
        secondsVisible: false,
        tickMarkFormatter: (time: unknown) => {
          const d = getIstDate(time);
          if (isIntraday) {
            const hh = pad2(d.getUTCHours());
            const mm = pad2(d.getUTCMinutes());
            if (hh === "09" && mm === "15") return `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`;
            return `${hh}:${mm}`;
          }
          const day   = d.getUTCDate();
          const month = monthNames[d.getUTCMonth()];
          const year  = d.getUTCFullYear();
          if (interval === "1d")  return day === 1 ? `${month} ${year}` : `${day}`;
          if (interval === "1wk") return `${month} ${day}`;
          return `${month} ${year}`;
        },
      },
      localization: {
        timeFormatter: (time: unknown) => {
          const d    = getIstDate(time);
          const yyyy = d.getUTCFullYear();
          const mm   = pad2(d.getUTCMonth() + 1);
          const dd   = pad2(d.getUTCDate());
          if (isIntraday) {
            const hh  = pad2(d.getUTCHours());
            const min = pad2(d.getUTCMinutes());
            return `${yyyy}-${mm}-${dd} ${hh}:${min} IST`;
          }
          return `${yyyy}-${mm}-${dd}`;
        },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(197,160,89,0.5)",  width: 1, style: 2, labelBackgroundColor: "#c5a059" },
        horzLine: { color: "rgba(197,160,89,0.5)",  width: 1, style: 2, labelBackgroundColor: "#c5a059" },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor:        "#19f59a",
      downColor:      "#ff6262",
      borderVisible:  false,
      wickUpColor:    "#19f59a",
      wickDownColor:  "#ff6262",
      priceLineVisible: true,
      priceLineColor:   "#c5a059",
    });

    chartRef.current = chart;

    const fetchData = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/stocks/history/${symbol}?interval=${interval}`
        );
        const history = response.data || [];
        const processed = history
          .map((d: Record<string, unknown>) => {
            let time: UTCTimestamp;
            if (typeof d.time === "string") {
              time = Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp;
            } else if (typeof d.time === "number") {
              time = d.time as UTCTimestamp;
            } else {
              return null;
            }
            return {
              time,
              open:  Number(d.open),
              high:  Number(d.high),
              low:   Number(d.low),
              close: Number(d.close),
            };
          })
          .filter(Boolean)
          .sort((a: { time: number }, b: { time: number }) => a.time - b.time);

        if (processed.length > 0) {
          series.setData(processed as Parameters<typeof series.setData>[0]);
          chart.timeScale().fitContent();
        }
      } catch (err) {
        console.error("Error fetching chart data:", err);
      }
    };

    fetchData();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol, interval]);

  const displayName = symbol.replace(".NS", "").replace(".BSE", "");

  return (
    <div className="tv-card">
      {/* Top bar */}
      <div className="tv-topbar">
        <div className="tv-symbol-block">
          <div className="tv-symbol-name">{displayName}</div>
          <div className="tv-symbol-badge">NSE</div>
        </div>

        <div className="tv-timeframes">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              className={`tv-time-btn${interval === tf.value ? " active" : ""}`}
              onClick={() => setInterval(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={chartContainerRef} className="tv-chart-area" />
    </div>
  );
};

export default TradingViewChart;
