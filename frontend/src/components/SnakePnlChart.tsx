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

    const density = Math.max(2, Math.floor(len / 8)); // Slightly higher density

    for (let j = 0; j < density; j++) {
      const t = j / density;
      const cx = prev.x + dx * t;
      const cy = prev.y + dy * t;

      const pulse = 1 + 0.12 * Math.sin((i + j) * 0.9);

      scales.push({
        cx,
        cy,
        angle,
        rx: 8 * pulse, // Increased scale size slightly
        ry: 5.2 * pulse,
      });
    }
  }

  return scales;
}

export default function DeepFocusSnakePnlChart({
  data,
  target,
  stopLoss,
  zeroLine = 0,
  height = 420,
}: Props) {
  const safeData = data ?? [];

  const { points, yTicks, zeroY, targetY, stopLossY, pathD } = useMemo(() => {
    const values =
      safeData.length > 0 ? safeData.map((d) => d.value) : [0, target, stopLoss];

    const minVal = Math.min(...values, stopLoss, zeroLine, 0);
    const maxVal = Math.max(...values, target, zeroLine, 0);

    const span = Math.max(1, maxVal - minVal);
    const paddedMin = minVal - span * 0.15;
    const paddedMax = maxVal + span * 0.15;

    const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;

    const mapX = (index: number) =>
      PADDING.left + (index / Math.max(1, safeData.length - 1 || 1)) * innerWidth;

    const mapY = (value: number) =>
      PADDING.top + (1 - (value - paddedMin) / (paddedMax - paddedMin)) * innerHeight;

    const points = safeData.map((d, i) => ({
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
  }, [safeData, target, stopLoss, zeroLine, height]);

  const scales = useMemo(() => makeSnakeScales(points), [points]);
  const lastPoint = points[points.length - 1];
  const lastValue = safeData[safeData.length - 1]?.value ?? 0;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Deep-textured Snake PnL chart"
    >
      <defs>
        {/* NEW DEPTH GRADIENT: Replaces the flat scale color to define body volume */}
        <linearGradient id="snakeGoldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#9f6a10" />
          <stop offset="20%" stopColor="#c8921f" />
          <stop offset="50%" stopColor="#f3cf69" />
          <stop offset="80%" stopColor="#c8921f" />
          <stop offset="100%" stopColor="#8c5e0e" />
        </linearGradient>

        {/* NEW TOP HIGHLIGHT GRADIENT: Used for the body cylinder sheen */}
        <linearGradient id="snakeCylinderHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,248,220,0.8)" />
          <stop offset="100%" stopColor="rgba(255,248,220,0.0)" />
        </linearGradient>

        {/* NEW INTERNAL SCALE DEPTH GRADIENT: Gives individual scales a 3D effect */}
        <linearGradient id="scaleDepth" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffd261" />
          <stop offset="70%" stopColor="#9e660e" />
          <stop offset="100%" stopColor="#ffd261" />
        </linearGradient>

        {/* REMOVED: goldGlow (The source of the flat white layer) */}

        {/* NEW VOLUME FILTER: Deepens textures, creates a realistic 3D body volume */}
        <filter id="snakeVolume3D" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
          <feSpecularLighting in="blur" surfaceScale="7" specularConstant="0.95" specularExponent="22" lightingColor="#ffffff" result="spec">
            <fePointLight x="-5000" y="-10000" z="20000" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut" />
          <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litBody"/>
          <feBlend in="litBody" in2="SourceGraphic" mode="soft-light" />
        </filter>

        {/* TEXTURE: Noisy overlay on the scales */}
        <filter id="scaleNoisyTexture" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="5" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="soft-light" />
        </filter>

        {/* SHADOW: Deep shadow to lift the snake off the grid */}
        <filter id="snakeBodyDeepShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#d4a73d" floodOpacity="0.45" />
          <feDropShadow dx="0" dy="0" stdDeviation="16" floodColor="#b38421" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Grid rendering (unchanged) */}
      {yTicks.map((tick, idx) => (
        <g key={idx}>
          <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={tick.y} y2={tick.y} stroke="rgba(212, 167, 61, 0.09)" strokeWidth="1" />
          <text x={10} y={tick.y + 4} fill="rgba(255,255,255,0.45)" fontSize="12">{tick.value.toFixed(0)}</text>
        </g>
      ))}

      {/* Threshold lines (unchanged) */}
      <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={zeroY} y2={zeroY} stroke="rgba(255, 125, 125, 0.7)" strokeWidth="1.2" strokeDasharray="5 5" />
      <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={targetY} y2={targetY} stroke="rgba(54, 214, 130, 0.8)" strokeWidth="1.2" />
      <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={stopLossY} y2={stopLossY} stroke="rgba(255, 106, 106, 0.8)" strokeWidth="1.2" />

      {/* --- REORDERED PATH RENDERING TO FOCUS ON BODY PART --- */}

      {/* 1. Base PnL Path for Deep Shadow (Now has a slightly desaturated color) */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(179, 132, 33, 0.35)" // Deepened base color
        strokeWidth="22" // Thicker stroke for body part focus
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#snakeBodyDeepShadow)"
      />

      {/* 2. SCALE RENDERING (Now the primary depth layer) */}
      {scales.map((scale, idx) => (
        <g
          key={idx}
          transform={`translate(${scale.cx}, ${scale.cy}) rotate(${scale.angle})`}
          opacity="0.98"
          filter="url(#scaleNoisyTexture)" // Apply texture to scales
        >
          {/* Main Scale - Replaced flat fill with internal depth gradient */}
          <ellipse
            cx="0" cy="0"
            rx={scale.rx} ry={scale.ry}
            fill="url(#scaleDepth)" // Gradient fill creates depth on each scale
            stroke="rgba(255,230,155,0.4)" // Subtle stroke for definition
            strokeWidth="0.8"
          />
          {/* Secondary Shine (unchanged) */}
          <ellipse cx="-1.2" cy="-1.2" rx={scale.rx * 0.5} ry={scale.ry * 0.28} fill="rgba(255,245,210,0.5)" />
        </g>
      ))}

      {/* 3. FINAL VOLUME PATH: Applies True 3D depth to the entire snake body */}
      <path
        d={pathD}
        fill="none"
        stroke="url(#snakeCylinderHighlight)"
        strokeWidth="20" // Focused body width
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
        filter="url(#snakeVolume3D)" // Apply true 3D lighting volume
      />

      {/* Last Value Point Rendering (unchanged) */}
      {lastPoint && (
        <text
          x={lastPoint.x + 16} // Positioned for visibility
          y={lastPoint.y + 4}
          fill="#f6d36f" // Matches existing color scheme
          fontSize="14"
          fontWeight="700"
        >
          ₹{lastValue.toFixed(2)}
        </text>
      )}

      {/* X-Axis labels (unchanged) */}
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
