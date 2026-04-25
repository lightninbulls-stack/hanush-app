/**
 * LightninBull — Premium Landing Page (Animation Upgrade v2)
 * ─────────────────────────────────────────────────────────────
 * Drop below your existing hero video in Auth.tsx (or any page).
 * Safe: no routes, no dashboard, no sidebar touched.
 *
 *   npm install framer-motion
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  AnimatePresence,
} from "framer-motion";

// ─── Design tokens ────────────────────────────────────────────
const T = {
  black:   "#09090b",
  deep:    "#0c0c0f",
  surface: "#111114",
  raised:  "#17171b",
  border:  "rgba(255,255,255,0.07)",
  gold:    "#c9a84c",
  gold2:   "#e8c96a",
  cream:   "#e8e3d8",
  muted:   "rgba(232,227,216,0.42)",
  dim:     "rgba(232,227,216,0.18)",
  serif:   "'Instrument Serif', Georgia, serif",
  sans:    "'DM Sans', system-ui, sans-serif",
  mono:    "'DM Mono', 'Courier New', monospace",
} as const;

// ─── Easing curves ────────────────────────────────────────────
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_OUT_CIRC = [0.0, 0.55, 0.45, 1] as const;

// ─── Framer Motion variants ───────────────────────────────────
const fadeUp = (delay = 0, distance = 40) => ({
  hidden:  { opacity: 0, y: distance },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, delay, ease: EASE_OUT_EXPO } },
});

const fadeLeft = (delay = 0) => ({
  hidden:  { opacity: 0, x: -48 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO } },
});

const fadeRight = (delay = 0) => ({
  hidden:  { opacity: 0, x: 48 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO } },
});

const scaleIn = (delay = 0) => ({
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.65, delay, ease: EASE_OUT_EXPO } },
});

const staggerContainer = (stagger = 0.09, delayChildren = 0) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

const cardVariant = {
  hidden:  { opacity: 0, y: 36, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

// ─── Types ────────────────────────────────────────────────────
interface Feature     { id: string; tag: string; title: string; body: string; }
interface WorkflowStep{ num: string; title: string; desc: string; }
interface RiskPillar  { label: string; value: string; sub: string; }

// ─── Static data ──────────────────────────────────────────────
const FEATURES: Feature[] = [
  { id: "momentum", tag: "SIGNAL ENGINE",  title: "Momentum Models",
    body: "Cross-sectional and time-series momentum factors identify trending instruments before the crowd moves in." },
  { id: "meanrev",  tag: "MEAN REVERSION", title: "Mean Reversion Models",
    body: "Statistical z-score and Bollinger-based engines detect overextension and surface high-probability snap-back setups." },
  { id: "regime",   tag: "MACRO LENS",     title: "Regime Intelligence",
    body: "Dynamic upside/downside regime classifiers adapt the signal stack to prevailing market conditions in real time." },
  { id: "range",    tag: "RANGE BOUND",    title: "Range Bound Models",
    body: "Channel-aware algorithms harvest premium in sideways markets where trend-followers bleed." },
  { id: "options",  tag: "DERIVATIVES",    title: "Aggressive Option Stocks",
    body: "Quantitatively screened high-IV, high-conviction call and put candidates — ranked daily by expected value." },
  { id: "intraday", tag: "INTRADAY",       title: "Index Option Spreads",
    body: "Intraday bull call and bear put spread signals on index options, with defined risk and high-frequency entry logic." },
];

const WORKFLOW: WorkflowStep[] = [
  { num: "01", title: "Data Ingestion",        desc: "Multi-feed OHLCV, options chain, and macro regime data normalised into a unified quant layer." },
  { num: "02", title: "Factor Scoring",        desc: "Momentum, value, quality, and volatility factors scored cross-sectionally across the entire universe." },
  { num: "03", title: "Signal Generation",     desc: "Model ensemble produces ranked signals with confidence scores, entry zones, and risk parameters." },
  { num: "04", title: "Portfolio Construction",desc: "Equal-weight and MVO optimisation build allocations respecting drawdown, correlation, and concentration limits." },
  { num: "05", title: "Rebalancing Engine",    desc: "Rule-based triggers — drift, calendar, and risk-breach — execute disciplined rebalancing without emotion." },
  { num: "06", title: "Live Execution",        desc: "Signals surface in your dashboard for manual or assisted execution with broker-level precision." },
];

const RISK_PILLARS: RiskPillar[] = [
  { label: "Max Drawdown Control", value: "DD", sub: "Hard stop on portfolio drawdown with auto-deleveraging signals." },
  { label: "Volatility Budgeting", value: "VB", sub: "Position sizes are volatility-adjusted so every bet risks the same." },
  { label: "Correlation Guard",    value: "CG", sub: "Concentration in correlated clusters is capped to prevent factor blow-ups." },
  { label: "Regime Filter",        value: "RF", sub: "Signals are suppressed in hostile regimes — capital preservation first." },
];

const TICKER_ITEMS = [
  "Momentum","Mean Reversion","Regime Upside","Regime Downside",
  "Range Bound","Portfolio Backtest","MVO Optimisation","Risk Analytics",
  "Intraday Spreads","Option Signals","Factor Models","Rebalancing",
];

const SIGNALS = [
  { type:"BUY",  instrument:"NIFTY 24200 CE",    strategy:"Bull Call Spread", entry:"₹ 185",   target:"₹ 280",   sl:"₹ 120",   conf:"HIGH"   },
  { type:"SELL", instrument:"BANKNIFTY 51500 PE", strategy:"Bear Put Spread",  entry:"₹ 240",   target:"₹ 380",   sl:"₹ 155",   conf:"MEDIUM" },
  { type:"BUY",  instrument:"RELIANCE NSE",        strategy:"Momentum Long",   entry:"₹ 2,840", target:"₹ 2,920", sl:"₹ 2,800", conf:"HIGH"   },
];

// ─── useReveal ────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: threshold });
  return { ref, inView };
}

// ─── useMagneticHover ─────────────────────────────────────────
function useMagneticHover(strength = 0.22) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 180, damping: 18 });
  const sy = useSpring(my, { stiffness: 180, damping: 18 });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width  / 2) * strength);
    my.set((e.clientY - r.top  - r.height / 2) * strength);
  }, [mx, my, strength]);

  const onLeave = useCallback(() => { mx.set(0); my.set(0); }, [mx, my]);
  return { sx, sy, onMove, onLeave };
}

// ─── Animated counter ─────────────────────────────────────────
const Counter: React.FC<{ to: number; suffix?: string; duration?: number }> = ({
  to, suffix = "", duration = 1.8,
}) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useReveal();

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / (duration * 1000), 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setCount(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// ─── SectionTag ───────────────────────────────────────────────
const SectionTag: React.FC<{ children: React.ReactNode; center?: boolean }> = ({
  children, center = true,
}) => (
  <motion.div
    className="lb-section-tag"
    style={{ justifyContent: center ? "center" : "flex-start" }}
    variants={fadeUp(0, 18)}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.5 }}
  >
    <span className="lb-tag-line" />
    <span className="lb-tag-text">{children}</span>
    <span className="lb-tag-line lb-tag-line-r" />
  </motion.div>
);

// ─── FeatureCard with cursor-tracking spotlight ───────────────
const FeatureCard: React.FC<{ f: Feature }> = ({ f }) => {
  const { sx, sy, onMove, onLeave } = useMagneticHover(0.14);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    onMove(e);
    const r = e.currentTarget.getBoundingClientRect();
    setPos({
      x: ((e.clientX - r.left) / r.width)  * 100,
      y: ((e.clientY - r.top)  / r.height) * 100,
    });
  };

  return (
    <motion.div
      className="lb-feature-card"
      variants={cardVariant}
      style={{ x: sx, y: sy, position: "relative", overflow: "hidden" }}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { onLeave(); setHovered(false); }}
      whileHover={{ y: -5, transition: { duration: 0.28, ease: EASE_OUT_CIRC } }}
    >
      {/* Cursor spotlight */}
      <div
        className="lb-card-spotlight"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(240px circle at ${pos.x}% ${pos.y}%,
            rgba(201,168,76,0.11) 0%, transparent 65%)`,
        }}
      />
      {/* Top hairline */}
      <motion.div
        className="lb-card-topline"
        animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
        style={{ originX: 0 }}
      />

      <span className="lb-card-tag">{f.tag}</span>
      <h3 className="lb-card-title">{f.title}</h3>
      <p className="lb-card-body">{f.body}</p>

      <motion.div
        className="lb-card-arrow"
        animate={{ x: hovered ? 0 : -10, opacity: hovered ? 0.9 : 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT_CIRC }}
      >→</motion.div>
    </motion.div>
  );
};

// ─── Ticker strip ─────────────────────────────────────────────
const TickerStrip: React.FC<{ reverse?: boolean }> = ({ reverse = false }) => (
  <div className="lb-ticker-wrap">
    <div className="lb-ticker-track" style={{ animationDirection: reverse ? "reverse" : "normal" }}>
      {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
        <span key={i} className="lb-ticker-item">
          <span className="lb-ticker-dot">◆</span>{item}
        </span>
      ))}
    </div>
  </div>
);

// ─── Floating particles ───────────────────────────────────────
const ParticleField: React.FC<{ count?: number }> = ({ count = 24 }) => {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.6 + 0.4,
      dur: Math.random() * 9 + 7,
      delay: Math.random() * 6,
      driftX: (Math.random() - 0.5) * 40,
    }))
  ).current;

  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
            width: p.size, height: p.size,
            borderRadius:"50%", background: T.gold,
          }}
          animate={{ y:[0,-70,0], x:[0, p.driftX, 0], opacity:[0, 0.32, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease:"easeInOut" }}
        />
      ))}
    </div>
  );
};

// ─── Scroll progress bar ──────────────────────────────────────
const ScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 80, damping: 28 });
  return (
    <motion.div
      style={{
        position:"fixed", top:0, left:0, right:0, height:"2px",
        background:`linear-gradient(90deg, ${T.gold}, ${T.gold2})`,
        transformOrigin:"left", scaleX, zIndex:9999,
      }}
    />
  );
};

// ─── Workflow step ────────────────────────────────────────────
const WfStep: React.FC<{
  step: WorkflowStep; index: number;
  active: number; onEnter: (i: number) => void;
}> = ({ step, index, active, onEnter }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.55 });
  const isActive = active === index;

  useEffect(() => { if (inView) onEnter(index); }, [inView, index, onEnter]);

  return (
    <motion.div
      ref={ref}
      className="lb-workflow-step"
      variants={fadeRight(index * 0.06)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      style={{ borderBottomColor: isActive ? "rgba(201,168,76,0.22)" : T.border }}
    >
      <motion.div
        className="lb-step-num"
        animate={{ color: isActive ? "rgba(201,168,76,0.55)" : "rgba(201,168,76,0.13)" }}
        transition={{ duration: 0.4 }}
      >{step.num}</motion.div>

      <div className="lb-step-body">
        <motion.h3
          className="lb-step-title"
          animate={{ color: isActive ? T.cream : "rgba(232,227,216,0.55)" }}
          transition={{ duration: 0.4 }}
        >{step.title}</motion.h3>

        <motion.p
          className="lb-step-desc"
          animate={{ opacity: isActive ? 1 : 0.4 }}
          transition={{ duration: 0.4 }}
        >{step.desc}</motion.p>

        <motion.div
          style={{
            height:"1px", marginTop:"16px",
            background:`linear-gradient(90deg, ${T.gold}, transparent)`,
            transformOrigin:"left",
          }}
          animate={{ scaleX: isActive ? 1 : 0, opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        />
      </div>
    </motion.div>
  );
};

// ─── Risk pillar card ─────────────────────────────────────────
const RiskCard: React.FC<{ p: RiskPillar }> = ({ p }) => {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      className="lb-risk-pillar"
      variants={cardVariant}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      whileHover={{ y: -6, transition:{ duration:0.28, ease: EASE_OUT_CIRC } }}
      style={{ position:"relative", overflow:"hidden" }}
    >
      {/* Corner brackets */}
      {[
        { top:0,    left:0,    borderTop:`1px solid ${T.gold}`,    borderLeft:`1px solid ${T.gold}`    },
        { bottom:0, right:0,   borderBottom:`1px solid ${T.gold}`, borderRight:`1px solid ${T.gold}`   },
      ].map((s, i) => (
        <motion.div key={i}
          style={{ position:"absolute", width:22, height:22, ...s }}
          animate={{ opacity: hov ? 0.55 : 0 }}
          transition={{ duration:0.3 }}
        />
      ))}

      {/* Glow */}
      <motion.div
        style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse at 50% 110%, rgba(201,168,76,0.08) 0%, transparent 65%)",
        }}
        animate={{ opacity: hov ? 1 : 0 }}
        transition={{ duration:0.4 }}
      />

      <motion.span
        className="lb-risk-badge"
        animate={{ color: hov ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.17)" }}
        transition={{ duration:0.35 }}
      >{p.value}</motion.span>
      <span className="lb-risk-label">{p.label}</span>
      <p className="lb-risk-sub">{p.sub}</p>
    </motion.div>
  );
};

// ─── Signal card ──────────────────────────────────────────────
const SignalCard: React.FC<{
  sig: typeof SIGNALS[0]; index: number;
}> = ({ sig, index }) => {
  const isBuy = sig.type === "BUY";
  return (
    <motion.div
      variants={fadeUp(index * 0.1, 24)}
      style={{
        background: T.surface, border:`1px solid ${T.border}`,
        borderRadius:"2px", padding:"20px 22px",
        position:"relative", overflow:"hidden",
      }}
      whileHover={{
        borderColor: isBuy ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)",
        y: -3,
        transition:{ duration:0.22, ease: EASE_OUT_CIRC },
      }}
    >
      {/* Side bar */}
      <div style={{
        position:"absolute", left:0, top:0, bottom:0, width:"2px",
        background: isBuy
          ? "linear-gradient(to bottom, #4ade80, rgba(74,222,128,0.12))"
          : "linear-gradient(to bottom, #f87171, rgba(248,113,113,0.12))",
      }} />
      {/* Bg tint */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background: isBuy
          ? "linear-gradient(120deg, rgba(74,222,128,0.025) 0%, transparent 55%)"
          : "linear-gradient(120deg, rgba(248,113,113,0.025) 0%, transparent 55%)",
      }} />

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"14px" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"5px" }}>
            <span style={{
              fontFamily: T.mono, fontSize:"8px", letterSpacing:"2px",
              color: isBuy ? "#4ade80" : "#f87171",
              background: isBuy ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
              padding:"2px 8px", borderRadius:"1px",
            }}>{sig.type}</span>
            <span style={{ fontFamily: T.mono, fontSize:"8px", letterSpacing:"1.5px", color: T.dim }}>{sig.strategy}</span>
          </div>
          <div style={{ fontFamily: T.sans, fontSize:"14px", fontWeight:500, color: T.cream }}>{sig.instrument}</div>
        </div>
        <span style={{
          fontFamily: T.mono, fontSize:"7px", letterSpacing:"2px",
          color: sig.conf === "HIGH" ? T.gold : T.muted,
          border:`1px solid ${sig.conf === "HIGH" ? "rgba(201,168,76,0.3)" : T.border}`,
          padding:"3px 8px", borderRadius:"1px",
        }}>{sig.conf}</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>
        {[
          { lbl:"Entry",    val: sig.entry  },
          { lbl:"Target",   val: sig.target },
          { lbl:"Stop Loss",val: sig.sl     },
        ].map((m, j) => (
          <div key={j}>
            <div style={{ fontFamily:T.mono, fontSize:"7px", letterSpacing:"2px", color:T.dim, marginBottom:"3px" }}>{m.lbl}</div>
            <div style={{ fontFamily:T.mono, fontSize:"12px", color:T.cream }}>{m.val}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════
const LandingPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({ target: heroRef, offset:["start end","end start"] });
  const heroBgY = useTransform(heroScroll, [0, 1], ["-8%","8%"]);

  const s1  = useReveal();
  const s4  = useReveal();
  const s5  = useReveal();
  const s6  = useReveal();
  const cta = useReveal();

  return (
    <>
      {/* ── Global CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=DM+Mono:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

        .lb-root{
          background:#09090b;
          color:#e8e3d8;
          font-family:'DM Sans',system-ui,sans-serif;
          overflow-x:hidden;
        }

        /* section tag */
        .lb-section-tag{
          display:flex;align-items:center;gap:18px;
          margin-bottom:40px;
          font-family:'DM Mono',monospace;
          font-size:9px;letter-spacing:5px;
          color:#c9a84c;text-transform:uppercase;
        }
        .lb-tag-line{
          flex:0 0 48px;height:1px;
          background:linear-gradient(90deg,transparent,#c9a84c);
        }
        .lb-tag-line-r{
          background:linear-gradient(90deg,#c9a84c,transparent);
        }
        .lb-tag-text{white-space:nowrap;}

        /* feature cards */
        .lb-feature-card{
          padding:36px 30px 32px;
          background:#111114;
          border:1px solid rgba(255,255,255,0.07);
          cursor:default;
          transition:border-color .4s ease,box-shadow .4s ease;
          will-change:transform;
        }
        .lb-feature-card:hover{
          border-color:rgba(201,168,76,.28);
          box-shadow:0 24px 60px rgba(0,0,0,.5),0 0 0 1px rgba(201,168,76,.05);
        }
        .lb-card-spotlight{
          position:absolute;inset:0;
          pointer-events:none;
          transition:opacity .25s ease;z-index:0;
        }
        .lb-card-topline{
          position:absolute;top:0;left:0;right:0;height:1px;
          background:linear-gradient(90deg,#c9a84c,rgba(201,168,76,.25),transparent);
        }
        .lb-card-tag{
          display:block;
          font-family:'DM Mono',monospace;
          font-size:8px;letter-spacing:4px;
          color:#c9a84c;opacity:.55;
          margin-bottom:18px;text-transform:uppercase;
          position:relative;z-index:1;
          transition:opacity .3s;
        }
        .lb-feature-card:hover .lb-card-tag{opacity:1;}
        .lb-card-title{
          font-family:'Instrument Serif',serif;
          font-size:24px;font-weight:400;
          color:#e8e3d8;margin-bottom:14px;
          line-height:1.2;letter-spacing:-.3px;
          position:relative;z-index:1;
        }
        .lb-card-body{
          font-family:'DM Sans',sans-serif;
          font-size:13px;font-weight:300;
          line-height:1.85;
          color:rgba(232,227,216,.42);
          position:relative;z-index:1;
        }
        .lb-card-arrow{
          margin-top:22px;
          font-family:'DM Mono',monospace;
          font-size:14px;color:#c9a84c;
          position:relative;z-index:1;
        }

        /* ticker */
        .lb-ticker-wrap{
          overflow:hidden;
          border-top:1px solid rgba(255,255,255,.07);
          border-bottom:1px solid rgba(255,255,255,.07);
          padding:17px 0;background:#0c0c0f;
          mask-image:linear-gradient(90deg,transparent 0%,black 7%,black 93%,transparent 100%);
          -webkit-mask-image:linear-gradient(90deg,transparent 0%,black 7%,black 93%,transparent 100%);
        }
        .lb-ticker-track{
          display:flex;width:max-content;
          animation:lb-ticker 42s linear infinite;
        }
        @keyframes lb-ticker{
          from{transform:translateX(0);}
          to{transform:translateX(-33.333%);}
        }
        .lb-ticker-item{
          display:inline-flex;align-items:center;gap:10px;
          padding:0 28px;
          font-family:'DM Mono',monospace;
          font-size:9px;letter-spacing:3px;
          color:rgba(232,227,216,.18);text-transform:uppercase;
          white-space:nowrap;transition:color .2s;
        }
        .lb-ticker-item:hover{color:rgba(201,168,76,.6);}
        .lb-ticker-dot{color:#c9a84c;font-size:5px;opacity:.4;}

        /* workflow */
        .lb-workflow-step{
          display:grid;grid-template-columns:72px 1fr;
          gap:0 28px;align-items:start;
          padding:36px 0;
          border-bottom:1px solid rgba(255,255,255,.07);
        }
        .lb-workflow-step:last-child{border-bottom:none;}
        .lb-step-num{
          font-family:'Instrument Serif',serif;
          font-size:52px;font-weight:400;
          line-height:1;letter-spacing:-2px;padding-top:2px;
        }
        .lb-step-title{
          font-family:'Instrument Serif',serif;
          font-size:22px;font-weight:400;
          margin-bottom:8px;letter-spacing:-.2px;
        }
        .lb-step-desc{
          font-family:'DM Sans',sans-serif;
          font-size:13px;font-weight:300;
          line-height:1.8;color:rgba(232,227,216,.42);
        }

        /* risk */
        .lb-risk-pillar{
          padding:32px 28px;
          border:1px solid rgba(255,255,255,.07);
          border-radius:2px;background:#111114;
          transition:border-color .35s ease,box-shadow .35s ease;
        }
        .lb-risk-pillar:hover{
          border-color:rgba(201,168,76,.22);
          box-shadow:0 20px 50px rgba(0,0,0,.45);
        }
        .lb-risk-badge{
          font-family:'Instrument Serif',serif;
          font-style:italic;font-size:42px;
          margin-bottom:16px;display:block;line-height:1;
        }
        .lb-risk-label{
          font-family:'DM Mono',monospace;
          font-size:8px;letter-spacing:3px;
          color:#c9a84c;text-transform:uppercase;
          margin-bottom:10px;display:block;
        }
        .lb-risk-sub{
          font-family:'DM Sans',sans-serif;
          font-size:12px;font-weight:300;
          line-height:1.75;color:rgba(232,227,216,.42);
        }

        /* divider */
        .lb-divider{height:1px;background:rgba(255,255,255,.07);}

        /* big stat */
        .lb-big-stat{
          font-family:'Instrument Serif',serif;
          font-style:italic;color:#c9a84c;
          letter-spacing:-2px;line-height:1;
        }

        /* bar */
        .lb-bar{
          border-radius:2px 2px 0 0;
          background:linear-gradient(to top,rgba(201,168,76,.65),rgba(201,168,76,.15));
          transition:background .2s;transform-origin:bottom;
        }
        .lb-bar:hover{
          background:linear-gradient(to top,#c9a84c,rgba(201,168,76,.35));
        }

        /* CTA */
        .lb-cta-btn{
          display:inline-flex;align-items:center;gap:10px;
          padding:16px 36px;
          background:#c9a84c;color:#09090b;
          font-family:'DM Mono',monospace;
          font-size:10px;letter-spacing:3px;
          text-transform:uppercase;font-weight:500;
          border:none;border-radius:2px;cursor:pointer;
          position:relative;overflow:hidden;
          transition:opacity .2s,transform .2s,box-shadow .3s;
        }
        .lb-cta-btn::after{
          content:'';position:absolute;inset:0;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);
          transform:translateX(-100%);transition:transform .55s ease;
        }
        .lb-cta-btn:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 14px 40px rgba(201,168,76,.32);}
        .lb-cta-btn:hover::after{transform:translateX(100%);}

        .lb-cta-ghost{
          display:inline-flex;align-items:center;gap:10px;
          padding:16px 36px;
          background:transparent;color:rgba(232,227,216,.42);
          font-family:'DM Mono',monospace;
          font-size:10px;letter-spacing:3px;
          text-transform:uppercase;
          border:1px solid rgba(255,255,255,.07);
          border-radius:2px;cursor:pointer;
          transition:border-color .3s,color .3s,transform .2s;
        }
        .lb-cta-ghost:hover{
          border-color:rgba(201,168,76,.35);
          color:#e8e3d8;transform:translateY(-2px);
        }

        /* ── RESPONSIVE ── */
        @media(max-width:1024px){
          .lb-two-col{flex-direction:column!important;}
          .lb-two-col>*{width:100%!important;max-width:100%!important;}
          .lb-feat-grid{grid-template-columns:repeat(2,1fr)!important;}
          .lb-risk-grid{grid-template-columns:repeat(2,1fr)!important;}
          .lb-sticky-col{position:relative!important;top:auto!important;}
          .lb-wf-grid{grid-template-columns:1fr!important;}
          .lb-bt-grid{grid-template-columns:1fr!important;}
          .lb-id-grid{grid-template-columns:1fr!important;}
        }
        @media(max-width:768px){
          .lb-pad{padding:88px 24px!important;}
          .lb-pad-deep{padding:88px 24px!important;}
          .lb-feat-grid{grid-template-columns:1fr!important;}
          .lb-risk-grid{grid-template-columns:1fr!important;}
          .lb-stats-row{flex-direction:column!important;}
          .lb-stats-row>div{
            border-right:none!important;
            border-bottom:1px solid rgba(255,255,255,.07)!important;
          }
          .lb-stats-row>div:last-child{border-bottom:none!important;}
          .lb-cta-row{flex-direction:column!important;align-items:stretch!important;}
          .lb-cta-row button{width:100%;justify-content:center;}
          .lb-hero-h{font-size:clamp(38px,10vw,58px)!important;}
          .lb-section-h{font-size:clamp(30px,8vw,48px)!important;}
          .lb-cta-h{font-size:clamp(44px,11vw,72px)!important;letter-spacing:-2px!important;}
          .lb-wf-grid>div:first-child{margin-bottom:40px;}
        }
        @media(max-width:480px){
          .lb-pad{padding:64px 16px!important;}
          .lb-pad-deep{padding:64px 16px!important;}
          .lb-ticker-item{padding:0 18px;font-size:8px;}
          .lb-step-num{font-size:38px!important;}
          .lb-card-title{font-size:20px!important;}
        }
      `}</style>

      <ScrollProgressBar />

      <div className="lb-root">

        {/* ══════════════════════════════════════════
            S1 — AI Quant Fund Manager Intro
        ══════════════════════════════════════════ */}
        <section
          ref={heroRef}
          className="lb-pad"
          style={{ padding:"160px 60px", position:"relative", overflow:"hidden" }}
        >
          <ParticleField count={22} />

          {/* Parallax orb */}
          <motion.div style={{
            position:"absolute", top:"-15%", left:"50%", translateX:"-50%", y: heroBgY,
            width:"1000px", height:"650px",
            background:"radial-gradient(ellipse, rgba(201,168,76,0.055) 0%, transparent 62%)",
            pointerEvents:"none", zIndex:0,
          }} />

          <div ref={s1.ref} style={{ maxWidth:"1200px", margin:"0 auto", position:"relative", zIndex:1 }}>
            <SectionTag>AI QUANT FUND MANAGER</SectionTag>

            <motion.div
              style={{ textAlign:"center", marginBottom:"80px" }}
              variants={staggerContainer(0.12, 0.08)}
              initial="hidden"
              animate={s1.inView ? "visible" : "hidden"}
            >
              {/* Headline */}
              <motion.h2
                className="lb-hero-h"
                variants={fadeUp(0, 52)}
                style={{
                  fontFamily: T.serif,
                  fontSize:"clamp(44px,7vw,88px)",
                  fontWeight:400, color: T.cream,
                  letterSpacing:"-2.5px", lineHeight:1.0,
                  marginBottom:"28px",
                }}
              >
                not a screener.<br />
                a{" "}
                <motion.em
                  style={{ color: T.gold, fontStyle:"italic", display:"inline-block" }}
                  animate={{
                    textShadow:[
                      "0 0 18px rgba(201,168,76,.18)",
                      "0 0 55px rgba(201,168,76,.55)",
                      "0 0 18px rgba(201,168,76,.18)",
                    ],
                  }}
                  transition={{ duration:3.5, repeat:Infinity, ease:"easeInOut" }}
                >thinking</motion.em>{" "}fund manager.
              </motion.h2>

              <motion.p
                variants={fadeUp(0.14, 28)}
                style={{
                  fontFamily:T.sans, fontSize:"15px", fontWeight:300,
                  lineHeight:1.9, color:T.muted,
                  maxWidth:"600px", margin:"0 auto 60px",
                }}
              >
                LightninBull runs a full quant pipeline — factor scoring, regime detection,
                portfolio construction, and risk controls — so your capital is positioned
                by mathematics, never by emotion.
              </motion.p>

              {/* Stats strip */}
              <motion.div
                variants={scaleIn(0.28)}
                style={{
                  display:"flex", justifyContent:"center",
                  border:`1px solid ${T.border}`,
                  borderRadius:"2px", maxWidth:"660px",
                  margin:"0 auto", overflow:"hidden",
                }}
                className="lb-stats-row"
              >
                {[
                  { n:16, suf:"+", lbl:"AI Modules"  },
                  { n:6,  suf:"",  lbl:"Model Types"  },
                  { n:100,suf:"%", lbl:"Rules-Based"  },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    style={{
                      flex:1, padding:"28px 24px", textAlign:"center",
                      borderRight: i < 2 ? `1px solid ${T.border}` : "none",
                    }}
                    whileHover={{
                      background:"rgba(201,168,76,0.03)",
                      transition:{ duration:0.25 },
                    }}
                  >
                    <div className="lb-big-stat" style={{ fontSize:"52px" }}>
                      <Counter to={s.n} suffix={s.suf} />
                    </div>
                    <div style={{
                      fontFamily:T.mono, fontSize:"8px",
                      letterSpacing:"3px", color:T.dim,
                      textTransform:"uppercase", marginTop:"6px",
                    }}>{s.lbl}</div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Dual ticker */}
        <TickerStrip />
        <div style={{ marginTop:"1px" }}><TickerStrip reverse /></div>

        {/* ══════════════════════════════════════════
            S2 — Feature Cards
        ══════════════════════════════════════════ */}
        <section
          className="lb-pad-deep"
          style={{ padding:"140px 60px", background: T.deep }}
        >
          <div style={{ maxWidth:"1200px", margin:"0 auto" }}>
            <SectionTag>THE SIGNAL STACK</SectionTag>

            <motion.div
              style={{ textAlign:"center", marginBottom:"72px" }}
              variants={fadeUp(0.05, 30)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once:true, amount:0.3 }}
            >
              <h2 className="lb-section-h" style={{
                fontFamily:T.serif,
                fontSize:"clamp(32px,5vw,64px)",
                fontWeight:400, color:T.cream,
                letterSpacing:"-1.5px", lineHeight:1.05,
              }}>
                every model.<br/>
                <em style={{ color:T.gold }}>every edge.</em>
              </h2>
            </motion.div>

            <motion.div
              className="lb-feat-grid"
              style={{
                display:"grid",
                gridTemplateColumns:"repeat(3,1fr)",
                gap:"1px",
                background: T.border,
                border:`1px solid ${T.border}`,
                borderRadius:"2px",
                overflow:"hidden",
              }}
              variants={staggerContainer(0.08, 0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once:true, amount:0.08 }}
            >
              {FEATURES.map((f) => <FeatureCard key={f.id} f={f} />)}
            </motion.div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════
            S3 — Quant Workflow (sticky)
        ══════════════════════════════════════════ */}
        <section
          className="lb-pad"
          style={{ padding:"160px 60px" }}
        >
          <div style={{ maxWidth:"1200px", margin:"0 auto" }}>
            <div
              className="lb-wf-grid"
              style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"80px", alignItems:"start" }}
            >
              {/* Sticky left */}
              <div
                className="lb-sticky-col"
                style={{ position:"sticky", top:"100px", alignSelf:"start" }}
              >
                <SectionTag center={false}>THE WORKFLOW</SectionTag>

                <motion.h2
                  className="lb-section-h"
                  style={{
                    fontFamily:T.serif,
                    fontSize:"clamp(32px,4.5vw,60px)",
                    fontWeight:400, color:T.cream,
                    letterSpacing:"-1.5px", lineHeight:1.05,
                    marginBottom:"24px",
                  }}
                  variants={fadeLeft(0)}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once:true, amount:0.4 }}
                >
                  from raw data<br/>to live{" "}
                  <em style={{ color:T.gold }}>signal.</em>
                </motion.h2>

                <motion.p
                  style={{
                    fontFamily:T.sans, fontSize:"13px", fontWeight:300,
                    lineHeight:1.9, color:T.muted, marginBottom:"36px",
                  }}
                  variants={fadeLeft(0.12)}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once:true, amount:0.4 }}
                >
                  Every signal has passed through a rigorous six-stage pipeline —
                  ingested, scored, ranked, constructed, rebalanced, and delivered
                  with precision.
                </motion.p>

                {/* Live step indicator */}
                <motion.div
                  style={{
                    border:`1px solid ${T.border}`, borderRadius:"2px",
                    padding:"18px 20px", background:T.surface,
                    position:"relative", overflow:"hidden",
                  }}
                  variants={fadeLeft(0.22)}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once:true, amount:0.4 }}
                >
                  <div style={{
                    position:"absolute", left:0, top:0, bottom:0, width:"2px",
                    background:`linear-gradient(to bottom, ${T.gold}, rgba(201,168,76,.2))`,
                  }} />
                  <div style={{ fontFamily:T.mono, fontSize:"8px", letterSpacing:"3px", color:T.gold, marginBottom:"8px" }}>
                    CURRENT STAGE
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity:0, y:10 }}
                      animate={{ opacity:1, y:0 }}
                      exit={{ opacity:0, y:-10 }}
                      transition={{ duration:0.28, ease: EASE_OUT_CIRC }}
                      style={{ fontFamily:T.serif, fontSize:"20px", color:T.cream, letterSpacing:"-0.3px" }}
                    >
                      {WORKFLOW[activeStep].title}
                    </motion.div>
                  </AnimatePresence>
                  {/* Dot progress */}
                  <div style={{ display:"flex", gap:"5px", marginTop:"14px" }}>
                    {WORKFLOW.map((_,i) => (
                      <motion.div key={i}
                        style={{ height:"2px", flex:1, borderRadius:"1px" }}
                        animate={{ background: i <= activeStep ? T.gold : T.border }}
                        transition={{ duration:0.35 }}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* Gold rule */}
                <motion.div
                  style={{
                    marginTop:"32px", height:"1px",
                    background:`linear-gradient(90deg, ${T.gold}, transparent)`,
                    transformOrigin:"left",
                  }}
                  initial={{ scaleX:0 }}
                  whileInView={{ scaleX:1 }}
                  viewport={{ once:true }}
                  transition={{ duration:0.95, delay:0.35, ease: EASE_OUT_EXPO }}
                />
              </div>

              {/* Scrollable steps */}
              <div>
                {WORKFLOW.map((step, i) => (
                  <WfStep
                    key={step.num}
                    step={step} index={i}
                    active={activeStep}
                    onEnter={setActiveStep}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════
            S4 — Portfolio Backtest
        ══════════════════════════════════════════ */}
        <section
          className="lb-pad-deep"
          style={{ padding:"160px 60px", background:T.deep, position:"relative", overflow:"hidden" }}
        >
          {/* Dot grid bg */}
          <div style={{
            position:"absolute", inset:0, zIndex:0,
            backgroundImage:`
              linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
              linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)
            `,
            backgroundSize:"64px 64px",
          }} />

          <div ref={s4.ref} style={{ maxWidth:"1200px", margin:"0 auto", position:"relative", zIndex:1 }}>
            <div
              className="lb-bt-grid"
              style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"100px", alignItems:"center" }}
            >
              {/* Left: chart */}
              <motion.div
                variants={fadeLeft(0)}
                initial="hidden"
                animate={s4.inView ? "visible" : "hidden"}
              >
                <div style={{
                  background:T.surface, border:`1px solid ${T.border}`,
                  borderRadius:"2px", padding:"32px",
                  position:"relative", overflow:"hidden",
                }}>
                  <div style={{
                    position:"absolute", top:0, left:0, right:0, height:"2px",
                    background:`linear-gradient(90deg,${T.gold},rgba(201,168,76,.3),transparent)`,
                  }} />

                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"28px" }}>
                    <div>
                      <div style={{ fontFamily:T.mono, fontSize:"8px", letterSpacing:"3px", color:T.gold, marginBottom:"5px" }}>EQUITY CURVE</div>
                      <div className="lb-big-stat" style={{ fontSize:"32px" }}><Counter to={247} suffix="%" /></div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:T.mono, fontSize:"8px", letterSpacing:"2px", color:T.dim, marginBottom:"5px" }}>CAGR</div>
                      <div className="lb-big-stat" style={{ fontSize:"24px" }}><Counter to={34} suffix="%" /></div>
                    </div>
                  </div>

                  {s4.inView && (
                    <div style={{ display:"flex", alignItems:"flex-end", gap:"4px", height:"80px", marginBottom:"16px" }}>
                      {[28,42,35,58,48,65,45,72,60,78,68,85,74,90,82,96].map((h,i) => (
                        <motion.div
                          key={i} className="lb-bar" style={{ flex:1 }}
                          initial={{ height:0 }}
                          animate={{ height:`${h}%` }}
                          transition={{ duration:0.6, delay:0.08+i*0.04, ease: EASE_OUT_EXPO }}
                        />
                      ))}
                    </div>
                  )}

                  <div style={{
                    display:"flex", justifyContent:"space-between",
                    fontFamily:T.mono, fontSize:"7px", color:T.dim,
                    letterSpacing:"1px", marginBottom:"24px",
                  }}>
                    {["Q1","Q2","Q3","Q4","Q1","Q2","Q3","Q4"].map((q,i)=><span key={i}>{q}</span>)}
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", borderTop:`1px solid ${T.border}`, paddingTop:"20px" }}>
                    {[{ lbl:"Sharpe",val:"2.4" },{ lbl:"Max DD",val:"−12%" },{ lbl:"Win Rate",val:"68%" }].map((m,i)=>(
                      <div key={i} style={{ textAlign:"center", borderRight: i<2 ? `1px solid ${T.border}` : "none" }}>
                        <motion.div
                          style={{ fontFamily:T.serif, fontSize:"22px", color:T.cream, letterSpacing:"-.5px" }}
                          initial={{ opacity:0, y:12 }}
                          animate={s4.inView ? { opacity:1, y:0 } : {}}
                          transition={{ delay:0.6+i*0.1 }}
                        >{m.val}</motion.div>
                        <div style={{ fontFamily:T.mono, fontSize:"7px", letterSpacing:"2px", color:T.dim, marginTop:"4px", textTransform:"uppercase" }}>{m.lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Right: copy */}
              <motion.div
                variants={fadeRight(0.1)}
                initial="hidden"
                animate={s4.inView ? "visible" : "hidden"}
              >
                <SectionTag center={false}>PORTFOLIO BACKTEST</SectionTag>
                <h2 className="lb-section-h" style={{
                  fontFamily:T.serif,
                  fontSize:"clamp(28px,4vw,52px)",
                  fontWeight:400, color:T.cream,
                  letterSpacing:"-1.5px", lineHeight:1.05,
                  marginBottom:"24px",
                }}>
                  see it survive<br/>
                  <em style={{ color:T.gold }}>every market</em><br/>
                  before you trade it.
                </h2>
                <p style={{ fontFamily:T.sans, fontSize:"14px", fontWeight:300, lineHeight:1.9, color:T.muted, marginBottom:"36px" }}>
                  Run full historical simulations with realistic assumptions — commissions,
                  slippage, rebalancing costs. See drawdown periods, rolling Sharpe,
                  and year-by-year attribution before risking a single rupee.
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                  {[
                    "Equal Weight & MVO portfolio construction",
                    "Rebalancing rules — drift, calendar, risk-breach",
                    "Year-by-year PnL attribution",
                    "Drawdown, Sharpe, Calmar analytics",
                  ].map((pt,i) => (
                    <motion.div
                      key={i}
                      style={{ display:"flex", gap:"14px", alignItems:"flex-start" }}
                      variants={fadeUp(0.3+i*0.07, 16)}
                      initial="hidden"
                      animate={s4.inView ? "visible" : "hidden"}
                    >
                      <motion.span
                        style={{ color:T.gold, fontFamily:T.mono, fontSize:"9px", marginTop:"3px", flexShrink:0 }}
                        animate={{ opacity:[0.4,1,0.4] }}
                        transition={{ duration:2.5, delay:i*0.35, repeat:Infinity }}
                      >◆</motion.span>
                      <span style={{ fontFamily:T.sans, fontSize:"13px", fontWeight:300, color:T.muted, lineHeight:1.7 }}>{pt}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════
            S5 — Risk Control
        ══════════════════════════════════════════ */}
        <section className="lb-pad" style={{ padding:"160px 60px" }}>
          <div ref={s5.ref} style={{ maxWidth:"1200px", margin:"0 auto" }}>
            <SectionTag>RISK CONTROL</SectionTag>

            <motion.h2
              className="lb-section-h"
              style={{
                fontFamily:T.serif,
                fontSize:"clamp(32px,5vw,66px)",
                fontWeight:400, color:T.cream,
                letterSpacing:"-1.5px", lineHeight:1.0,
                textAlign:"center", marginBottom:"80px",
              }}
              variants={fadeUp(0, 36)}
              initial="hidden"
              animate={s5.inView ? "visible" : "hidden"}
            >
              the models know when<br/>
              <em style={{ color:T.gold }}>not to play.</em>
            </motion.h2>

            <motion.div
              className="lb-risk-grid"
              style={{
                display:"grid",
                gridTemplateColumns:"repeat(4,1fr)",
                gap:"1px",
                background: T.border,
                border:`1px solid ${T.border}`,
                borderRadius:"2px", overflow:"hidden",
                marginBottom:"36px",
              }}
              variants={staggerContainer(0.1, 0.2)}
              initial="hidden"
              animate={s5.inView ? "visible" : "hidden"}
            >
              {RISK_PILLARS.map((p) => <RiskCard key={p.label} p={p} />)}
            </motion.div>

            <motion.div
              style={{
                padding:"20px 28px",
                border:`1px solid ${T.border}`,
                borderRadius:"2px", background:T.surface,
                display:"flex", alignItems:"center", gap:"20px",
              }}
              variants={fadeUp(0.5, 18)}
              initial="hidden"
              animate={s5.inView ? "visible" : "hidden"}
            >
              <motion.span
                style={{ color:T.gold, fontSize:"18px", flexShrink:0 }}
                animate={{ opacity:[0.5,1,0.5] }}
                transition={{ duration:2.5, repeat:Infinity }}
              >⚠</motion.span>
              <p style={{ fontFamily:T.mono, fontSize:"9px", letterSpacing:"1px", color:T.dim, lineHeight:1.7 }}>
                All models are probabilistic tools, not guarantees. Past backtest performance
                does not guarantee future results. LightninBull signals are informational —
                always apply your own risk judgement.
              </p>
            </motion.div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════
            S6 — Intraday Intelligence
        ══════════════════════════════════════════ */}
        <section
          className="lb-pad-deep"
          style={{ padding:"160px 60px", background:T.deep, position:"relative", overflow:"hidden" }}
        >
          <ParticleField count={14} />
          <div style={{
            position:"absolute", bottom:"-200px", right:"-100px",
            width:"700px", height:"500px",
            background:"radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 65%)",
            pointerEvents:"none", zIndex:0,
          }} />

          <div ref={s6.ref} style={{ maxWidth:"1200px", margin:"0 auto", position:"relative", zIndex:1 }}>
            <SectionTag>INTRADAY INTELLIGENCE</SectionTag>

            <div
              className="lb-id-grid"
              style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"100px", alignItems:"center" }}
            >
              {/* Left copy */}
              <motion.div
                variants={fadeLeft(0)}
                initial="hidden"
                animate={s6.inView ? "visible" : "hidden"}
              >
                <h2 className="lb-section-h" style={{
                  fontFamily:T.serif,
                  fontSize:"clamp(28px,4vw,54px)",
                  fontWeight:400, color:T.cream,
                  letterSpacing:"-1.5px", lineHeight:1.05,
                  marginBottom:"24px",
                }}>
                  the market opens.<br/>
                  <em style={{ color:T.gold }}>you're already<br/>positioned.</em>
                </h2>

                <p style={{ fontFamily:T.sans, fontSize:"14px", fontWeight:300, lineHeight:1.9, color:T.muted, marginBottom:"44px" }}>
                  Intraday signals for Nifty/BankNifty option spreads and high-conviction
                  stock signals surface pre-market — so your plan is set before the bell rings.
                </p>

                <div style={{ display:"flex", flexDirection:"column", gap:"22px" }}>
                  {[
                    { label:"Bull Call Spreads",   width:"85%", desc:"Index intraday upside" },
                    { label:"Bear Put Spreads",    width:"78%", desc:"Index intraday downside" },
                    { label:"Stock Long Signals",  width:"92%", desc:"Momentum-confirmed buys" },
                    { label:"Stock Short Signals", width:"71%", desc:"Reversal setups" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      variants={fadeLeft(0.15+i*0.08)}
                      initial="hidden"
                      animate={s6.inView ? "visible" : "hidden"}
                    >
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                        <span style={{ fontFamily:T.sans, fontSize:"13px", fontWeight:400, color:T.cream }}>{item.label}</span>
                        <span style={{ fontFamily:T.mono, fontSize:"8px", letterSpacing:"1px", color:T.dim }}>{item.desc}</span>
                      </div>
                      <div style={{ height:"2px", background:T.border, borderRadius:"2px", overflow:"hidden" }}>
                        <motion.div
                          style={{
                            height:"100%", borderRadius:"2px",
                            background:`linear-gradient(90deg, ${T.gold}, rgba(201,168,76,.3))`,
                          }}
                          initial={{ width:"0%" }}
                          animate={s6.inView ? { width: item.width } : {}}
                          transition={{ duration:1.15, delay:0.45+i*0.1, ease: EASE_OUT_EXPO }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right: signal cards */}
              <motion.div
                style={{ display:"flex", flexDirection:"column", gap:"12px" }}
                variants={staggerContainer(0.12, 0.18)}
                initial="hidden"
                animate={s6.inView ? "visible" : "hidden"}
              >
                {SIGNALS.map((sig, i) => <SignalCard key={i} sig={sig} index={i} />)}
                <motion.p
                  variants={fadeUp(0.5, 10)}
                  style={{
                    fontFamily:T.mono, fontSize:"7px", letterSpacing:"2px",
                    color:T.dim, textAlign:"center", marginTop:"4px", lineHeight:1.6,
                  }}
                >
                  ILLUSTRATIVE SIGNALS · NOT INVESTMENT ADVICE
                </motion.p>
              </motion.div>
            </div>
          </div>
        </section>

        <div className="lb-divider" />

        {/* ══════════════════════════════════════════
            S7 — Final CTA
        ══════════════════════════════════════════ */}
        <section
          className="lb-pad"
          style={{ padding:"180px 60px", position:"relative", overflow:"hidden" }}
        >
          {/* Pulsing bg orb */}
          <motion.div
            style={{
              position:"absolute", top:"50%", left:"50%",
              translateX:"-50%", translateY:"-50%",
              width:"1000px", height:"650px",
              background:"radial-gradient(ellipse, rgba(201,168,76,0.065) 0%, transparent 58%)",
              pointerEvents:"none", zIndex:0,
            }}
            animate={{ scale:[1,1.06,1], opacity:[0.6,1,0.6] }}
            transition={{ duration:5.5, repeat:Infinity, ease:"easeInOut" }}
          />

          <ParticleField count={18} />

          <div ref={cta.ref} style={{ maxWidth:"800px", margin:"0 auto", textAlign:"center", position:"relative", zIndex:1 }}>
            <motion.div
              variants={staggerContainer(0.1, 0.05)}
              initial="hidden"
              animate={cta.inView ? "visible" : "hidden"}
            >
              <motion.p
                variants={fadeUp(0,18)}
                style={{
                  fontFamily:T.mono, fontSize:"9px", letterSpacing:"6px",
                  color:T.gold, textTransform:"uppercase", marginBottom:"36px",
                }}
              >
                NOT EVERYONE MAKES IT IN
              </motion.p>

              <motion.h2
                variants={fadeUp(0.08, 55)}
                className="lb-cta-h"
                style={{
                  fontFamily:T.serif,
                  fontSize:"clamp(48px,9vw,104px)",
                  fontWeight:400, color:T.cream,
                  letterSpacing:"-3px", lineHeight:0.92,
                  marginBottom:"32px",
                }}
              >
                trade like a<br/>
                <motion.em
                  style={{ color:T.gold, fontStyle:"italic", display:"inline-block" }}
                  animate={{
                    textShadow:[
                      "0 0 28px rgba(201,168,76,.28), 0 0 80px rgba(201,168,76,.1)",
                      "0 0 65px rgba(201,168,76,.7), 0 0 140px rgba(201,168,76,.28)",
                      "0 0 28px rgba(201,168,76,.28), 0 0 80px rgba(201,168,76,.1)",
                    ],
                  }}
                  transition={{ duration:3.2, repeat:Infinity, ease:"easeInOut" }}
                >
                  quant fund.
                </motion.em>
              </motion.h2>

              <motion.p
                variants={fadeUp(0.18, 28)}
                style={{
                  fontFamily:T.sans, fontSize:"15px", fontWeight:300,
                  lineHeight:1.85, color:T.muted,
                  maxWidth:"500px", margin:"0 auto 56px",
                }}
              >
                LightninBull brings institutional-grade models, risk controls, and
                portfolio intelligence to individual traders — for the first time.
              </motion.p>

              <motion.div
                variants={fadeUp(0.26, 22)}
                style={{ display:"flex", justifyContent:"center", gap:"14px", flexWrap:"wrap" }}
                className="lb-cta-row"
              >
                <button className="lb-cta-btn">Access Dashboard →</button>
                <button className="lb-cta-ghost">View all features</button>
              </motion.div>

              <motion.p
                variants={fadeUp(0.35, 16)}
                style={{
                  marginTop:"48px",
                  fontFamily:T.mono, fontSize:"8px", letterSpacing:"1.5px",
                  color:T.dim, lineHeight:1.8,
                }}
              >
                LIGHTNINBULL · INSTITUTIONAL QUANT INTELLIGENCE<br/>
                ALL SIGNALS FOR INFORMATIONAL PURPOSES ONLY · TRADE RESPONSIBLY
              </motion.p>
            </motion.div>
          </div>
        </section>

      </div>
    </>
  );
};

export default LandingPage;
