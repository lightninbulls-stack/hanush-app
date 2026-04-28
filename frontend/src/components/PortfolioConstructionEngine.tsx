import React from "react";
import { motion, type Variants } from "framer-motion";

interface PortfolioConstructionEngineProps {
  onNavigate?: (category: string) => void;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE_OUT } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const PortfolioConstructionEngine: React.FC<PortfolioConstructionEngineProps> = ({ onNavigate }) => {
  return (
    <motion.section className="lb-portfolio-engine-top" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.18 }}>
      <motion.div className="lb-portfolio-engine-heading" variants={fadeUp}>
        <span>PORTFOLIO CONSTRUCTION ENGINE</span>
        <h2>
          How to create a risk-adjusted portfolio
          <br />
          <em>using selection and allocation.</em>
        </h2>
        <p>
          LightninBull separates two major portfolio decisions: <strong>selection</strong> and <strong>allocation</strong>.
        </p>
      </motion.div>

      <motion.div className="lb-engine-flow" variants={fadeUp}>
        <div className="lb-engine-card lb-alpha-card">
          <div className="lb-engine-card-head"><span>01</span><p>SELECTION LAYER</p></div>
          <h3>Selection</h3>
          <strong>Where stock ideas come from</strong>
          <small>Powered by LightninBull AI Quant Engine</small>
          <ul>
            <li>Regime-based filtering</li>
            <li>Momentum ranking</li>
            <li>Value, quality and factor buckets</li>
            <li>AI-selected intelligent stock universe</li>
          </ul>
          <div className="lb-engine-result">Output: selected stocks</div>
        </div>

        <div className="lb-engine-plus"><span /><p>+</p><span /></div>

        <div className="lb-engine-card lb-risk-card">
          <div className="lb-engine-card-head"><span>02</span><p>ALLOCATION LAYER</p></div>
          <h3>Allocation</h3>
          <strong>How portfolio weights are decided</strong>
          <small>Powered by LightninBull AI Quant Engine</small>
          <ul>
            <li>Equal weight baseline</li>
            <li>Minimum variance optimization</li>
            <li>Compare Equal Weight vs MVO</li>
            <li>Select preferred allocation style</li>
          </ul>
          <div className="lb-engine-result">Output: portfolio weights</div>
        </div>
      </motion.div>

      <motion.div className="lb-user-process" variants={fadeUp}>
        <div className="lb-user-process-copy">
          <span>WHAT USER NEEDS TO DO</span>
          <h3>Build the portfolio step by step</h3>
          <p>
            Add AI-selected stocks into Watchlist, run Portfolio Backtest, compare Equal Weight and MVO, then choose the preferred portfolio allocation.
          </p>
        </div>
        <div className="lb-user-steps">
          <button type="button" onClick={() => onNavigate?.("Consistent Trending")}><strong>01</strong><span>Discover stocks from intelligent buckets</span></button>
          <button type="button" onClick={() => onNavigate?.("Watchlist")}><strong>02</strong><span>Add selected stocks to Watchlist</span></button>
          <button type="button" onClick={() => onNavigate?.("Portfolio Backtest")}><strong>03</strong><span>Run Portfolio Backtest</span></button>
          <button type="button" onClick={() => onNavigate?.("Portfolio Backtest")}><strong>04</strong><span>Compare Equal Weight vs MVO</span></button>
          <button type="button" onClick={() => onNavigate?.("Portfolio Backtest")}><strong>05</strong><span>Select final portfolio allocation</span></button>
        </div>
      </motion.div>

      <motion.div className="lb-final-engine-output" variants={fadeUp}>
        <span>FINAL OUTPUT</span>
        <h3>Risk-Adjusted Portfolio</h3>
        <p>Selection + allocation + portfolio backtest + rebalancing workflow.</p>
        <div><em>Discover</em><i /><em>Select</em><i /><em>Backtest</em><i /><em>Rebalance</em></div>
      </motion.div>

      <style>{`
        .lb-portfolio-engine-top { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto 86px; color: #f7f0df; }
        .lb-portfolio-engine-heading { text-align: center; margin-bottom: 46px; }
        .lb-portfolio-engine-heading > span, .lb-user-process-copy > span, .lb-final-engine-output > span { display: block; margin-bottom: 22px; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 5px; color: rgba(250,204,21,0.78); }
        .lb-portfolio-engine-heading h2 { margin: 0; font-family: 'Cormorant Garamond', serif; font-size: clamp(46px, 5vw, 76px); font-weight: 300; line-height: 0.98; color: #f7f0df; }
        .lb-portfolio-engine-heading h2 em { color: #d6b849; font-style: italic; font-weight: 300; text-shadow: 0 0 32px rgba(250,204,21,0.16); }
        .lb-portfolio-engine-heading p { max-width: 860px; margin: 24px auto 0; font-family: 'DM Mono', monospace; font-size: 12px; line-height: 2; color: rgba(255,255,255,0.48); }
        .lb-portfolio-engine-heading strong { color: #facc15; font-weight: 500; }
        .lb-engine-flow { display: grid; grid-template-columns: minmax(0, 1fr) 90px minmax(0, 1fr); gap: 18px; align-items: center; margin-bottom: 28px; }
        .lb-engine-card { min-height: 430px; padding: 34px 32px; border: 1px solid rgba(250,204,21,0.18); background: rgba(8,9,12,0.92); box-shadow: 0 28px 70px rgba(0,0,0,0.42); overflow: hidden; }
        .lb-alpha-card { border-color: rgba(96,165,250,0.3); background: radial-gradient(ellipse at 0% 0%, rgba(96,165,250,0.13), transparent 54%), rgba(8,9,12,0.92); }
        .lb-risk-card { border-color: rgba(250,204,21,0.28); background: radial-gradient(ellipse at 100% 0%, rgba(250,204,21,0.13), transparent 54%), rgba(8,9,12,0.92); }
        .lb-engine-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 34px; font-family: 'DM Mono', monospace; }
        .lb-engine-card-head span { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; border: 1px solid rgba(250,204,21,0.32); color: #facc15; font-size: 12px; }
        .lb-engine-card-head p { margin: 0; color: rgba(255,255,255,0.42); font-size: 9px; letter-spacing: 4px; }
        .lb-engine-card h3 { margin: 0; font-family: 'Cormorant Garamond', serif; font-size: clamp(46px, 5vw, 68px); font-weight: 300; line-height: 0.95; }
        .lb-engine-card strong { display: block; margin-top: 16px; color: #facc15; font-family: 'Syne', sans-serif; font-size: 15px; }
        .lb-engine-card small { display: block; margin-top: 12px; font-family: 'DM Mono', monospace; color: rgba(255,255,255,0.43); line-height: 1.7; }
        .lb-engine-card ul { list-style: none; padding: 24px 0 0; margin: 26px 0 0; border-top: 1px solid rgba(255,255,255,0.08); }
        .lb-engine-card li { position: relative; padding-left: 18px; margin-bottom: 13px; font-family: 'DM Mono', monospace; font-size: 11px; line-height: 1.7; color: rgba(255,255,255,0.58); }
        .lb-engine-card li::before { content: ""; position: absolute; left: 0; top: 9px; width: 6px; height: 6px; border-radius: 50%; background: #facc15; }
        .lb-engine-result { margin-top: 26px; padding: 14px 16px; border: 1px solid rgba(250,204,21,0.18); background: rgba(250,204,21,0.045); color: rgba(255,255,255,0.72); font-family: 'DM Mono', monospace; font-size: 11px; }
        .lb-engine-plus { display: flex; flex-direction: column; align-items: center; gap: 14px; color: #facc15; }
        .lb-engine-plus span { width: 1px; height: 92px; background: linear-gradient(180deg, transparent, rgba(250,204,21,0.7), transparent); }
        .lb-engine-plus p { width: 46px; height: 46px; display: grid; place-items: center; margin: 0; border-radius: 50%; border: 1px solid rgba(250,204,21,0.42); background: rgba(250,204,21,0.08); box-shadow: 0 0 34px rgba(250,204,21,0.16); font-size: 24px; }
        .lb-user-process { display: grid; grid-template-columns: 0.82fr 1.18fr; gap: 28px; padding: 34px; margin-bottom: 28px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.018); }
        .lb-user-process-copy h3 { margin: 0 0 16px; font-family: 'Cormorant Garamond', serif; font-size: clamp(34px, 4vw, 54px); font-weight: 300; line-height: 1; }
        .lb-user-process-copy p { margin: 0; font-family: 'DM Mono', monospace; font-size: 11px; line-height: 2; color: rgba(255,255,255,0.45); }
        .lb-user-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.07); }
        .lb-user-steps button { min-height: 150px; padding: 22px 18px; border: 0; background: rgba(5,6,8,0.94); color: #f7f0df; text-align: left; cursor: pointer; transition: all 0.24s ease; }
        .lb-user-steps button:hover { background: rgba(250,204,21,0.06); transform: translateY(-3px); }
        .lb-user-steps strong { display: block; margin-bottom: 18px; font-family: 'Cormorant Garamond', serif; font-size: 34px; font-weight: 300; color: rgba(250,204,21,0.62); }
        .lb-user-steps span { font-family: 'DM Mono', monospace; font-size: 10px; line-height: 1.7; color: rgba(255,255,255,0.5); }
        .lb-final-engine-output { padding: 36px 32px; border: 1px solid rgba(250,204,21,0.28); background: radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.16), transparent 55%), rgba(8,9,12,0.94); text-align: center; }
        .lb-final-engine-output h3 { margin: 0; font-family: 'Cormorant Garamond', serif; font-size: clamp(44px, 5vw, 72px); font-weight: 300; line-height: 1; }
        .lb-final-engine-output p { margin: 16px auto 26px; max-width: 760px; font-family: 'DM Mono', monospace; font-size: 12px; color: rgba(255,255,255,0.52); }
        .lb-final-engine-output div { display: flex; justify-content: center; align-items: center; gap: 14px; flex-wrap: wrap; }
        .lb-final-engine-output em { font-family: 'DM Mono', monospace; font-size: 10px; font-style: normal; letter-spacing: 2.5px; color: rgba(255,255,255,0.72); text-transform: uppercase; }
        .lb-final-engine-output i { width: 24px; height: 1px; background: rgba(250,204,21,0.5); }
        @media (max-width: 1180px) { .lb-engine-flow, .lb-user-process { grid-template-columns: 1fr; } .lb-engine-plus { flex-direction: row; justify-content: center; } .lb-engine-plus span { width: 90px; height: 1px; background: linear-gradient(90deg, transparent, rgba(250,204,21,0.7), transparent); } .lb-user-steps { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 820px) { .lb-engine-card { min-height: auto; padding: 26px 22px; } .lb-user-steps { grid-template-columns: 1fr; } .lb-user-steps button { min-height: auto; } }
      `}</style>
    </motion.section>
  );
};

export default PortfolioConstructionEngine;
