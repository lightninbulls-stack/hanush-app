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

export default function SnakePnlChart({
  data = [],
  height = 320,
}: Props) {
  const lastValue = data.length > 0 ? data[data.length - 1].value : 0;

  return (
    <div
      style={{
        width: "100%",
        minHeight: `${height}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000000",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.65)",
        fontSize: "14px",
      }}
    >
      PnL Chart Hidden · Current PnL: ₹ {lastValue.toFixed(2)}
    </div>
  );
}
