import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

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

const tooltipFormatter = (
  value: ValueType,
  name: NameType
): [string, string] => {
  const labelMap: Record<string, string> = {
    pnl: "PnL",
    stop_loss: "Stop Loss",
    target: "Target",
    drawdown: "Drawdown",
  };

  let numericValue: number | null = null;

  if (typeof value === "number") {
    numericValue = value;
  } else if (typeof value === "string") {
    const parsed = Number(value);
    numericValue = Number.isFinite(parsed) ? parsed : null;
  } else if (Array.isArray(value) && value.length > 0) {
    const firstValue = value[0];
    const parsed =
      typeof firstValue === "number"
        ? firstValue
        : typeof firstValue === "string"
        ? Number(firstValue)
        : NaN;

    numericValue = Number.isFinite(parsed) ? parsed : null;
  }

  const formattedValue =
    numericValue !== null ? `₹ ${numericValue.toFixed(2)}` : "₹ --";

  return [formattedValue, labelMap[String(name)] ?? String(name)];
};

const PnlCurveChart: React.FC<Props> = ({ data, entryMarkerTime }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const hasEntryMarker = Boolean(
    entryMarkerTime && data.some((point) => point.time === entryMarkerTime)
  );

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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#cbd5e1",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          Live PnL Curve
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            fontSize: "11px",
            color: "#94a3b8",
          }}
        >
          <span>🔵 Entry</span>
          <span>🔴 Stop Loss</span>
          <span>🟢 Target</span>
          <span>📊 Drawdown</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />

          <XAxis
            dataKey="time"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            minTickGap={24}
          />

          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            width={70}
          />

          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{
              background: "#020617",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#f8fafc" }}
          />

          <Legend
            wrapperStyle={{
              fontSize: "11px",
              color: "#94a3b8",
            }}
          />

          <ReferenceLine
            y={0}
            stroke="rgba(255,255,255,0.18)"
            strokeDasharray="4 4"
          />

          {hasEntryMarker ? (
            <ReferenceLine
              x={entryMarkerTime!}
              stroke="#60a5fa"
              strokeDasharray="5 5"
              label={{
                value: "Entry",
                position: "top",
                fill: "#60a5fa",
                fontSize: 11,
              }}
            />
          ) : null}

          <Line
            type="monotone"
            dataKey="stop_loss"
            name="stop_loss"
            stroke="#ef4444"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="target"
            name="target"
            stroke="#22c55e"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />

          <Area
            type="monotone"
            dataKey="drawdown"
            name="drawdown"
            stroke="rgba(244,63,94,0.8)"
            fill="rgba(244,63,94,0.18)"
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="pnl"
            name="pnl"
            stroke="#38bdf8"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnlCurveChart;
