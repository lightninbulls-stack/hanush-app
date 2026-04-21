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
  const scales: Array<{ cx: number; cy: number; angle: number; rx: number; ry: number; }> = [];
  if (points.length < 2) return scales;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const density = Math.max(3, Math.floor(len / 7)); 
    for (let j = 0; j < density; j++) {
      const t = j / density;
      const pulse = 1 + 0.1 * Math.sin((i + j) * 0.8);
      scales.push({
        cx: prev.x + dx * t,
        cy: prev.y + dy * t,
        angle,
        rx: 9 * pulse,
        ry: 6 * pulse,
      });
    }
  }
  return scales;
}

export default function MetalSnakePnlChart({ data, target, stopLoss, zeroLine = 0, height = 420 }: Props) {
  const safeData = data ?? [];
  const { points, yTicks, zeroY, targetY, stopLossY, pathD } = useMemo(() => {
    const values = safeData.length > 0 ? safeData.map((d) => d.value) : [0, target, stopLoss];
    const minVal = Math.min(...values, stopLoss, zeroLine, 0);
    const maxVal = Math.max(...values, target, zeroLine, 0);
    const span = Math.max(1, maxVal - minVal);
    const paddedMin = minVal - span * 0.15;
    const paddedMax = maxVal + span * 0.15;
    const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;
    const mapX = (index: number) => PADDING.left + (index / Math.max(1, safeData.length - 1 || 1)) * innerWidth;
    const mapY = (value: number) => PADDING.top + (1 - (value - paddedMin) / (paddedMax - paddedMin)) * innerHeight;
    const points = safeData.map((d, i) => ({ x: mapX(i), y: mapY(d.value) }));
    const yTicks = Array.from({ length: 6 }, (_, i) => {
      const v = paddedMin + ((paddedMax - paddedMin) * i) / 5;
      return { value: v, y: mapY(v) };
    });
    return { points, yTicks, zeroY: mapY(zeroLine), targetY: mapY(target), stopLossY: mapY(stopLoss), pathD: buildSmoothPath(points) };
  }, [safeData, target, stopLoss, zeroLine, height]);

  const scales = useMemo(() => makeSnakeScales(points), [points]);
  const lastPoint = points[points.length - 1];
  const lastValue = safeData[safeData.length - 1]?.value ?? 0;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${height}`} width="100%" height={height} style={{ background: '#0a0b0d' }}>
      <defs>
        {/* SHARP GOLD GRADIENT - No transparency, pure metal colors */}
        <linearGradient id="hardGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8a5a08" />
          <stop offset="30%" stopColor="#eeb741" />
          <stop offset="50%" stopColor="#fff0a0" />
          <stop offset="70%" stopColor="#eeb741" />
          <stop offset="100%" stopColor="#5e3902" />
        </linearGradient>

        {/* SCALE BEVEL - This makes each scale look like it's sticking out */}
        <filter id="bevelScale" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
          <feSpecularLighting in="blur" surfaceScale="3" specularConstant="1.2" specularExponent="30" lightingColor="#ffffff" result="spec">
            <fePointLight x="-1000" y="-5000" z="5000" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut" />
          <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>

        {/* DROP SHADOW - Tight and dark, no white glow */}
        <filter id="tightShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* Grid rendering */}
      {yTicks.map((tick, idx) => (
        <g key={idx}>
          <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={10} y={tick.y + 4} fill="rgba(255,255,255,0.3)" fontSize="11">{tick.value.toFixed(0)}</text>
        </g>
      ))}

      {/* Main Snake Under-Body (Creates the solid foundation) */}
      <path d={pathD} fill="none" stroke="#4a3205" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />

      {/* Individual Scales - This is the "Body Part" focus */}
      {scales.map((scale, idx) => (
        <g key={idx} transform={`translate(${scale.cx}, ${scale.cy}) rotate(${scale.angle})`} filter="url(#bevelScale)">
          <ellipse
            cx="0" cy="0"
            rx={scale.rx} ry={scale.ry}
            fill="url(#hardGold)"
            stroke="#2a1d02"
            strokeWidth="0.5"
          />
        </g>
      ))}

      {/* Top Center Shine (Optional - remove if you want it even darker) */}
      <path d={pathD} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* Last Value Marker */}
      {lastPoint && (
        <g transform={`translate(${lastPoint.x}, ${lastPoint.y})`}>
          <circle r="6" fill="#f3cf69" filter="url(#tightShadow)" />
          <text x="12" y="5" fill="#f6d36f" fontSize="14" fontWeight="bold">₹{lastValue.toFixed(2)}</text>
        </g>
      )}
    </svg>
  );
}
