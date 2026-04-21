import React, { useMemo, useState } from "react";

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
const CHART_HEIGHT = 360;

const PADDING = {
  top: 28,
  right: 24,
  bottom: 54,
  left: 78,
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "₹ --";
  }
  return `₹ ${value.toFixed(2)}`;
}

function buildSmoothPath(points: XYPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
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

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const density = Math.max(2, Math.floor(len / 10));

    for (let j = 0; j < density; j += 1) {
      const t = j / density;
      const cx = prev.x + dx * t;
      const cy = prev.y + dy * t;
      const pulse = 1 + 0.12 * Math.sin((i + j) * 0.85);

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

const PnlCurveChart: React.FC<Props> = ({ data, entryMarkerTime }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const safeData = data ?? [];

  const {
    points,
    drawdownPoints,
    yTicks,
    pnlPath,
    drawdownPath,
    stopLossY,
    targetY,
    zeroY,
    entryX,
    hasEntryMarker,
    hoverPoint,
    hoverDrawdown,
    lastPnl,
  } = useMemo(() => {
    if (!safeData.length) {
      return {
        points: [] as XYPoint[],
        drawdownPoints: [] as XYPoint[],
        yTicks: [] as Array<{ value: number; y: number }>,
        pnlPath: "",
        drawdownPath: "",
        stopLossY: 0,
        targetY: 0,
        zeroY: 0,
        entryX: null as number | null,
        hasEntryMarker: false,
        hoverPoint: null as XYPoint | null,
        hoverDrawdown: null as XYPoint | null,
        lastPnl: 0,
      };
    }

    const pnlValues = safeData.map((item) => item.pnl ?? 0);
    const stopLossValues = safeData
      .map((item) => item.stop_loss)
      .filter((v): v is number => v !== undefined && v !== null && !Number.isNaN(v));

    const targetValues = safeData
      .map((item) => item.target)
      .filter((v): v is number => v !== undefined && v !== null && !Number.isNaN(v));

    const drawdownValues = safeData
      .map((item) => item.drawdown)
      .filter((v): v is number => v !== undefined && v !== null && !Number.isNaN(v));

    const allValues = [
      ...pnlValues,
      ...stopLossValues,
      ...targetValues,
      ...drawdownValues,
      0,
    ];

    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const span = Math.max(1, maxVal - minVal);

    const paddedMin = minVal - span * 0.18;
    const paddedMax = maxVal + span * 0.18;

    const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const mapX = (index: number) =>
      PADDING.left +
      (index / Math.max(1, safeData.length - 1)) * innerWidth;

    const mapY = (value: number) =>
      PADDING.top +
      (1 - (value - paddedMin) / (paddedMax - paddedMin)) * innerHeight;

    const points = safeData.map((item, index) => ({
      x: mapX(index),
      y: mapY(item.pnl ?? 0),
    }));

    const drawdownPoints = safeData.map((item, index) => ({
      x: mapX(index),
      y: mapY(item.drawdown ?? 0),
    }));

    const pnlPath = buildSmoothPath(points);
    const drawdownPath = buildSmoothPath(drawdownPoints);

    const stopLossValue =
      stopLossValues.length > 0 ? stopLossValues[stopLossValues.length - 1] : 0;
    const targetValue =
      targetValues.length > 0 ? targetValues[targetValues.length - 1] : 0;

    const zeroY = mapY(0);
    const stopLossY = mapY(stopLossValue);
    const targetY = mapY(targetValue);

    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const value = paddedMin + ((paddedMax - paddedMin) * i) / 4;
      return {
        value,
        y: mapY(value),
      };
    });

    const entryIndex = entryMarkerTime
      ? safeData.findIndex((item) => item.time === entryMarkerTime)
      : -1;

    const hasEntryMarker = entryIndex >= 0;
    const entryX = hasEntryMarker ? mapX(entryIndex) : null;

    const resolvedHoverIndex =
      hoverIndex !== null && hoverIndex >= 0 && hoverIndex < safeData.length
        ? hoverIndex
        : safeData.length - 1;

    const hoverPoint = points[resolvedHoverIndex] ?? null;
    const hoverDrawdown = drawdownPoints[resolvedHoverIndex] ?? null;
    const lastPnl = safeData[resolvedHoverIndex]?.pnl ?? 0;

    return {
      points,
      drawdownPoints,
      yTicks,
      pnlPath,
      drawdownPath,
      stopLossY,
      targetY,
      zeroY,
      entryX,
      hasEntryMarker,
      hoverPoint,
      hoverDrawdown,
      lastPnl,
    };
  }, [safeData, entryMarkerTime, hoverIndex]);

  if (!safeData || safeData.length === 0) return null;

  const activeIndex =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < safeData.length
      ? hoverIndex
      : safeData.length - 1;

  const activePoint = safeData[activeIndex];
  const activeDrawdown = activePoint?.drawdown ?? null;
  const activePnl = activePoint?.pnl ?? null;
  const activeStopLoss = activePoint?.stop_loss ?? null;
  const activeTarget = activePoint?.target ?? null;

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
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: "360px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 3,
            background: "rgba(255,255,255,0.96)",
            borderRadius: "0px",
            padding: "14px 16px",
            boxShadow: "0 10px 20px rgba(0,0,0,0.18)",
            minWidth: "254px",
          }}
        >
          <div
            style={{
              color: "#fb7185",
              fontSize: "18px",
              lineHeight: 1.3,
              marginBottom: "10px",
            }}
          >
            Drawdown : {formatCurrency(activeDrawdown)}
          </div>
          <div
            style={{
              color: "#38bdf8",
              fontSize: "18px",
              lineHeight: 1.3,
              marginBottom: "10px",
            }}
          >
            Pnl : {formatCurrency(activePnl)}
          </div>
          <div
            style={{
              color: "#ef4444",
              fontSize: "18px",
              lineHeight: 1.3,
              marginBottom: "10px",
            }}
          >
            Stop Loss : {formatCurrency(activeStopLoss)}
          </div>
          <div
            style={{
              color: "#22c55e",
              fontSize: "18px",
              lineHeight: 1.3,
            }}
          >
            Target : {formatCurrency(activeTarget)}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          width="100%"
          height={360}
          role="img"
          aria-label="PnL snake chart"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="snakeGoldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8c5e0e" />
              <stop offset="20%" stopColor="#c8921f" />
              <stop offset="50%" stopColor="#f3cf69" />
              <stop offset="80%" stopColor="#c8921f" />
              <stop offset="100%" stopColor="#8c5e0e" />
            </linearGradient>

            <linearGradient id="snakeShineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,248,220,0.95)" />
              <stop offset="100%" stopColor="rgba(255,248,220,0.08)" />
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
                  0 0 0 1 0
                "
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
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="5"
                floodColor="#d4a73d"
                floodOpacity="0.35"
              />
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="12"
                floodColor="#d4a73d"
                floodOpacity="0.14"
              />
            </filter>
          </defs>

          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={tick.y}
                y2={tick.y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text
                x={18}
                y={tick.y + 5}
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
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.2"
            strokeDasharray="5 5"
          />

          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={stopLossY}
            y2={stopLossY}
            stroke="#ef4444"
            strokeWidth="2"
          />

          <line
            x1={PADDING.left}
            x2={CHART_WIDTH - PADDING.right}
            y1={targetY}
            y2={targetY}
            stroke="#22c55e"
            strokeWidth="2"
          />

          {hasEntryMarker && entryX !== null && (
            <line
              x1={entryX}
              x2={entryX}
              y1={PADDING.top}
              y2={CHART_HEIGHT - PADDING.bottom}
              stroke="#60a5fa"
              strokeWidth="1.6"
              strokeDasharray="4 4"
            />
          )}

          <path
            d={drawdownPath}
            fill="none"
            stroke="rgba(244,63,94,0.85)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={pnlPath}
            fill="none"
            stroke="rgba(212,167,61,0.18)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#goldGlow)"
          />

          <path
            d={pnlPath}
            fill="none"
            stroke="url(#snakeGoldGradient)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#snakeShadow)"
          />

          {makeSnakeScales(points).map((scale, idx) => (
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
            d={pnlPath}
            fill="none"
            stroke="url(#snakeShineGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />

          {hoverDrawdown && (
            <circle
              cx={hoverDrawdown.x}
              cy={hoverDrawdown.y}
              r="5"
              fill="#fb7185"
              stroke="#ffffff"
              strokeWidth="1"
            />
          )}

          {hoverPoint && (
            <>
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="7"
                fill="#f3cf69"
                filter="url(#goldGlow)"
              />
              <text
                x={hoverPoint.x + 12}
                y={hoverPoint.y - 10}
                fill="#f6d36f"
                fontSize="14"
                fontWeight="700"
              >
                ₹{lastPnl.toFixed(2)}
              </text>
            </>
          )}

          {points.map((point, index) => {
            const item = safeData[index];
            const clickableWidth =
              index === points.length - 1
                ? 24
                : Math.max(18, (points[index + 1]?.x ?? point.x + 24) - point.x);

            const shouldShow =
              index === 0 ||
              index === points.length - 1 ||
              index % Math.max(1, Math.floor(points.length / 6)) === 0;

            return (
              <g key={`${item.time}-${index}`}>
                <rect
                  x={point.x - clickableWidth / 2}
                  y={PADDING.top}
                  width={clickableWidth}
                  height={CHART_HEIGHT - PADDING.top - PADDING.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(index)}
                />
                {shouldShow && (
                  <text
                    x={point.x}
                    y={CHART_HEIGHT - 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.42)"
                    fontSize="12"
                  >
                    {item.time}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div
          style={{
            marginTop: "10px",
            display: "flex",
            gap: "18px",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            fontSize: "14px",
          }}
        >
          <div style={{ color: "#fb7185", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>◦</span> drawdown
          </div>
          <div style={{ color: "#f3cf69", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>◦</span> pnl
          </div>
          <div style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>◦</span> stop_loss
          </div>
          <div style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>◦</span> target
          </div>
        </div>
      </div>
    </div>
  );
};

export default PnlCurveChart;
