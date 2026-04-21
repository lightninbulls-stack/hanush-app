import React from "react";
import SnakePnlChart, { PnlPoint } from "./SnakePnlChart";
import "./bullCallSpreadDashboard.css";

type TradeLeg = {
  side: "BUY" | "SELL";
  symbol: string;
  entryTime: string;
  avg: number;
  ltp: number;
  pnl: number;
};

type Props = {
  strategyName: string;
  algoName: string;
  status: "OPEN" | "CLOSED";
  netPnl: number;
  stopLoss: number;
  target: number;
  updatedAt: string;
  entryTime: string;
  legs: TradeLeg[];
  pnlSeries: PnlPoint[];
};

const BullCallSpreadDashboard: React.FC<Props> = ({
  strategyName,
  algoName,
  status,
  netPnl,
  stopLoss,
  target,
  updatedAt,
  entryTime,
  legs,
  pnlSeries,
}) => {
  return (
    <div className="lb-page-bg">
      <div className="lb-main-shell">
        <div className="lb-panel">
          <div className="lb-header">
            <div>
              <h1 className="lb-title">{strategyName}</h1>
              <p className="lb-subtitle">{algoName}</p>
            </div>

            <div className="lb-header-right">
              <div className={`lb-status ${status === "OPEN" ? "open" : "closed"}`}>
                {status}
              </div>
              <div className={`lb-net-pnl ${netPnl >= 0 ? "profit" : "loss"}`}>
                ₹ {netPnl.toFixed(2)}
              </div>
              <div className="lb-net-pnl-label">Net PnL</div>
            </div>
          </div>

          <div className="lb-legs-wrapper">
            {legs.map((leg, index) => (
              <div className="lb-leg-card" key={`${leg.symbol}-${index}`}>
                <div className={`lb-leg-side ${leg.side === "BUY" ? "buy" : "sell"}`}>
                  {leg.side}
                </div>

                <div className="lb-leg-symbol-block">
                  <div className="lb-leg-symbol">{leg.symbol}</div>
                  <div className="lb-leg-entry">Entry: {leg.entryTime}</div>
                </div>

                <div className="lb-leg-metric">Avg: {leg.avg.toFixed(2)}</div>
                <div className="lb-leg-metric">LTP: {leg.ltp.toFixed(2)}</div>
                <div className={`lb-leg-pnl ${leg.pnl >= 0 ? "profit" : "loss"}`}>
                  PnL: {leg.pnl.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="lb-pill-row">
            <div className="lb-pill">Stop Loss: {stopLoss.toFixed(2)}</div>
            <div className="lb-pill">Target: {target.toFixed(2)}</div>
            <div className="lb-pill">Entry Time: {entryTime}</div>
            <div className="lb-pill">Updated: {updatedAt}</div>
          </div>

          <div className="lb-chart-card">
            <div className="lb-chart-legend">
              <div className="lb-legend-item">
                <span className="lb-dot snake"></span>
                pnl snake
              </div>
              <div className="lb-legend-item">
                <span className="lb-dot stop"></span>
                stop loss
              </div>
              <div className="lb-legend-item">
                <span className="lb-dot target"></span>
                target
              </div>
            </div>

            <SnakePnlChart
              data={pnlSeries}
              target={target}
              stopLoss={stopLoss}
              height={430}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BullCallSpreadDashboard;
