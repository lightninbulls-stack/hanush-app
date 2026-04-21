import React from "react";
import BullCallSpreadDashboard from "./BullCallSpreadDashboard";
import { PnlPoint } from "./SnakePnlChart";

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

const BullCallSpreadPage: React.FC<Props> = ({
  pnlSeries,
  legs,
  strategyName,
  algoName,
  status,
  netPnl,
  stopLoss,
  target,
  updatedAt,
  entryTime,
}) => {
  return (
    <BullCallSpreadDashboard
      strategyName={strategyName}
      algoName={algoName}
      status={status}
      netPnl={netPnl}
      stopLoss={stopLoss}
      target={target}
      updatedAt={updatedAt}
      entryTime={entryTime}
      legs={legs}
      pnlSeries={pnlSeries}
    />
  );
};

export default BullCallSpreadPage;
