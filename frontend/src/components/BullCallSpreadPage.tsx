import React from "react";
import BullCallSpreadDashboard from "./BullCallSpreadDashboard";
import type { PnlPoint } from "./SnakePnlChart";

type TradeLeg = {
  side: "BUY" | "SELL";
  symbol: string;
  entryTime: string;
  avg: number;
  ltp: number;
  pnl: number;
};

type Props = {
  pnlSeries: PnlPoint[];
  legs: TradeLeg[];
  strategyName: string;
  algoName: string;
  status: "OPEN" | "CLOSED";
  netPnl: number;
  stopLoss: number;
  target: number;
  updatedAt: string;
  entryTime: string;
};

const BullCallSpreadPage: React.FC<Props> = (props) => {
  return <BullCallSpreadDashboard {...props} />;
};

export default BullCallSpreadPage;
