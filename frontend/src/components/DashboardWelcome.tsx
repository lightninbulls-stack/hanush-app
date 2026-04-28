import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring, type Variants } from "framer-motion";

interface DashboardWelcomeProps {
  onNavigate: (category: string) => void;
}

const workflowSteps = [
  {
    step: "01",
    title: "Stock Discovery",
    desc: "The AI Quant Fund Manager scans the market using momentum, regime, value, quality, range-bound, derivatives, and intraday models.",
  },
  {
    step: "02",
    title: "Intelligent Buckets",
    desc: "Stocks are classified into buckets like Consistent Trending, Cheap Value, Best Quality, Regime Upside, Range Bound, and Aggressive Option Stocks.",
  },
  {
    step: "03",
    title: "Add to Watchlist",
    desc: "Select high-conviction stocks from any model bucket and add them into your Watchlist for real-time tracking.",
  },
  {
    step: "04",
    title: "Portfolio Backtest",
    desc: "Test selected stocks using Equal Weight and Mean-Variance Optimization before deploying real capital.",
  },
  {
    step: "05",
    title: "Risk Rebalancing",
    desc: "Rebalance every 2 weeks, when portfolio falls 3%, or when portfolio gains 5%, keeping risk disciplined.",
  },
  {
    step: "06",
    title: "Monitor & Improve",
    desc: "Track performance, review risk, evaluate factor behaviour, and improve portfolio construction over time.",
  },
];

const modelCards = [
  {
    label: "STOCK DISCOVERY",
    title: "AI-selected opportunities",
    desc: "Find high-conviction stocks using momentum, value, quality, regime, range-bound, and derivatives intelligence.",
  },
  {
    label: "WATCHLIST ENGINE",
    title: "Track selected ideas",
    desc: "Move selected stocks into Watchlist and monitor only the names that matter instead of scanning the entire market manually.",
  },
  {
    label: "PORTFOLIO BACKTEST",
    title: "Test before committing",
    desc: "Run portfolio simulations using Equal Weight and MVO allocation to understand return, risk, and drawdown behaviour.",
  },
  {
    label: "RISK CONTROL",
    title: "Rebalance with discipline",
    desc: "Use rule-based rebalancing to reduce emotional decisions and keep the portfolio aligned with risk objectives.",
  },
  {
    label: "FACTOR MODELS",
    title: "Momentum to regime",
    desc: "Use Consistent Trending, Slow Movement, Cheap Value, Best Quality, Regime Upside, and Regime Downside models.",
  },
  {
    label: "FUND MANAGER WORKFLOW",
    title: "One complete system",
    desc: "Discover stocks, shortlist ideas, add to Watchlist, backtest portfolios, rebalance, and monitor performance.",
  },
];

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 34 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

// ─────────────────────────────────────────────────────────────
// Canvas sparkle system: spawns 4-pointed gold stars from edges
// intensity 0-1 controls spawn rate and size
// ─────────────────────────────────────────────────────────────
interface SParticle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  life: number; maxLife: number;
}

