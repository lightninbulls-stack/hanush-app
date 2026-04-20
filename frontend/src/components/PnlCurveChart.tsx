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

// ✅ Simplest safe fix: avoid strict typing issue
const tooltipFormatter = (value: any, name: any): [string, string] => {
  const labelMap: Record<string, string> = {
    pnl: "PnL",
    stop_loss: "Stop Loss",
    target: "Target",
    drawdown: "Drawdown",
  };

  let num = Number(value);

  if (Array.isArray(value)) {
    num = Number(value[0]);
  }

  const formatted = Number.isFinite(num)
    ? `₹ ${num.toFixed(2)}`
    : "₹ --";

  return [formatted, labelMap[name] ?? name];
};

const PnlCurveChart: React.FC<Props> = ({ data, entryMarkerTime }) => {
  if (!data || data.length === 0) return null;

  const hasEntryMarker = Boolean(
    entryMarkerTime && data.some((d) => d.time === entryMarkerTime)
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
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />

          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis width={70} />

          <Tooltip formatter={tooltipFormatter} />

          <Legend />

          <ReferenceLine y={0} strokeDasharray="4 4" />

          {hasEntryMarker && (
            <ReferenceLine x={entryMarkerTime!} stroke="#60a5fa" />
          )}

          <Line dataKey="stop_loss" stroke="#ef4444" dot={false} />
          <Line dataKey="target" stroke="#22c55e" dot={false} />

          <Area
            dataKey="drawdown"
            stroke="rgba(244,63,94,0.8)"
            fill="rgba(244,63,94,0.18)"
          />

          <Line dataKey="pnl" stroke="#38bdf8" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnlCurveChart;
