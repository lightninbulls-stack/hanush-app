import React, { useMemo } from "react";

export type PnlPoint = {
  time: string;
  value: number;
};

type Props = {
  data: PnlPoint[];
  target: number;
  stopLoss: number;
  zeroLine?: number;
  height?: number;
};

type XYPoint = {
  x: number;
  y: number;
};

const CHART_WIDTH = 1200;
const PADDING = {
  top: 30,
  right: 30,
  bottom: 55,
  left: 70,
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

function makeSnakeScales(points: XYPoint[]) {
  const scales: Array<{
    cx: number;
    cy: number;
    angle: number;
    rx: number;
    ry: number;
  }> = [];

  if (points.length < 2) return scales;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const density = Math.max(2, Math.floor(len / 10));

    for (let j = 0; j < density; j++) {
      const t = j / density;
      const cx = prev.x + dx * t;
      const cy = prev.y + dy * t;

      const pulse = 1 + 0.12 * Math.sin((i + j) * 0.9);

      scales.push({
        cx,
        cy,
        angle,
        rx: 8 * pulse,
        ry: 5.2 * pulse,
      });
    }
  }

  return scales;
}

export default function SnakePnlChart({
  data,
  target,
  stopLoss,
  zeroLine = 0,
  height = 420,
}: Props) {
  const { points, yTicks, zeroY, targetY, stopLossY, pathD } = useMemo(() => {
    const values = data.map((d) => d.value);

    const minVal = Math.min(...values, stopLoss, zeroLine, 0);
    const maxVal = Math.max(...values, target, zeroLine, 0);

    const span = Math.max(1, maxVal - minVal);
    const paddedMin = minVal - span * 0.15;
    const paddedMax = maxVal + span * 0.15;

    const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;

    const mapX = (index: number) =>
      PADDING.left + (index / Math.max(1, data.length - 1)) * innerWidth;

    const mapY = (value: number) =>
      PADDING.top + (1 - (value - paddedMin) / (paddedMax - paddedMin)) * innerHeight;

    const points = data.map((d, i) => ({
      x: mapX(i),
      y: mapY(d.value),
    }));

    const yTicks = Array.from({ length: 6 }, (_, i) => {
      const v = paddedMin + ((paddedMax - paddedMin) * i) / 5;
      return {
        value: v,
        y: mapY(v),
      };
    });

    return {
      points,
      yTicks,
      zeroY: mapY(zeroLine),
      targetY: mapY(target),
      stopLossY: mapY(stopLoss),
      pathD: buildSmoothPath(points),
    };
  }, [data, target, stopLoss, zeroLine, height]);

  const scales = useMemo(() => makeSnakeScales(points), [points]);
  const lastPoint = points[points.length - 1];
  const lastValue = data[data.length - 1]?.value ?? 0;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Snake PnL chart"
    >
      <defs>
        <linearGradient id="snakeGoldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9f6a10" />
          <stop offset="20%" stopColor="#c8921f" />
          <stop offset="50%" stopColor="#f3cf69" />
          <stop offset="80%" stopColor="#c8921f" />
          <stop offset="100%" stopColor="#8c5e0e" />
        </linearGradient>

        <linearGradient id="snakeShine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,248,220,0.95)" />
          <stop offset="100%" stopColor="rgba(255,248,220,0.05)" />
        </linearGradient>

        <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="
              1 0 0 0 0
              0 0.84 0 0 0
              0 0 0.18 0 0
              0 0 0 1 0"
          />
        </filter>

        <filter id="snakeTexture" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="2"
            seed="5"
            result="noise"
          />
          <feBlend in="SourceGraphic" in2="noise" mode="soft-light" />
        </filter>

        <filter id="snakeShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#d4a73d" floodOpacity="0.35" />
          <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#d4a73d" floodOpacity="0.14" />
        </filter>
      </defs>

      {yTicks.map((tick, idx) => (
        <g key={idx}>
          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={tick.y}
            y2={tick.y}
            stroke="rgba(212, 167, 61, 0.09)"
            strokeWidth="1"
          />
          <text
            x={10}
            y={tick.y + 4}
            fill="rgba(255,255,255,0.45)"
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
        stroke="rgba(255, 125, 125, 0.7)"
        strokeWidth="1.2"
        strokeDasharray="5 5"
      />

      <line
        x1={PADDING.left}
        x2={CHART_WIDTH - PADDING.right}
        y1={targetY}
        y2={targetY}
        stroke="rgba(54, 214, 130, 0.8)"
        strokeWidth="1.2"
      />

      <line
        x1={PADDING.left}
        x2={CHART_WIDTH - PADDING.right}
        y1={stopLossY}
        y2={stopLossY}
        stroke="rgba(255, 106, 106, 0.8)"
        strokeWidth="1.2"
      />

      <path
        d={pathD}
        fill="none"
        stroke="rgba(212,167,61,0.18)"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#goldGlow)"
      />

      <path
        d={pathD}
        fill="none"
        stroke="url(#snakeGoldGradient)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#snakeShadow)"
      />

      {scales.map((scale, idx) => (
        <g
          key={idx}
          transform={`translate(${scale.cx}, ${scale.cy}) rotate(${scale.angle})`}
          opacity="0.96"
          filter="url(#snakeTexture)"
        >
          <ellipse
            cx="0"
            cy="0"
            rx={scale.rx}
            ry={scale.ry}
            fill="url(#snakeGoldGradient)"
            stroke="rgba(255,230,155,0.35)"
            strokeWidth="0.7"
          />
          <ellipse
            cx="-1.2"
            cy="-1.2"
            rx={scale.rx * 0.5}
            ry={scale.ry * 0.28}
            fill="rgba(255,245,210,0.45)"
          />
        </g>
      ))}

      <path
        d={pathD}
        fill="none"
        stroke="url(#snakeShine)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />

      {lastPoint && (
        <>
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={8}
            fill="#f3cf69"
            filter="url(#goldGlow)"
          />
          <text
            x={lastPoint.x + 12}
            y={lastPoint.y - 10}
            fill="#f6d36f"
            fontSize="14"
            fontWeight="700"
          >
            ₹{lastValue.toFixed(2)}
          </text>
        </>
      )}

      {data.map((point, index) => {
        const p = points[index];
        if (!p) return null;

        const shouldShow =
          index === 0 ||
          index === data.length - 1 ||
          index % Math.max(1, Math.floor(data.length / 6)) === 0;

        if (!shouldShow) return null;

        return (
          <text
            key={`${point.time}-${index}`}
            x={p.x}
            y={height - 16}
            textAnchor="middle"
            fill="rgba(255,255,255,0.42)"
            fontSize="12"
          >
            {point.time}
          </text>
        );
      })}
    </svg>
  );
}
