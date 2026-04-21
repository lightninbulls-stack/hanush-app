import React from "react";

export type PnlPoint = {
  time: string;
  value: number;
};

type Props = {
  data?: PnlPoint[];
  target?: number;
  stopLoss?: number;
  zeroLine?: number;
  height?: number;
};

const CHART_WIDTH = 1200;

const PADDING = {
  top: 24,
  right: 24,
  bottom: 52,
  left: 72,
};

type XYPoint = {
  x: number;
  y: number;
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

export default function SnakePnlChart({
  data = [],
  zeroLine = 0,
  height = 420,
}: Props) {
  const safeData = data ?? [];

  const values =
    safeData.length > 0 ? safeData.map((d) => d.value) : [zeroLine];

  const minVal = Math.min(...values, zeroLine);
  const maxVal = Math.max(...values, zeroLine);
  const span = Math.max(1, maxVal - minVal);

  const paddedMin = minVal - span * 0.2 - 10;
  const paddedMax = maxVal + span * 0.2 + 10;

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
    y: mapY(d.value),
  }));

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = paddedMin + ((paddedMax - paddedMin) * i) / 4;
    return {
      value,
      y: mapY(value),
    };
  });

  const zeroY = mapY(zeroLine);
  const pathD = buildSmoothPath(points);
  const lastPoint = points[points.length - 1];
  const lastValue = safeData[safeData.length - 1]?.value ?? 0;

  return (
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
          <stop offset="0%" stopColor="rgba(56,189,248,0.25)" />
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
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.2"
        strokeDasharray="5 5"
      />

      {points.length > 1 && (
        <>
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${height - PADDING.bottom} L ${points[0].x} ${height - PADDING.bottom} Z`}
            fill="url(#pnlAreaGradient)"
          />

          <path
            d={pathD}
            fill="none"
            stroke="rgba(56,189,248,0.14)"
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
  );
}