const SparkleCanvas: React.FC<{ active: boolean; intensity: number }> = ({ active, intensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<SParticle[]>([]);
  const raf = useRef<number>(0);
  const stateRef = useRef({ active, intensity });
  useEffect(() => { stateRef.current = { active, intensity }; }, [active, intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const p = canvas.parentElement;
      if (p) { canvas.width = p.offsetWidth; canvas.height = p.offsetHeight; }
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      const { active: a, intensity: iv } = stateRef.current;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Spawn from frame edges
      const spawnN = a ? Math.ceil(iv * 5) : 0;
      for (let i = 0; i < spawnN; i++) {
        const edge = Math.floor(Math.random() * 4);
        let sx = 0, sy = 0;
        if (edge === 0) { sx = Math.random() * W; sy = 0; }
        else if (edge === 1) { sx = W; sy = Math.random() * H; }
        else if (edge === 2) { sx = Math.random() * W; sy = H; }
        else { sx = 0; sy = Math.random() * H; }
        const spd = 0.5 + iv * 2.5 + Math.random();
        const ang = Math.atan2(H / 2 - sy, W / 2 - sx) + (Math.random() - 0.5) * 1.6;
        particles.current.push({
          x: sx, y: sy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: 1 + Math.random() * (1.5 + iv * 3),
          life: 0, maxLife: 28 + Math.random() * 36,
        });
      }

      particles.current = particles.current.filter(p => p.life < p.maxLife);
      for (const p of particles.current) {
        p.life++;
        p.x += p.vx; p.y += p.vy;
        p.vy -= 0.018;
        const t = p.life / p.maxLife;
        const alpha = (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75) * (0.65 + iv * 0.35);
        const s = p.size;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = alpha;

        // Outer glow halo
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 4);
        g.addColorStop(0, "rgba(255,248,160,1)");
        g.addColorStop(0.4, "rgba(250,204,21,0.8)");
        g.addColorStop(1, "rgba(250,204,21,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, s * 4, 0, Math.PI * 2); ctx.fill();

        // 4-pointed star
        ctx.fillStyle = "#fffde0";
        ctx.beginPath();
        ctx.moveTo(0, -s * 2.8);
        ctx.lineTo(s * 0.38, -s * 0.38);
        ctx.lineTo(s * 2.8, 0);
        ctx.lineTo(s * 0.38, s * 0.38);
        ctx.lineTo(0, s * 2.8);
        ctx.lineTo(-s * 0.38, s * 0.38);
        ctx.lineTo(-s * 2.8, 0);
        ctx.lineTo(-s * 0.38, -s * 0.38);
        ctx.closePath(); ctx.fill();

        ctx.restore();
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "absolute", inset: 0,
      width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 20,
    }} />
  );
};

// ─────────────────────────────────────────────────────────────
// Lightning bolt burst — jagged SVG bolts radiate from center
// ─────────────────────────────────────────────────────────────
const LightningBurst: React.FC<{ trigger: number; hard: boolean }> = ({ trigger, hard }) => {
  const [bolts, setBolts] = useState<Array<{ id: number; d: string }>>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const n = hard ? 6 : 3;
    const newBolts = Array.from({ length: n }, (_, i) => {
      const baseAngle = (i / n) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.5;
      const len = hard ? 90 + Math.random() * 60 : 50 + Math.random() * 40;
      const segs = 5;
      let d = "M 0 0";
      for (let s = 1; s <= segs; s++) {
        const pct = s / segs;
        const jx = (Math.random() - 0.5) * 22;
        const jy = (Math.random() - 0.5) * 22;
        d += ` L ${Math.cos(angle) * len * pct + jx} ${Math.sin(angle) * len * pct + jy}`;
      }
      return { id: Date.now() + i, d };
    });
    setBolts(newBolts);
    const t = setTimeout(() => setBolts([]), 500);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!bolts.length) return null;

  return (
    <svg style={{
      position: "absolute", inset: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 25, overflow: "visible",
    }}>
      <defs>
        <filter id="lbBoltGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g transform="translate(50%, 50%)" filter="url(#lbBoltGlow)">
        {bolts.map(b => (
          <g key={b.id}>
            <motion.path d={b.d} stroke="#facc15" strokeWidth={hard ? 3.5 : 2}
              fill="none" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.9 }}
              animate={{ pathLength: 1, opacity: 0 }}
              transition={{ duration: 0.32, ease: "easeOut" }} />
            <motion.path d={b.d} stroke="#fff8a0" strokeWidth="1"
              fill="none" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 1 }}
              animate={{ pathLength: 1, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }} />
          </g>
        ))}
      </g>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
