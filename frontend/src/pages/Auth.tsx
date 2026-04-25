/**
 * LightninBull — Premium Landing Page Sections
 * Drop this below your existing hero video section in Auth.tsx (or any page).
 * Safe: no routes, no dashboard, no sidebar touched.
 *
 * Dependencies already in most React+TS+Tailwind setups:
 *   npm install framer-motion
 *   Google Fonts loaded via @import inside <style> tag below.
 */

import React, { useRef, useEffect, useState } from "react";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  tag: string;
  title: string;
  body: string;
  accent: string;
}

interface WorkflowStep {
  num: string;
  title: string;
  desc: string;
}

interface RiskPillar {
  label: string;
  value: string;
  sub: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    id: "momentum",
    tag: "SIGNAL ENGINE",
    title: "Momentum Models",
    body: "Cross-sectional and time-series momentum factors identify trending instruments before the crowd moves in.",
    accent: "#c9a84c",
  },
  {
    id: "meanrev",
    tag: "MEAN REVERSION",
    title: "Mean Reversion Models",
    body: "Statistical z-score and Bollinger-based engines detect overextension and surface high-probability snap-back setups.",
    accent: "#c9a84c",
  },
  {
    id: "regime",
    tag: "MACRO LENS",
    title: "Regime Intelligence",
    body: "Dynamic upside/downside regime classifiers adapt the signal stack to prevailing market conditions in real time.",
    accent: "#c9a84c",
  },
  {
    id: "range",
    tag: "RANGE BOUND",
    title: "Range Bound Models",
    body: "Channel-aware algorithms harvest premium in sideways markets where trend-followers bleed.",
    accent: "#c9a84c",
  },
  {
    id: "options",
    tag: "DERIVATIVES",
    title: "Aggressive Option Stocks",
    body: "Quantitatively screened high-IV, high-conviction call and put candidates — ranked daily by expected value.",
    accent: "#c9a84c",
  },
  {
    id: "intraday",
    tag: "INTRADAY",
    title: "Index Option Spreads",
    body: "Intraday bull call and bear put spread signals on index options, with defined risk and high-frequency entry logic.",
    accent: "#c9a84c",
  },
];

const WORKFLOW: WorkflowStep[] = [
  { num: "01", title: "Data Ingestion", desc: "Multi-feed OHLCV, options chain, and macro regime data normalised into a unified quant layer." },
  { num: "02", title: "Factor Scoring", desc: "Momentum, value, quality, and volatility factors scored cross-sectionally across the entire universe." },
  { num: "03", title: "Signal Generation", desc: "Model ensemble produces ranked signals with confidence scores, entry zones, and risk parameters." },
  { num: "04", title: "Portfolio Construction", desc: "Equal-weight and MVO optimisation build allocations respecting drawdown, correlation, and concentration limits." },
  { num: "05", title: "Rebalancing Engine", desc: "Rule-based triggers — drift, calendar, and risk-breach — execute disciplined rebalancing without emotion." },
  { num: "06", title: "Live Execution", desc: "Signals surface in your dashboard for manual or assisted execution with broker-level precision." },
];

const RISK_PILLARS: RiskPillar[] = [
  { label: "Max Drawdown Control", value: "DD", sub: "Hard stop on portfolio drawdown with auto-deleveraging signals." },
  { label: "Volatility Budgeting", value: "VB", sub: "Position sizes are volatility-adjusted so every bet risks the same." },
  { label: "Correlation Guard", value: "CG", sub: "Concentration in correlated clusters is capped to prevent factor blow-ups." },
  { label: "Regime Filter", value: "RF", sub: "Signals are suppressed in hostile regimes — capital preservation first." },
];

// ─── Utility hooks ────────────────────────────────────────────────────────────

function useReveal(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: threshold });
  return { ref, inView };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="lb-section-tag">
    <span className="lb-tag-line" />
    <span className="lb-tag-text">{children}</span>
    <span className="lb-tag-line" />
  </div>
);

const FeatureCard: React.FC<{ f: Feature; index: number }> = ({ f, index }) => {
  const { ref, inView } = useReveal();
  return (
    <motion.div
      ref={ref}
      className="lb-feature-card"
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="lb-card-tag">{f.tag}</span>
      <h3 className="lb-card-title">{f.title}</h3>
      <p className="lb-card-body">{f.body}</p>
      <div className="lb-card-arrow">→</div>
      <div className="lb-card-glow" />
    </motion.div>
  );
};

