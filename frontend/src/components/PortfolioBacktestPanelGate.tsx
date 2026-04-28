import React from "react";
import PortfolioBacktestPanel from "./PortfolioBacktestPanel";

type PortfolioBacktestPanelGateProps = {
  isPremium?: boolean;
};

const PortfolioBacktestPanelGate: React.FC<PortfolioBacktestPanelGateProps> = ({
  isPremium = false,
}) => {
  return (
    <div className={isPremium ? "" : "lb-backtest-free-gate"}>
      <PortfolioBacktestPanel />

      {!isPremium && (
        <style>{`
          .lb-backtest-free-gate div[style*="flex-wrap"] > button:nth-of-type(n + 2) {
            display: none !important;
          }
        `}</style>
      )}
    </div>
  );
};

export default PortfolioBacktestPanelGate;