// GlassPanelCard — 3D rotating glass with rings, sparkles, lightning
// ─────────────────────────────────────────────────────────────
const GlassPanelCard: React.FC<{ children: React.ReactNode; extraClass: string }> = ({ children, extraClass }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pressLevel, setPressLevel] = useState(0); // 0=idle 1=click 2=hardpress
  const [boltTrigger, setBoltTrigger] = useState(0);
  // spinning: tracks accumulated Y rotation for hard-press full spin
  const spinY = useMotionValue(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinAngle = useRef(0);

  // Mouse tilt (only active when NOT spinning)
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltX = useSpring(useTransform(my, [-0.5, 0.5], [14, -14]), { stiffness: 140, damping: 18 });
  const tiltY = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 140, damping: 18 });

  // Combined rotateY: tilt + spin
  const rotY = useMotionValue(0);
  const rotX = useMotionValue(0);

  // Keep rotY in sync with tilt when not spinning
  useEffect(() => {
    const unsubY = tiltY.on("change", v => { if (pressLevel !== 2) rotY.set(v); });
    const unsubX = tiltX.on("change", v => { if (pressLevel !== 2) rotX.set(v); });
    return () => { unsubY(); unsubX(); };
  }, [pressLevel, tiltX, tiltY, rotX, rotY]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || pressLevel === 2) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const handleLeave = () => {
    mx.set(0); my.set(0); setHovered(false);
  };

  const startSpin = () => {
    // Spin the glass continuously on Y axis
    if (spinInterval.current) clearInterval(spinInterval.current);
    spinAngle.current = rotY.get();
    spinInterval.current = setInterval(() => {
      spinAngle.current += 6; // degrees per frame @ ~60fps = ~360°/s
      rotY.set(spinAngle.current);
      rotX.set(Math.sin((spinAngle.current * Math.PI) / 180) * 8); // slight X wobble during spin
    }, 16);
  };

  const stopSpin = () => {
    if (spinInterval.current) { clearInterval(spinInterval.current); spinInterval.current = null; }
    // Snap back to tilt position
    rotX.set(0); rotY.set(0);
  };

  const pressLevelRef = useRef(0);

  const handleDown = () => {
    pressLevelRef.current = 1;
    setPressLevel(1);
    setBoltTrigger(t => t + 1);
    pressTimer.current = setTimeout(() => {
      pressLevelRef.current = 2;
      setPressLevel(2);
      setBoltTrigger(t => t + 1);
      startSpin();
    }, 380);
  };

  const handleUp = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (pressLevelRef.current === 2) stopSpin();
    pressLevelRef.current = 0;
    setPressLevel(0);
  };

  // Cleanup on unmount
  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (spinInterval.current) clearInterval(spinInterval.current);
  }, []);

  // Ring speed: fast when hard-pressing (spinning), slower on light press, gentle on hover
  const ringDur = pressLevel === 2 ? 0.8 : pressLevel === 1 ? 2.2 : hovered ? 5 : 13;
  const sparkIntensity = pressLevel === 2 ? 1 : pressLevel === 1 ? 0.55 : hovered ? 0.12 : 0;

  // shimmer position tracks mouse
  const shimmerBg = useTransform(
    [mx, my],
    ([x, y]) =>
      `radial-gradient(ellipse 200px 180px at ${((x as number) + 0.5) * 100}% ${((y as number) + 0.5) * 100}%, rgba(255,255,255,0.13), transparent 65%)`
  );

  return (
    <motion.div
      ref={ref}
      className={`lb-gp-wrap lb-flow-card ${extraClass}`}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d", perspective: 1100, position: "relative", zIndex: hovered ? 2 : 1 }}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
    >
      {/* ── Spinning gold rings behind the glass panel ── */}
      <div className="lb-gp-rings" aria-hidden="true">
        {[
          { sz: 100, rev: false, dash: false, baseOp: 0.20 },
          { sz: 160, rev: true,  dash: true,  baseOp: 0.14 },
          { sz: 230, rev: false, dash: false, baseOp: 0.09 },
          { sz: 320, rev: true,  dash: true,  baseOp: 0.06 },
          { sz: 430, rev: false, dash: false, baseOp: 0.03 },
        ].map((ring, i) => (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: ring.sz, height: ring.sz,
              borderRadius: "50%",
              border: `1px ${ring.dash ? "dashed" : "solid"} rgba(250,204,21,${hovered ? Math.min(ring.baseOp * 2.8, 0.65) : ring.baseOp})`,
              top: "50%", left: "50%",
              marginLeft: -ring.sz / 2, marginTop: -ring.sz / 2,
              pointerEvents: "none",
              transition: "border-color 0.4s ease",
            }}
            animate={{ rotate: ring.rev ? -360 : 360 }}
            transition={{ duration: ringDur * (1 + i * 0.5), repeat: Infinity, ease: "linear" }}
          />
        ))}

        {/* Pulse rings on hard press */}
        {pressLevel === 2 && [0, 1].map(i => (
          <motion.div key={`pulse-${i}`} style={{
            position: "absolute", width: 60, height: 60, borderRadius: "50%",
            border: "2px solid rgba(250,204,21,1)",
            top: "50%", left: "50%", marginLeft: -30, marginTop: -30,
            pointerEvents: "none",
          }}
            initial={{ scale: 0.8, opacity: 1 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.15, repeat: Infinity, repeatDelay: 0.5 }}
          />
        ))}
      </div>

      {/* ── Glass face: the actual glazed panel surface ── */}
      <div className="lb-gp-face" style={{ transform: "translateZ(16px)" }}>
        {/* Reflective shimmer follows cursor */}
        <motion.div className="lb-gp-shimmer" style={{ background: shimmerBg }} />

        {/* Gold edge refractions (top/left/right frame lines) */}
        <div className="lb-gp-edge lb-gp-edge-top" />
        <div className="lb-gp-edge lb-gp-edge-left" />
        <div className="lb-gp-edge lb-gp-edge-right" />
        <div className="lb-gp-edge lb-gp-edge-bottom" />

        {/* Inner content sits on top of glass */}
        <div style={{ position: "relative", zIndex: 5 }}>{children}</div>
      </div>

      {/* ── 3D depth layer slightly behind ── */}
      <div className="lb-gp-depth" style={{ transform: "translateZ(-10px)" }} aria-hidden="true" />

      {/* ── Canvas sparkles ── */}
      <SparkleCanvas active={hovered || pressLevel > 0} intensity={sparkIntensity} />

      {/* ── Lightning on click / hard press ── */}
      <LightningBurst trigger={boltTrigger} hard={pressLevel === 2} />

      {/* ── Glowing frame border that reacts to interaction ── */}
      <motion.div
        className="lb-gp-glow-border"
        animate={{
          opacity: pressLevel === 2 ? 1 : pressLevel === 1 ? 0.75 : hovered ? 0.5 : 0,
          boxShadow: pressLevel === 2
            ? "0 0 0 2px rgba(250,204,21,1), 0 0 70px rgba(250,204,21,0.55), inset 0 0 50px rgba(250,204,21,0.1)"
            : pressLevel === 1
            ? "0 0 0 1.5px rgba(250,204,21,0.7), 0 0 40px rgba(250,204,21,0.35)"
            : "0 0 0 1px rgba(250,204,21,0.4), 0 0 24px rgba(250,204,21,0.18)",
        }}
        transition={{ duration: 0.22 }}
      />
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main component — original code with GlassPanelCard replacing
// only the two lb-flow-card divs
// ─────────────────────────────────────────────────────────────
const DashboardWelcome: React.FC<DashboardWelcomeProps> = ({ onNavigate }) => {
  return (
    <div className="lb-dashboard-welcome">
      <div className="lb-welcome-orb" />
      <div className="lb-welcome-orb lb-welcome-orb-two" />

      <motion.section
        className="lb-portfolio-engine"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.18 }}
      >
        <motion.div className="lb-section-heading lb-portfolio-heading" variants={fadeUp}>
          <span>PORTFOLIO CONSTRUCTION ENGINE</span>
          <h2>
            How to create a risk-adjusted portfolio
            <br />
            <em>that can beat the benchmark.</em>
          </h2>
          <p>
            The edge is created by separating the two most important portfolio decisions:
            selection generates alpha, allocation controls volatility.
          </p>
        </motion.div>

        <motion.div className="lb-construction-flow" variants={fadeUp}>

          <GlassPanelCard extraClass="lb-selection-card">
            <div className="lb-flow-card-top">
              <span>01</span>
              <p>ALPHA ENGINE</p>
            </div>
            <h3>Selection</h3>
            <strong>Where returns come from</strong>
            <small>Powered by LightninBull AI Quant Engine</small>
            <ul>
              <li>Regime-based filtering</li>
              <li>Momentum ranking</li>
              <li>Factor model screening</li>
            </ul>
            <div className="lb-flow-output">→ High-probability alpha stocks</div>
          </GlassPanelCard>

          <div className="lb-flow-connector">
            <span />
            <p>+</p>
            <span />
          </div>

          <GlassPanelCard extraClass="lb-allocation-card">
            <div className="lb-flow-card-top">
              <span>02</span>
              <p>RISK ENGINE</p>
            </div>
            <h3>Allocation</h3>
            <strong>How volatility is controlled</strong>
            <small>Powered by LightninBull AI Quant Engine</small>
            <ul>
              <li>Equal weight institutional baseline</li>
              <li>Minimum variance optimization</li>
              <li>Risk-adjusted portfolio weights</li>
            </ul>
            <div className="lb-flow-output">→ Optimized portfolio allocation</div>
          </GlassPanelCard>

        </motion.div>

        <motion.div className="lb-risk-output" variants={fadeUp}>
          <div className="lb-output-glow" />
          <span>FINAL OUTPUT</span>
          <h3>Risk-Adjusted Portfolio</h3>
          <p>Diversified. Systematic. Optimized for risk and return.</p>
          <div className="lb-output-tags">
            <em>Discover</em>
            <i />
            <em>Select</em>
            <i />
            <em>Backtest</em>
            <i />
            <em>Rebalance</em>
          </div>
        </motion.div>
      </motion.section>


      <motion.section
        className="lb-welcome-hero"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="lb-welcome-eyebrow" variants={fadeUp}>
          <span />
          AI QUANT FUND MANAGER
        </motion.div>

        <div className="lb-welcome-grid">
          <div>
            <motion.h1 className="lb-welcome-title" variants={fadeUp}>
              Discover. Select.
              <br />
              Backtest. <em>Rebalance.</em>
            </motion.h1>

            <motion.p className="lb-welcome-desc" variants={fadeUp}>
              LightninBull is not just a screener. It is an AI-driven Quant Fund
              Manager workflow that separates alpha generation from risk control:
              stock selection creates return potential, while allocation controls
              volatility and portfolio risk.
            </motion.p>

            <motion.div className="lb-welcome-actions" variants={fadeUp}>
              <button type="button" onClick={() => onNavigate("Consistent Trending")}>
                Explore Stock Buckets →
              </button>

              <button type="button" onClick={() => onNavigate("Watchlist")}>
                Open Watchlist →
              </button>

              <button type="button" onClick={() => onNavigate("Portfolio Backtest")}>
                Run Portfolio Backtest →
              </button>
            </motion.div>
          </div>

          <motion.div
            className="lb-welcome-terminal"
            variants={fadeUp}
            whileHover={{ y: -6, scale: 1.01 }}
            transition={{ duration: 0.25 }}
          >
            <div className="lb-terminal-top">
              <span>LIVE WORKFLOW</span>
              <strong>LIGHTNINBULL</strong>
            </div>

            <div className="lb-terminal-line">
              <span>01</span>
              Scan market universe
            </div>
            <div className="lb-terminal-line">
              <span>02</span>
              Selection engine finds alpha opportunities
            </div>
            <div className="lb-terminal-line">
              <span>03</span>
              Allocation engine controls risk and volatility
            </div>
            <div className="lb-terminal-line">
              <span>04</span>
              Test portfolio with Equal Weight / MVO
            </div>
            <div className="lb-terminal-line">
              <span>05</span>
              Rebalance using disciplined risk rules
            </div>

            <div className="lb-terminal-status">
              <span className="lb-live-dot" />
              Your AI quant workflow is ready.
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="lb-workflow-strip"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.18 }}
      >
        {workflowSteps.map((item) => (
          <motion.div
            key={item.step}
            className="lb-workflow-step"
            variants={fadeUp}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.25 }}
          >
            <span>{item.step}</span>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </motion.div>
        ))}
      </motion.section>

      <motion.section
        className="lb-model-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.18 }}
      >
        <motion.div className="lb-section-heading" variants={fadeUp}>
          <span>LIGHTNINBULL INTELLIGENCE LAYER</span>
          <h2>
            From model output to
            <br />
            <em>portfolio action.</em>
          </h2>
        </motion.div>

        <motion.div className="lb-model-grid" variants={stagger}>
          {modelCards.map((card) => (
            <motion.div
              key={card.title}
              className="lb-model-card"
              variants={fadeUp}
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ duration: 0.24 }}
            >
              <p>{card.label}</p>
              <h3>{card.title}</h3>
              <span>{card.desc}</span>
              <div className="lb-card-corner" />
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        className="lb-rebalance-section"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
      >
        <div className="lb-rebalance-copy">
          <span>RISK & REBALANCING</span>
          <h2>
            Built to manage decisions,
            <br />
            not emotions.
          </h2>
          <p>
            After stock selection and portfolio construction, LightninBull helps
            enforce disciplined rebalancing rules. The goal is simple: let the
            process control risk before emotion controls the trader.
          </p>
        </div>

        <div className="lb-rule-grid">
          <motion.div whileHover={{ y: -5 }}>
            <strong>2W</strong>
            <span>Time-based rebalance every 2 weeks</span>
          </motion.div>

          <motion.div whileHover={{ y: -5 }}>
            <strong>-3%</strong>
            <span>Rebalance if portfolio declines by 3%</span>
          </motion.div>

          <motion.div whileHover={{ y: -5 }}>
            <strong>+5%</strong>
            <span>Rebalance when portfolio gains 5%</span>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="lb-final-message"
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        <p>YOUR DASHBOARD IS NOT JUST A SCREENER</p>
        <h2>
          It is a complete
          <br />
          <em>AI Quant Fund Manager workflow.</em>
        </h2>
      </motion.section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');

        .lb-dashboard-welcome {
          position: relative;
          min-height: calc(100vh - 40px);
          padding: 82px 72px 96px;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.055), transparent 58%),
            radial-gradient(ellipse at 0% 40%, rgba(250,204,21,0.035), transparent 48%),
            #050608;
          color: #f7f0df;
          overflow: hidden;
          font-family: 'Syne', sans-serif;
        }

        .lb-welcome-orb {
          position: absolute;
          top: -260px;
          right: -220px;
          width: 720px;
          height: 720px;
          background: radial-gradient(circle, rgba(250,204,21,0.08), transparent 65%);
          pointer-events: none;
        }

        .lb-welcome-orb-two {
          top: auto;
          right: auto;
          bottom: 20%;
          left: -280px;
          background: radial-gradient(circle, rgba(250,204,21,0.045), transparent 65%);
        }

        .lb-welcome-hero,
        .lb-portfolio-engine,
        .lb-model-section {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto 74px;
        }

        .lb-welcome-eyebrow {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 34px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 5px;
          color: #facc15;
        }

        .lb-welcome-eyebrow span {
          width: 46px;
          height: 1px;
          background: linear-gradient(90deg, #facc15, transparent);
        }

        .lb-welcome-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 54px;
          align-items: center;
        }

        .lb-welcome-title {
          margin: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(60px, 6.5vw, 104px);
          font-weight: 300;
          line-height: 0.92;
          letter-spacing: -2.4px;
          color: #f7f0df;
        }

        .lb-welcome-title em,
        .lb-section-heading h2 em,
        .lb-final-message h2 em {
          color: #d6b849;
          font-style: italic;
          font-weight: 300;
          text-shadow:
            0 0 32px rgba(250,204,21,0.16),
            0 0 90px rgba(250,204,21,0.08);
        }

        .lb-welcome-desc {
          max-width: 760px;
          margin: 34px 0 0;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          line-height: 2;
          color: rgba(255,255,255,0.52);
          letter-spacing: 0.2px;
        }

        .lb-welcome-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 36px;
        }

        .lb-welcome-actions button {
          border-radius: 3px;
          border: 1px solid rgba(250,204,21,0.24);
          background: rgba(250,204,21,0.04);
          color: #facc15;
          padding: 14px 18px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.24s ease;
        }

        .lb-welcome-actions button:first-child {
          background: linear-gradient(90deg, #facc15, #d6a21f);
          color: #050608;
          border-color: rgba(250,204,21,0.7);
        }

        .lb-welcome-actions button:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 44px rgba(250,204,21,0.12);
          border-color: rgba(250,204,21,0.55);
        }

        .lb-welcome-terminal {
          position: relative;
          padding: 28px;
          border-radius: 4px;
          background: rgba(8,9,12,0.92);
          border: 1px solid rgba(250,204,21,0.18);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 40px 80px rgba(0,0,0,0.52),
            0 0 70px rgba(250,204,21,0.04);
          backdrop-filter: blur(22px);
        }

        .lb-welcome-terminal::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #facc15, transparent);
        }

        .lb-terminal-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.35);
        }

        .lb-terminal-top strong {
          color: #facc15;
          font-family: 'Syne', sans-serif;
          letter-spacing: 3px;
          font-size: 12px;
        }

        .lb-terminal-line {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 14px;
          align-items: center;
          padding: 13px 0;
          border-bottom: 1px solid rgba(255,255,255,0.055);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          line-height: 1.6;
          color: rgba(255,255,255,0.48);
        }

        .lb-terminal-line span {
          color: #facc15;
          opacity: 0.8;
        }

        .lb-terminal-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 22px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          color: rgba(255,255,255,0.48);
        }

        .lb-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 18px rgba(34,197,94,0.7);
          animation: lbPulse 1.4s ease-in-out infinite;
        }

        .lb-section-heading {
          text-align: center;
          margin-bottom: 52px;
        }

        .lb-section-heading span {
          display: block;
          margin-bottom: 24px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 5px;
          color: rgba(250,204,21,0.78);
        }

        .lb-section-heading h2 {
          margin: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(46px, 5vw, 76px);
          font-weight: 300;
          line-height: 0.98;
          color: #f7f0df;
        }

        .lb-portfolio-heading p {
          max-width: 820px;
          margin: 24px auto 0;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          line-height: 2;
          color: rgba(255,255,255,0.48);
        }

        /* ── Construction flow ── */
        .lb-construction-flow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 90px minmax(0, 1fr);
          gap: 18px;
          align-items: stretch;
          margin-bottom: 26px;
          perspective: 1400px;
        }

        /* Connector stays centred while cards stretch to equal height */
        .lb-construction-flow .lb-flow-connector {
          align-self: center;
        }

        /* ── Glass panel wrapper ── */
        .lb-gp-wrap {
          cursor: pointer;
          user-select: none;
          transform-style: preserve-3d;
          will-change: transform;
        }

        /* ── Rings layer (behind glass) ── */
        .lb-gp-rings {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }

        /* ── Glass face — sits in front, translateZ ── */
        .lb-gp-face {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(130deg,
              rgba(255,255,255,0.08) 0%,
              rgba(255,255,255,0.02) 45%,
              rgba(255,255,255,0.06) 100%
            ),
            rgba(8,9,12,0.76);
          backdrop-filter: blur(18px) saturate(1.25);
          overflow: hidden;
        }

        /* Shimmer: follows mouse */
        .lb-gp-shimmer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
        }

        /* Gold refraction edge lines — like real thick-glass spectacle frames */
        .lb-gp-edge {
          position: absolute;
          pointer-events: none;
          z-index: 3;
        }
        .lb-gp-edge-top {
          top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg,
            transparent 3%,
            rgba(250,204,21,0.35) 18%,
            rgba(255,255,200,0.85) 50%,
            rgba(250,204,21,0.35) 82%,
            transparent 97%);
        }
        .lb-gp-edge-bottom {
          bottom: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg,
            transparent 5%,
            rgba(250,204,21,0.2) 30%,
            rgba(250,204,21,0.4) 50%,
            rgba(250,204,21,0.2) 70%,
            transparent 95%);
        }
        .lb-gp-edge-left {
          top: 0; left: 0; bottom: 0; width: 2px;
          background: linear-gradient(180deg,
            transparent 5%,
            rgba(250,204,21,0.4) 30%,
            rgba(255,255,200,0.6) 50%,
            rgba(250,204,21,0.3) 75%,
            transparent 95%);
        }
        .lb-gp-edge-right {
          top: 0; right: 0; bottom: 0; width: 2px;
          background: linear-gradient(180deg,
            transparent 5%,
            rgba(250,204,21,0.3) 30%,
            rgba(255,255,200,0.5) 55%,
            rgba(250,204,21,0.3) 75%,
            transparent 95%);
        }

        /* ── 3D depth layer just behind glass ── */
        .lb-gp-depth {
          position: absolute;
          inset: 3px;
          background: rgba(250,204,21,0.03);
          box-shadow: 0 0 50px rgba(250,204,21,0.16);
        }

        /* ── Glowing frame overlay ── */
        .lb-gp-glow-border {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 18;
        }

        /* ── Original flow card styles — UNCHANGED ── */
        .lb-flow-card {
          position: relative;
          min-height: 430px;
          height: 100%;
          box-sizing: border-box;
          padding: 34px 32px;
          border: 1px solid rgba(250,204,21,0.18);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01)),
            rgba(8,9,12,0.92);
          box-shadow: 0 28px 70px rgba(0,0,0,0.42);
          overflow: hidden;
        }

        .lb-selection-card {
          border-color: rgba(250,204,21,0.30);
          background:
            radial-gradient(ellipse at 0% 0%, rgba(250,204,21,0.09), transparent 54%),
            rgba(8,9,12,0.90);
          box-shadow:
            0 28px 70px rgba(0,0,0,0.55),
            0 0 90px rgba(250,204,21,0.07),
            inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .lb-allocation-card {
          border-color: rgba(250,204,21,0.30);
          background:
            radial-gradient(ellipse at 100% 0%, rgba(250,204,21,0.09), transparent 54%),
            rgba(8,9,12,0.90);
          box-shadow:
            0 28px 70px rgba(0,0,0,0.55),
            0 0 90px rgba(250,204,21,0.07),
            inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .lb-flow-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border: 1px solid rgba(255,255,255,0.04);
          pointer-events: none;
          z-index: 4;
        }

        .lb-flow-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 36px;
          font-family: 'DM Mono', monospace;
        }

        .lb-flow-card-top span {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid rgba(250,204,21,0.3);
          color: #facc15;
          font-size: 12px;
        }

        .lb-flow-card-top p {
          margin: 0;
          color: rgba(255,255,255,0.42);
          font-size: 9px;
          letter-spacing: 4px;
        }

        .lb-flow-card h3 {
          margin: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(46px, 5vw, 68px);
          font-weight: 300;
          line-height: 0.95;
          color: #f7f0df;
        }

        .lb-flow-card strong {
          display: block;
          margin-top: 16px;
          color: #facc15;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          letter-spacing: 0.4px;
        }

        .lb-flow-card small {
          display: block;
          margin-top: 12px;
          font-family: 'DM Mono', monospace;
          color: rgba(255,255,255,0.43);
          line-height: 1.7;
        }

        .lb-flow-card ul {
          list-style: none;
          padding: 24px 0 0;
          margin: 26px 0 0;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .lb-flow-card li {
          position: relative;
          padding-left: 18px;
          margin-bottom: 14px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          line-height: 1.7;
          color: rgba(255,255,255,0.58);
        }

        .lb-flow-card li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 9px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #facc15;
          box-shadow: 0 0 12px rgba(250,204,21,0.45);
        }

        .lb-flow-output {
          margin-top: 26px;
          padding: 14px 16px;
          border: 1px solid rgba(250,204,21,0.18);
          background: rgba(250,204,21,0.045);
          color: rgba(255,255,255,0.72);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          line-height: 1.7;
        }

        .lb-flow-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          color: #facc15;
        }

        .lb-flow-connector span {
          width: 1px;
          height: 92px;
          background: linear-gradient(180deg, transparent, rgba(250,204,21,0.7), transparent);
        }

        .lb-flow-connector p {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          margin: 0;
          border-radius: 50%;
          border: 1px solid rgba(250,204,21,0.42);
          background: rgba(250,204,21,0.08);
          box-shadow: 0 0 34px rgba(250,204,21,0.16);
          font-size: 24px;
        }

        .lb-risk-output {
          position: relative;
          padding: 36px 32px;
          border: 1px solid rgba(250,204,21,0.28);
          background:
            radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.16), transparent 55%),
            rgba(8,9,12,0.94);
          text-align: center;
          overflow: hidden;
        }

        .lb-output-glow {
          position: absolute;
          left: 50%;
          top: -120px;
          width: 360px;
          height: 220px;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(250,204,21,0.18), transparent 65%);
          pointer-events: none;
        }

        .lb-risk-output span {
          position: relative;
          display: block;
          margin-bottom: 14px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 5px;
          color: #facc15;
        }

        .lb-risk-output h3 {
          position: relative;
          margin: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(44px, 5vw, 72px);
          font-weight: 300;
          line-height: 1;
          color: #f7f0df;
        }

        .lb-risk-output p {
          position: relative;
          margin: 16px 0 26px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          color: rgba(255,255,255,0.52);
        }

        .lb-output-tags {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .lb-output-tags em {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-style: normal;
          letter-spacing: 2.5px;
          color: rgba(255,255,255,0.72);
          text-transform: uppercase;
        }

        .lb-output-tags i {
          width: 24px;
          height: 1px;
          background: rgba(250,204,21,0.5);
        }

        .lb-workflow-strip {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto 90px;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.018);
        }

        .lb-workflow-step {
          position: relative;
          min-height: 210px;
          padding: 28px 22px;
          border-right: 1px solid rgba(255,255,255,0.08);
          transition: all 0.28s ease;
        }

        .lb-workflow-step:last-child { border-right: none; }

        .lb-workflow-step:hover {
          background:
            radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.075), transparent 62%),
            rgba(255,255,255,0.025);
        }

        .lb-workflow-step span {
          display: block;
          margin-bottom: 28px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 42px;
          line-height: 1;
          color: rgba(250,204,21,0.25);
        }

        .lb-workflow-step h3 {
          margin: 0 0 12px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 300;
          line-height: 1;
          color: #f7f0df;
        }

        .lb-workflow-step p {
          margin: 0;
          font-family: 'DM Mono', monospace;
          font-size: 10.5px;
          line-height: 1.8;
          color: rgba(255,255,255,0.38);
        }

        .lb-model-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .lb-model-card {
          position: relative;
          min-height: 230px;
          padding: 32px 28px;
          background: rgba(8,9,12,0.96);
          transition: all 0.28s ease;
          overflow: hidden;
        }

        .lb-model-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.075), transparent 60%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .lb-model-card:hover { background: rgba(14,15,18,1); }
        .lb-model-card:hover::after { opacity: 1; }

        .lb-model-card p {
          position: relative;
          z-index: 1;
          margin: 0 0 20px;
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          letter-spacing: 3px;
          color: rgba(250,204,21,0.75);
        }

        .lb-model-card h3 {
          position: relative;
          z-index: 1;
          margin: 0 0 14px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 30px;
          font-weight: 300;
          color: #f7f0df;
          line-height: 1;
        }

        .lb-model-card span {
          position: relative;
          z-index: 1;
          display: block;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          line-height: 1.8;
          color: rgba(255,255,255,0.4);
        }

        .lb-card-corner {
          position: absolute;
          bottom: 18px;
          right: 18px;
          width: 18px;
          height: 18px;
          border-right: 1px solid rgba(250,204,21,0.28);
          border-bottom: 1px solid rgba(250,204,21,0.28);
        }

        .lb-rebalance-section {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto 92px;
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 42px;
          align-items: stretch;
          border: 1px solid rgba(250,204,21,0.14);
          background:
            radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.055), transparent 58%),
            rgba(8,9,12,0.82);
          padding: 42px;
        }

        .lb-rebalance-copy span {
          display: block;
          margin-bottom: 22px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 5px;
          color: #facc15;
        }

        .lb-rebalance-copy h2 {
          margin: 0 0 22px;
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(42px, 4vw, 66px);
          font-weight: 300;
          line-height: 0.98;
          color: #f7f0df;
        }

        .lb-rebalance-copy p {
          margin: 0;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          line-height: 2;
          color: rgba(255,255,255,0.43);
        }

        .lb-rule-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .lb-rule-grid div {
          padding: 32px 26px;
          background: rgba(5,6,8,0.94);
        }

        .lb-rule-grid strong {
          display: block;
          margin-bottom: 18px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 46px;
          font-weight: 300;
          color: #facc15;
        }

        .lb-rule-grid span {
          font-family: 'DM Mono', monospace;
          font-size: 10.5px;
          line-height: 1.8;
          color: rgba(255,255,255,0.42);
        }

        .lb-final-message {
          position: relative;
          z-index: 1;
          max-width: 980px;
          margin: 0 auto;
          text-align: center;
          padding: 60px 24px 10px;
        }

        .lb-final-message p {
          margin: 0 0 24px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 5px;
          color: #facc15;
        }

        .lb-final-message h2 {
          margin: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(46px, 5.5vw, 82px);
          font-weight: 300;
          line-height: 0.98;
          color: #f7f0df;
        }

        @keyframes lbPulse {
          0%, 100% { opacity: 0.45; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        @media (max-width: 1180px) {
          .lb-dashboard-welcome { padding: 72px 48px 88px; }

          .lb-welcome-grid,
          .lb-rebalance-section { grid-template-columns: 1fr; }

          .lb-construction-flow { grid-template-columns: 1fr; }

          .lb-flow-connector {
            flex-direction: row;
            justify-content: center;
          }

          .lb-flow-connector span {
            width: 90px; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(250,204,21,0.7), transparent);
          }

          .lb-workflow-strip { grid-template-columns: repeat(3, 1fr); }
          .lb-workflow-step:nth-child(3) { border-right: none; }
          .lb-workflow-step:nth-child(-n + 3) { border-bottom: 1px solid rgba(255,255,255,0.08); }
        }

        @media (max-width: 820px) {
          .lb-dashboard-welcome { padding: 56px 24px 72px; }
          .lb-welcome-title { font-size: clamp(48px, 13vw, 72px); }
          .lb-welcome-actions { flex-direction: column; }
          .lb-welcome-actions button { width: 100%; }
          .lb-flow-card { min-height: auto; height: auto; }
          .lb-gp-wrap { transform: none !important; }

          .lb-workflow-strip,
          .lb-model-grid,
          .lb-rule-grid { grid-template-columns: 1fr; }

          .lb-workflow-step {
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .lb-workflow-step:last-child { border-bottom: none; }
          .lb-model-card { min-height: auto; }
          .lb-rebalance-section { padding: 30px 24px; }
        }

        @media (max-width: 520px) {
          .lb-dashboard-welcome { padding: 42px 18px 60px; }
          .lb-welcome-eyebrow { font-size: 8px; letter-spacing: 3px; }
          .lb-welcome-title { letter-spacing: -1.4px; }

          .lb-welcome-desc,
          .lb-rebalance-copy p,
          .lb-portfolio-heading p { font-size: 11px; }

          .lb-welcome-terminal,
          .lb-flow-card { padding: 22px; }

          .lb-terminal-line { grid-template-columns: 32px 1fr; font-size: 10px; }

          .lb-flow-card-top {
            align-items: flex-start;
            gap: 12px;
            flex-direction: column;
          }

          .lb-risk-output { padding: 30px 20px; }
        }
      `}</style>
    </div>
  );
};

export default DashboardWelcome;