// ─── Animated counter ────────────────────────────────────────────────────────

const Counter: React.FC<{ to: number; suffix?: string; duration?: number }> = ({
  to, suffix = "", duration = 1.6,
}) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useReveal();

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, to, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// ─── Parallax ticker strip ────────────────────────────────────────────────────

const TICKER_ITEMS = [
  "Momentum", "Mean Reversion", "Regime Upside", "Regime Downside",
  "Range Bound", "Portfolio Backtest", "MVO Optimisation", "Risk Analytics",
  "Intraday Spreads", "Option Signals", "Factor Models", "Rebalancing",
];

const TickerStrip: React.FC = () => (
  <div className="lb-ticker-wrap">
    <div className="lb-ticker-track">
      {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
        <span key={i} className="lb-ticker-item">
          <span className="lb-ticker-dot">◆</span> {item}
        </span>
      ))}
    </div>
  </div>
);

// ─── Main LandingPage component ───────────────────────────────────────────────

const LandingPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);

  // Section 1 reveal
  const s1 = useReveal();
  // Section 3 workflow
  const s3 = useReveal();
  // Section 4 backtest
  const s4 = useReveal();
  // Section 5 risk
  const s5 = useReveal();
  // Section 6 intraday
  const s6 = useReveal();
  // CTA
  const cta = useReveal();

  return (
    <>
      {/* ── Google Fonts + global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=DM+Mono:wght@300;400;500&display=swap');

        :root {
          --lb-black:   #09090b;
          --lb-deep:    #0c0c0f;
          --lb-surface: #111114;
          --lb-raised:  #17171b;
          --lb-border:  rgba(255,255,255,0.07);
          --lb-gold:    #c9a84c;
          --lb-gold2:   #e8c96a;
          --lb-cream:   #e8e3d8;
          --lb-muted:   rgba(232,227,216,0.42);
          --lb-dim:     rgba(232,227,216,0.18);
          --lb-serif:   'Instrument Serif', Georgia, serif;
          --lb-sans:    'DM Sans', system-ui, sans-serif;
          --lb-mono:    'DM Mono', 'Courier New', monospace;
        }

        .lb-root {
          background: var(--lb-black);
          color: var(--lb-cream);
          font-family: var(--lb-sans);
          overflow-x: hidden;
        }

        /* ── Section tag ── */
        .lb-section-tag {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-bottom: 36px;
          font-family: var(--lb-mono);
          font-size: 9px;
          letter-spacing: 5px;
          color: var(--lb-gold);
          text-transform: uppercase;
        }
        .lb-tag-line {
          display: block;
          width: 48px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--lb-gold));
        }
        .lb-tag-line:last-child {
          background: linear-gradient(90deg, var(--lb-gold), transparent);
        }
        .lb-tag-text { white-space: nowrap; }

        /* ── Feature cards ── */
        .lb-feature-card {
          position: relative;
          padding: 36px 30px 32px;
          background: var(--lb-surface);
          border: 1px solid var(--lb-border);
          border-radius: 2px;
          overflow: hidden;
          cursor: default;
          transition: border-color 0.35s ease, background 0.35s ease;
        }
        .lb-feature-card:hover {
          border-color: rgba(201,168,76,0.3);
          background: var(--lb-raised);
        }
        .lb-card-tag {
          display: block;
          font-family: var(--lb-mono);
          font-size: 8px;
          letter-spacing: 4px;
          color: var(--lb-gold);
          opacity: 0.65;
          margin-bottom: 18px;
          text-transform: uppercase;
          transition: opacity 0.3s;
        }
        .lb-feature-card:hover .lb-card-tag { opacity: 1; }
        .lb-card-title {
          font-family: var(--lb-serif);
          font-size: 24px;
          font-weight: 400;
          color: var(--lb-cream);
          margin-bottom: 14px;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }
        .lb-card-body {
          font-family: var(--lb-sans);
          font-size: 13px;
          font-weight: 300;
          line-height: 1.8;
          color: var(--lb-muted);
        }
        .lb-card-arrow {
          margin-top: 24px;
          font-family: var(--lb-mono);
          font-size: 14px;
          color: var(--lb-gold);
          opacity: 0;
          transform: translateX(-8px);
          transition: opacity 0.3s, transform 0.3s;
        }
        .lb-feature-card:hover .lb-card-arrow {
          opacity: 0.8;
          transform: translateX(0);
        }
        /* Sweep glow on hover */
        .lb-card-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 100%, rgba(201,168,76,0.07) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
        }
        .lb-feature-card:hover .lb-card-glow { opacity: 1; }

        /* ── Ticker ── */
        .lb-ticker-wrap {
          overflow: hidden;
          border-top: 1px solid var(--lb-border);
          border-bottom: 1px solid var(--lb-border);
          padding: 18px 0;
          background: var(--lb-deep);
          mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
        }
        .lb-ticker-track {
          display: flex;
          gap: 0;
          width: max-content;
          animation: lb-ticker 38s linear infinite;
        }
        @keyframes lb-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .lb-ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 32px;
          font-family: var(--lb-mono);
          font-size: 10px;
          letter-spacing: 2.5px;
          color: var(--lb-dim);
          text-transform: uppercase;
          white-space: nowrap;
          transition: color 0.2s;
        }
        .lb-ticker-dot { color: var(--lb-gold); font-size: 6px; opacity: 0.5; }

        /* ── Workflow timeline ── */
        .lb-workflow-step {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 0 28px;
          align-items: start;
          padding: 36px 0;
          border-bottom: 1px solid var(--lb-border);
          position: relative;
        }
        .lb-workflow-step:last-child { border-bottom: none; }
        .lb-step-num {
          font-family: var(--lb-serif);
          font-size: 48px;
          font-weight: 400;
          color: rgba(201,168,76,0.15);
          line-height: 1;
          letter-spacing: -2px;
          padding-top: 4px;
          transition: color 0.3s;
        }
        .lb-workflow-step:hover .lb-step-num { color: rgba(201,168,76,0.45); }
        .lb-step-body {}
        .lb-step-title {
          font-family: var(--lb-serif);
          font-size: 22px;
          font-weight: 400;
          color: var(--lb-cream);
          margin-bottom: 8px;
          letter-spacing: -0.2px;
        }
        .lb-step-desc {
          font-family: var(--lb-sans);
          font-size: 13px;
          font-weight: 300;
          line-height: 1.8;
          color: var(--lb-muted);
        }

        /* ── Risk pillars ── */
        .lb-risk-pillar {
          padding: 32px 28px;
          border: 1px solid var(--lb-border);
          border-radius: 2px;
          background: var(--lb-surface);
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s;
        }
        .lb-risk-pillar:hover { border-color: rgba(201,168,76,0.25); }
        .lb-risk-badge {
          font-family: var(--lb-serif);
          font-style: italic;
          font-size: 38px;
          color: rgba(201,168,76,0.2);
          margin-bottom: 16px;
          display: block;
          line-height: 1;
          transition: color 0.3s;
        }
        .lb-risk-pillar:hover .lb-risk-badge { color: rgba(201,168,76,0.45); }
        .lb-risk-label {
          font-family: var(--lb-mono);
          font-size: 9px;
          letter-spacing: 3px;
          color: var(--lb-gold);
          text-transform: uppercase;
          margin-bottom: 10px;
          display: block;
        }
        .lb-risk-sub {
          font-family: var(--lb-sans);
          font-size: 12px;
          font-weight: 300;
          line-height: 1.75;
          color: var(--lb-muted);
        }

        /* ── Intraday section bars ── */
        .lb-intraday-bar {
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, var(--lb-gold), transparent);
        }

        /* ── CTA section ── */
        .lb-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 36px;
          background: var(--lb-gold);
          color: var(--lb-black);
          font-family: var(--lb-mono);
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 500;
          border: none;
          border-radius: 2px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: opacity 0.2s, transform 0.2s;
        }
        .lb-cta-btn:hover { opacity: 0.88; transform: translateY(-2px); }
        .lb-cta-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent);
          transform: translateX(-100%);
          transition: transform 0.55s ease;
        }
        .lb-cta-btn:hover::after { transform: translateX(100%); }

        .lb-cta-ghost {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 36px;
          background: transparent;
          color: var(--lb-muted);
          font-family: var(--lb-mono);
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          border: 1px solid var(--lb-border);
          border-radius: 2px;
          cursor: pointer;
          transition: border-color 0.25s, color 0.25s;
        }
        .lb-cta-ghost:hover {
          border-color: rgba(201,168,76,0.4);
          color: var(--lb-cream);
        }

        /* ── Divider ── */
        .lb-divider {
          height: 1px;
          background: var(--lb-border);
          margin: 0;
        }

        /* ── Scan lines texture overlay ── */
        .lb-scanlines {
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.04) 2px,
            rgba(0,0,0,0.04) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        /* ── Stat numbers ── */
        .lb-big-stat {
          font-family: var(--lb-serif);
          font-style: italic;
          font-size: 72px;
          line-height: 1;
          color: var(--lb-gold);
          letter-spacing: -2px;
        }

        /* ── Backtest chart bars ── */
        .lb-bar-wrap {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 80px;
        }
        .lb-bar {
          flex: 1;
          border-radius: 2px 2px 0 0;
          background: linear-gradient(to top, rgba(201,168,76,0.6), rgba(201,168,76,0.15));
          transition: background 0.2s;
          animation: lb-barrise 0.8s ease both;
        }
        @keyframes lb-barrise {
          from { transform: scaleY(0); transform-origin: bottom; }
          to   { transform: scaleY(1); }
        }
        .lb-bar:hover {
          background: linear-gradient(to top, var(--lb-gold), rgba(201,168,76,0.3));
        }
      `}</style>

      <div ref={containerRef} className="lb-root">

        {/* ══════════════════════════════════════════════════
            SECTION 1 — AI Quant Fund Manager Intro
        ══════════════════════════════════════════════════ */}
        <section style={{ padding: "160px 60px", position: "relative", overflow: "hidden" }}>
          {/* Background ambient glow */}
          <div style={{
            position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
            width: "900px", height: "600px",
            background: "radial-gradient(ellipse, rgba(201,168,76,0.05) 0%, transparent 65%)",
            pointerEvents: "none",
          }} />

          <div ref={s1.ref} style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <SectionTag>AI QUANT FUND MANAGER</SectionTag>

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={s1.inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{ textAlign: "center", marginBottom: "80px" }}
            >
              <h2 style={{
                fontFamily: "var(--lb-serif)",
                fontSize: "clamp(48px, 7vw, 88px)",
                fontWeight: 400,
                color: "var(--lb-cream)",
                letterSpacing: "-2px",
                lineHeight: 1.0,
                marginBottom: "28px",
              }}>
                not a screener.<br />
                a <em style={{ color: "var(--lb-gold)", fontStyle: "italic" }}>thinking</em> fund manager.
              </h2>

              <p style={{
                fontFamily: "var(--lb-sans)",
                fontSize: "15px",
                fontWeight: 300,
                lineHeight: 1.9,
                color: "var(--lb-muted)",
                maxWidth: "640px",
                margin: "0 auto 56px",
              }}>
                LightninBull runs a full quant pipeline — factor scoring, regime detection, portfolio construction,
                and risk controls — so your capital is always positioned by mathematics, never by emotion.
              </p>

              {/* Stats row */}
              <motion.div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0",
                  border: "1px solid var(--lb-border)",
                  borderRadius: "2px",
                  maxWidth: "680px",
                  margin: "0 auto",
                  overflow: "hidden",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={s1.inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {[
                  { n: 16, suf: "+", lbl: "AI Modules" },
                  { n: 6, suf: "", lbl: "Model Types" },
                  { n: 100, suf: "%", lbl: "Rules-based" },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1,
                    padding: "28px 24px",
                    borderRight: i < 2 ? "1px solid var(--lb-border)" : "none",
                    textAlign: "center",
                  }}>
                    <div className="lb-big-stat" style={{ fontSize: "52px" }}>
                      <Counter to={s.n} suffix={s.suf} />
                    </div>
                    <div style={{
                      fontFamily: "var(--lb-mono)", fontSize: "8px",
                      letterSpacing: "3px", color: "var(--lb-dim)",
                      textTransform: "uppercase", marginTop: "6px",
                    }}>{s.lbl}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Ticker strip */}
        <TickerStrip />

        {/* ══════════════════════════════════════════════════
            SECTION 2 — Feature Cards
        ══════════════════════════════════════════════════ */}
        <section style={{ padding: "140px 60px", background: "var(--lb-deep)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <SectionTag>THE SIGNAL STACK</SectionTag>

            <div style={{ textAlign: "center", marginBottom: "72px" }}>
              <h2 style={{
                fontFamily: "var(--lb-serif)",
                fontSize: "clamp(36px, 5vw, 64px)",
                fontWeight: 400,
                color: "var(--lb-cream)",
                letterSpacing: "-1.5px",
                lineHeight: 1.05,
              }}>
                every model.<br />
                <em style={{ color: "var(--lb-gold)" }}>every edge.</em>
              </h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1px",
              border: "1px solid var(--lb-border)",
              borderRadius: "2px",
              overflow: "hidden",
            }}>
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.id} f={f} index={i} />
              ))}
            </div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════════════
            SECTION 3 — Quant Workflow
        ══════════════════════════════════════════════════ */}
        <section style={{ padding: "160px 60px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "start" }}>

              {/* Left: sticky heading */}
              <div ref={s3.ref} style={{ position: "sticky", top: "100px" }}>
                <SectionTag>THE WORKFLOW</SectionTag>

                <motion.h2
                  style={{
                    fontFamily: "var(--lb-serif)",
                    fontSize: "clamp(36px, 4.5vw, 60px)",
                    fontWeight: 400,
                    color: "var(--lb-cream)",
                    letterSpacing: "-1.5px",
                    lineHeight: 1.05,
                    marginBottom: "24px",
                  }}
                  initial={{ opacity: 0, x: -30 }}
                  animate={s3.inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                >
                  from raw data<br />
                  to live <em style={{ color: "var(--lb-gold)" }}>signal</em>.
                </motion.h2>

                <motion.p
                  style={{
                    fontFamily: "var(--lb-sans)", fontSize: "13px", fontWeight: 300,
                    lineHeight: 1.9, color: "var(--lb-muted)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={s3.inView ? { opacity: 1 } : {}}
                  transition={{ duration: 0.6, delay: 0.15 }}
                >
                  Every signal that reaches your screen has passed through a rigorous
                  six-stage pipeline — ingested, scored, ranked, constructed, rebalanced,
                  and delivered with precision.
                </motion.p>

                {/* Mini visual decoration */}
                <motion.div
                  style={{
                    marginTop: "48px",
                    width: "100%",
                    height: "2px",
                    background: "linear-gradient(90deg, var(--lb-gold), transparent)",
                  }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={s3.inView ? { scaleX: 1 } : {}}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>

              {/* Right: steps */}
              <div>
                {WORKFLOW.map((step, i) => (
                  <motion.div
                    key={step.num}
                    className="lb-workflow-step"
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="lb-step-num">{step.num}</div>
                    <div className="lb-step-body">
                      <h3 className="lb-step-title">{step.title}</h3>
                      <p className="lb-step-desc">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════════════
            SECTION 4 — Portfolio Backtest
        ══════════════════════════════════════════════════ */}
        <section style={{ padding: "160px 60px", background: "var(--lb-deep)", position: "relative", overflow: "hidden" }}>
          {/* Decorative background grid */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />

          <div ref={s4.ref} style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "100px", alignItems: "center" }}>

              {/* Left: visual */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={s4.inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Mock equity curve bars */}
                <div style={{
                  background: "var(--lb-surface)",
                  border: "1px solid var(--lb-border)",
                  borderRadius: "2px",
                  padding: "32px",
                }}>
                  {/* Chart header */}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: "28px",
                  }}>
                    <div>
                      <div style={{ fontFamily: "var(--lb-mono)", fontSize: "8px", letterSpacing: "3px", color: "var(--lb-gold)", marginBottom: "4px" }}>EQUITY CURVE</div>
                      <div style={{ fontFamily: "var(--lb-serif)", fontSize: "28px", color: "var(--lb-cream)", letterSpacing: "-0.5px" }}>
                        <Counter to={247} suffix="%" />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "var(--lb-mono)", fontSize: "8px", letterSpacing: "2px", color: "var(--lb-dim)", marginBottom: "4px" }}>CAGR</div>
                      <div style={{ fontFamily: "var(--lb-serif)", fontSize: "20px", color: "var(--lb-gold)" }}>
                        <Counter to={34} suffix="%" />
                      </div>
                    </div>
                  </div>

                  {/* Fake equity bars */}
                  {s4.inView && (
                    <div className="lb-bar-wrap" style={{ marginBottom: "16px" }}>
                      {[28,42,35,55,48,62,45,70,58,75,65,82,72,88,80,95].map((h, i) => (
                        <div
                          key={i}
                          className="lb-bar"
                          style={{
                            height: `${h}%`,
                            animationDelay: `${i * 0.04}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* X axis labels */}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    fontFamily: "var(--lb-mono)", fontSize: "8px",
                    color: "var(--lb-dim)", letterSpacing: "1px",
                  }}>
                    {["Q1", "Q2", "Q3", "Q4", "Q1", "Q2", "Q3", "Q4"].map((q, i) => (
                      <span key={i}>{q}</span>
                    ))}
                  </div>

                  {/* Metrics row */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "0", marginTop: "28px",
                    borderTop: "1px solid var(--lb-border)",
                    paddingTop: "20px",
                  }}>
                    {[
                      { lbl: "Sharpe", val: "2.4" },
                      { lbl: "Max DD", val: "−12%" },
                      { lbl: "Win Rate", val: "68%" },
                    ].map((m, i) => (
                      <div key={i} style={{
                        textAlign: "center",
                        borderRight: i < 2 ? "1px solid var(--lb-border)" : "none",
                      }}>
                        <div style={{ fontFamily: "var(--lb-serif)", fontSize: "22px", color: "var(--lb-cream)", letterSpacing: "-0.5px" }}>{m.val}</div>
                        <div style={{ fontFamily: "var(--lb-mono)", fontSize: "7px", letterSpacing: "2px", color: "var(--lb-dim)", marginTop: "4px", textTransform: "uppercase" }}>{m.lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Right: copy */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={s4.inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <SectionTag>PORTFOLIO BACKTEST</SectionTag>

                <h2 style={{
                  fontFamily: "var(--lb-serif)",
                  fontSize: "clamp(32px, 4vw, 54px)",
                  fontWeight: 400,
                  color: "var(--lb-cream)",
                  letterSpacing: "-1.5px",
                  lineHeight: 1.05,
                  marginBottom: "24px",
                }}>
                  see it survive<br />
                  <em style={{ color: "var(--lb-gold)" }}>every market</em><br />
                  before you trade it.
                </h2>

                <p style={{
                  fontFamily: "var(--lb-sans)", fontSize: "14px", fontWeight: 300,
                  lineHeight: 1.9, color: "var(--lb-muted)", marginBottom: "36px",
                }}>
                  Run full historical simulations with realistic assumptions — commissions,
                  slippage, rebalancing costs. See drawdown periods, rolling Sharpe,
                  and year-by-year attribution before committing a single rupee.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {[
                    "Equal Weight & MVO portfolio construction",
                    "Rebalancing rules — drift, calendar, risk-breach",
                    "Year-by-year PnL attribution",
                    "Drawdown, Sharpe, Calmar analytics",
                  ].map((pt, i) => (
                    <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--lb-gold)", fontFamily: "var(--lb-mono)", fontSize: "10px", marginTop: "3px", flexShrink: 0 }}>◆</span>
                      <span style={{ fontFamily: "var(--lb-sans)", fontSize: "13px", fontWeight: 300, color: "var(--lb-muted)", lineHeight: 1.7 }}>{pt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════════════
            SECTION 5 — Risk Control
        ══════════════════════════════════════════════════ */}
        <section style={{ padding: "160px 60px" }}>
          <div ref={s5.ref} style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <SectionTag>RISK CONTROL</SectionTag>

            <motion.div
              style={{ textAlign: "center", marginBottom: "80px" }}
              initial={{ opacity: 0, y: 30 }}
              animate={s5.inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65 }}
            >
              <h2 style={{
                fontFamily: "var(--lb-serif)",
                fontSize: "clamp(36px, 5vw, 66px)",
                fontWeight: 400,
                color: "var(--lb-cream)",
                letterSpacing: "-1.5px",
                lineHeight: 1.0,
              }}>
                the models know when<br />
                <em style={{ color: "var(--lb-gold)" }}>not to play.</em>
              </h2>
            </motion.div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1px",
              background: "var(--lb-border)",
              border: "1px solid var(--lb-border)",
              borderRadius: "2px",
              overflow: "hidden",
            }}>
              {RISK_PILLARS.map((p, i) => (
                <motion.div
                  key={p.label}
                  className="lb-risk-pillar"
                  initial={{ opacity: 0, y: 24 }}
                  animate={s5.inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.09 }}
                >
                  <span className="lb-risk-badge">{p.value}</span>
                  <span className="lb-risk-label">{p.label}</span>
                  <p className="lb-risk-sub">{p.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Disclaimer strip */}
            <motion.div
              style={{
                marginTop: "48px",
                padding: "20px 28px",
                border: "1px solid var(--lb-border)",
                borderRadius: "2px",
                background: "var(--lb-surface)",
                display: "flex",
                alignItems: "center",
                gap: "20px",
              }}
              initial={{ opacity: 0 }}
              animate={s5.inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5 }}
            >
              <span style={{ color: "var(--lb-gold)", fontSize: "18px", flexShrink: 0 }}>⚠</span>
              <p style={{
                fontFamily: "var(--lb-mono)", fontSize: "10px", letterSpacing: "1px",
                color: "var(--lb-dim)", lineHeight: 1.7,
              }}>
                All models are probabilistic tools, not guarantees. Past backtest performance
                does not guarantee future results. LightninBull signals are for informational
                purposes — always apply your own risk judgement.
              </p>
            </motion.div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════════════
            SECTION 6 — Intraday Trading Intelligence
        ══════════════════════════════════════════════════ */}
        <section style={{ padding: "160px 60px", background: "var(--lb-deep)", position: "relative", overflow: "hidden" }}>
          {/* Ambient light */}
          <div style={{
            position: "absolute", bottom: "-200px", right: "-100px",
            width: "700px", height: "500px",
            background: "radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 65%)",
            pointerEvents: "none",
          }} />

          <div ref={s6.ref} style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <SectionTag>INTRADAY INTELLIGENCE</SectionTag>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "100px", alignItems: "center" }}>

              {/* Left: copy */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={s6.inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 style={{
                  fontFamily: "var(--lb-serif)",
                  fontSize: "clamp(32px, 4vw, 56px)",
                  fontWeight: 400,
                  color: "var(--lb-cream)",
                  letterSpacing: "-1.5px",
                  lineHeight: 1.05,
                  marginBottom: "24px",
                }}>
                  the market opens.<br />
                  <em style={{ color: "var(--lb-gold)" }}>you're already positioned.</em>
                </h2>

                <p style={{
                  fontFamily: "var(--lb-sans)", fontSize: "14px", fontWeight: 300,
                  lineHeight: 1.9, color: "var(--lb-muted)", marginBottom: "40px",
                }}>
                  Intraday signals for Nifty/BankNifty option spreads and high-conviction
                  stock signals surface pre-market — so your plan is set before the bell rings.
                </p>

                {/* Signal type bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    { label: "Bull Call Spreads", width: "85%", desc: "Index intraday upside setups" },
                    { label: "Bear Put Spreads", width: "78%", desc: "Index intraday downside setups" },
                    { label: "Stock Long Signals", width: "92%", desc: "Momentum-confirmed buy setups" },
                    { label: "Stock Short Signals", width: "71%", desc: "Reversal and breakdown setups" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={s6.inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.15 + i * 0.08 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontFamily: "var(--lb-sans)", fontSize: "13px", fontWeight: 400, color: "var(--lb-cream)" }}>{item.label}</span>
                        <span style={{ fontFamily: "var(--lb-mono)", fontSize: "9px", letterSpacing: "1px", color: "var(--lb-dim)" }}>{item.desc}</span>
                      </div>
                      <div style={{ height: "2px", background: "var(--lb-border)", borderRadius: "2px", overflow: "hidden" }}>
                        <motion.div
                          style={{ height: "100%", background: "linear-gradient(90deg, var(--lb-gold), rgba(201,168,76,0.3))", borderRadius: "2px" }}
                          initial={{ width: "0%" }}
                          animate={s6.inView ? { width: item.width } : {}}
                          transition={{ duration: 1, delay: 0.4 + i * 0.1, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right: mock signal cards */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={s6.inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                {[
                  { type: "BUY", instrument: "NIFTY 24200 CE", strategy: "Bull Call Spread", entry: "₹ 185", target: "₹ 280", sl: "₹ 120", conf: "HIGH" },
                  { type: "SELL", instrument: "BANKNIFTY 51500 PE", strategy: "Bear Put Spread", entry: "₹ 240", target: "₹ 380", sl: "₹ 155", conf: "MEDIUM" },
                  { type: "BUY", instrument: "RELIANCE NSE", strategy: "Momentum Long", entry: "₹ 2,840", target: "₹ 2,920", sl: "₹ 2,800", conf: "HIGH" },
                ].map((sig, i) => (
                  <motion.div
                    key={i}
                    style={{
                      background: "var(--lb-surface)",
                      border: "1px solid var(--lb-border)",
                      borderRadius: "2px",
                      padding: "20px 22px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    whileHover={{ borderColor: "rgba(201,168,76,0.3)", scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Left color accent */}
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0, width: "2px",
                      background: sig.type === "BUY"
                        ? "linear-gradient(to bottom, #4ade80, rgba(74,222,128,0.2))"
                        : "linear-gradient(to bottom, #f87171, rgba(248,113,113,0.2))",
                    }} />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                          <span style={{
                            fontFamily: "var(--lb-mono)", fontSize: "8px", letterSpacing: "2px",
                            color: sig.type === "BUY" ? "#4ade80" : "#f87171",
                            background: sig.type === "BUY" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                            padding: "2px 8px", borderRadius: "1px",
                          }}>{sig.type}</span>
                          <span style={{ fontFamily: "var(--lb-mono)", fontSize: "8px", letterSpacing: "1.5px", color: "var(--lb-dim)" }}>{sig.strategy}</span>
                        </div>
                        <div style={{ fontFamily: "var(--lb-sans)", fontSize: "14px", fontWeight: 500, color: "var(--lb-cream)" }}>{sig.instrument}</div>
                      </div>
                      <span style={{
                        fontFamily: "var(--lb-mono)", fontSize: "7px", letterSpacing: "2px",
                        color: sig.conf === "HIGH" ? "var(--lb-gold)" : "var(--lb-muted)",
                        border: `1px solid ${sig.conf === "HIGH" ? "rgba(201,168,76,0.3)" : "var(--lb-border)"}`,
                        padding: "3px 8px", borderRadius: "1px",
                      }}>{sig.conf}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                      {[
                        { lbl: "Entry", val: sig.entry },
                        { lbl: "Target", val: sig.target },
                        { lbl: "Stop Loss", val: sig.sl },
                      ].map((m, j) => (
                        <div key={j}>
                          <div style={{ fontFamily: "var(--lb-mono)", fontSize: "7px", letterSpacing: "2px", color: "var(--lb-dim)", marginBottom: "3px" }}>{m.lbl}</div>
                          <div style={{ fontFamily: "var(--lb-mono)", fontSize: "12px", color: "var(--lb-cream)" }}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}

                <p style={{
                  fontFamily: "var(--lb-mono)", fontSize: "8px", letterSpacing: "1.5px",
                  color: "var(--lb-dim)", textAlign: "center", marginTop: "4px",
                  lineHeight: 1.6,
                }}>
                  ILLUSTRATIVE SIGNALS · NOT INVESTMENT ADVICE
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════════════
            SECTION 7 — Final CTA
        ══════════════════════════════════════════════════ */}
        <section style={{ padding: "180px 60px", position: "relative", overflow: "hidden" }}>
          {/* Large ambient glow */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "1000px", height: "600px",
            background: "radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 60%)",
            pointerEvents: "none",
          }} />

          <div ref={cta.ref} style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={cta.inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <p style={{
                fontFamily: "var(--lb-mono)", fontSize: "9px", letterSpacing: "5px",
                color: "var(--lb-gold)", textTransform: "uppercase", marginBottom: "36px",
              }}>
                NOT EVERYONE MAKES IT IN
              </p>

              <h2 style={{
                fontFamily: "var(--lb-serif)",
                fontSize: "clamp(48px, 8vw, 100px)",
                fontWeight: 400,
                color: "var(--lb-cream)",
                letterSpacing: "-3px",
                lineHeight: 0.95,
                marginBottom: "32px",
              }}>
                trade like a<br />
                <em style={{
                  color: "var(--lb-gold)",
                  textShadow: "0 0 60px rgba(201,168,76,0.4), 0 0 120px rgba(201,168,76,0.15)",
                }}>
                  quant fund.
                </em>
              </h2>

              <p style={{
                fontFamily: "var(--lb-sans)", fontSize: "15px", fontWeight: 300,
                lineHeight: 1.85, color: "var(--lb-muted)",
                maxWidth: "520px", margin: "0 auto 56px",
              }}>
                LightninBull brings institutional-grade models, risk controls, and
                portfolio intelligence to individual traders — for the first time.
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
                <button className="lb-cta-btn">
                  Access Dashboard →
                </button>
                <button className="lb-cta-ghost">
                  View all features
                </button>
              </div>

              {/* Fine print */}
              <p style={{
                marginTop: "40px",
                fontFamily: "var(--lb-mono)", fontSize: "8px", letterSpacing: "1.5px",
                color: "var(--lb-dim)", lineHeight: 1.7,
              }}>
                LIGHTNINBULL · INSTITUTIONAL QUANT INTELLIGENCE<br />
                ALL SIGNALS FOR INFORMATIONAL PURPOSES ONLY · TRADE RESPONSIBLY
              </p>
            </motion.div>
          </div>
        </section>

      </div>
    </>
  );
};

export default LandingPage;
