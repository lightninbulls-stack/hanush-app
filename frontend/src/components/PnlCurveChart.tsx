import React from "react";

type PnlPoint = {
  time: string;
  pnl: number;
  stop_loss?: number;
  target?: number;
  drawdown?: number;
};

type Props = {
  data: PnlPoint[];
  entryMarkerTime?: string | null;
};

type XYPoint = {
  x: number;
  y: number;
};

const CHART_WIDTH = 1200;

const PADDING = {
  top: 24,
  right: 24,
  bottom: 52,
  left: 72,
};

function buildSmoothPath(points: XYPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

export default function PnlCurveChart({ data }: Props) {
  const safeData = data ?? [];
  if (safeData.length === 0) return null;

  const pnlValues = safeData.map((d) => d.pnl ?? 0);

  const latestTarget =
    safeData[safeData.length - 1]?.target ??
    safeData.find((d) => d.target !== undefined)?.target ??
    3000;

  const latestStopLoss =
    safeData[safeData.length - 1]?.stop_loss ??
    safeData.find((d) => d.stop_loss !== undefined)?.stop_loss ??
    -1500;

  const allValues = [...pnlValues, latestTarget, latestStopLoss, 0];

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const span = Math.max(1, maxVal - minVal);

  const paddedMin = minVal - span * 0.08;
  const paddedMax = maxVal + span * 0.08;

  const height = 320;
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;

  const mapX = (index: number) =>
    PADDING.left +
    (index / Math.max(1, safeData.length - 1 || 1)) * innerWidth;

  const mapY = (value: number) =>
    PADDING.top +
    (1 - (value - paddedMin) / (paddedMax - paddedMin || 1)) * innerHeight;

  const points: XYPoint[] = safeData.map((d, i) => ({
    x: mapX(i),
    y: mapY(d.pnl ?? 0),
  }));

  const yTicks = Array.from({ length: 6 }, (_, i) => {
    const value = paddedMin + ((paddedMax - paddedMin) * i) / 5;
    return {
      value,
      y: mapY(value),
    };
  });

  const zeroY = mapY(0);
  const targetY = mapY(latestTarget);
  const stopLossY = mapY(latestStopLoss);

  const pathD = buildSmoothPath(points);
  const lastPoint = points[points.length - 1];
  const lastValue = safeData[safeData.length - 1]?.pnl ?? 0;

  return (
    <div
      style={{
        marginTop: "18px",
        padding: "14px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="PnL line chart"
      >
        <defs>
          <linearGradient id="pnlLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>

          <linearGradient id="pnlAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(56,189,248,0.18)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.02)" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={PADDING.left}
              x2={CHART_WIDTH - PADDING.right}
              y1={tick.y}
              y2={tick.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
            <text
              x={PADDING.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              fill="rgba(255,255,255,0.42)"
              fontSize="12"
            >
              {tick.value.toFixed(0)}
            </text>
          </g>
        ))}

        <line
          x1={PADDING.left}
          x2={CHART_WIDTH - PADDING.right}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.2"
          strokeDasharray="5 5"
        />

        <line
          x1={PADDING.left}
          x2={CHART_WIDTH - PADDING.right}
          y1={targetY}
          y2={targetY}
          stroke="#22c55e"
          strokeWidth="2"
        />

        <line
          x1={PADDING.left}
          x2={CHART_WIDTH - PADDING.right}
          y1={stopLossY}
          y2={stopLossY}
          stroke="#ef4444"
          strokeWidth="2"
        />

        <text
          x={CHART_WIDTH - PADDING.right - 6}
          y={targetY - 8}
          textAnchor="end"
          fill="#22c55e"
          fontSize="12"
          fontWeight="700"
        >
          Target ₹{latestTarget.toFixed(2)}
        </text>

        <text
          x={CHART_WIDTH - PADDING.right - 6}
          y={stopLossY - 8}
          textAnchor="end"
          fill="#ef4444"
          fontSize="12"
          fontWeight="700"
        >
          Stop Loss ₹{latestStopLoss.toFixed(2)}
        </text>

        {points.length > 1 && (
          <>
            <path
              d={`${pathD} L ${points[points.length - 1].x} ${height - PADDING.bottom} L ${points[0].x} ${height - PADDING.bottom} Z`}
              fill="url(#pnlAreaGradient)"
            />

            <path
              d={pathD}
              fill="none"
              stroke="rgba(56,189,248,0.12)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d={pathD}
              fill="none"
              stroke="url(#pnlLineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {lastPoint && (
          <>
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="5"
              fill="#7dd3fc"
            />
            <text
              x={lastPoint.x + 10}
              y={lastPoint.y - 10}
              fill="#7dd3fc"
              fontSize="13"
              fontWeight="700"
            >
              ₹{lastValue.toFixed(2)}
            </text>
          </>
        )}

        {safeData.map((point, index) => {
          const p = points[index];
          if (!p) return null;

          const shouldShow =
            index === 0 ||
            index === safeData.length - 1 ||
            index % Math.max(1, Math.floor(safeData.length / 6)) === 0;

          if (!shouldShow) return null;

          return (
            <text
              key={`${point.time}-${index}`}
              x={p.x}
              y={height - 16}
              textAnchor="middle"
              fill="rgba(255,255,255,0.38)"
              fontSize="11"
            >
              {point.time}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
