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
            position: relative !important;
            filter: blur(2.5px) !important;
            opacity: 0.48 !important;
            pointer-events: none !important;
            user-select: none !important;
          }

          .lb-backtest-free-gate div[style*="flex-wrap"] > button:nth-of-type(n + 2)::after {
            content: "🔒";
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            filter: blur(0) !important;
            opacity: 1 !important;
            color: #facc15;
            font-size: 13px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
          }

          .lb-backtest-free-gate div[style*="flex-wrap"]::after {
            content: "Unlock Premium for MVO Weights and MVO Short";
            display: inline-flex;
            align-items: center;
            padding: 9px 14px;
            border-radius: 8px;
            border: 1px solid rgba(250, 204, 21, 0.25);
            background: rgba(250, 204, 21, 0.06);
            color: rgba(250, 204, 21, 0.78);
            font-family: var(--font-mono);
            font-size: 10px;
            letter-spacing: 0.8px;
          }
        `}</style>
      )}
    </div>
  );
};

export default PortfolioBacktestPanelGate;
