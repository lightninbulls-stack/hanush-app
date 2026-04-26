import React, { useMemo, useRef, useState, useEffect } from "react";
import { loginUser, registerUser, saveAuthToken } from "../api";

type AuthMode = "login" | "signup";

type FeatureInfo = {
  name: string;
  icon: string;
  tag: string;
  what: string;
  model: string;
  why: string;
  example: string;
};

const initialSignUpState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const features: FeatureInfo[] = [
  {
    name: "Watchlist",
    icon: "◈",
    tag: "TRACK",
    what: "Watchlist is the central command layer where selected stocks, strategy signals, model outputs, and high-conviction trading ideas are tracked in one place.",
    model: "The Watchlist operates as an execution-ready monitoring layer that receives curated outputs from momentum, regime, value, quality, range-bound, options, and intraday signal models. It applies systematic filtering rules to reduce the tradeable universe from thousands of stocks to a focused, signal-backed shortlist. Each entry in the watchlist is tagged by strategy type, signal strength, and model source so the trader always knows why a stock is being tracked.",
    why: "Manual market scanning introduces cognitive overload, confirmation bias, and missed opportunities. The Watchlist removes decision noise by ensuring only model-validated ideas enter the trader's field of attention. It enforces discipline by separating the stock selection process from the execution process, which is a critical distinction in systematic trading.",
    example: "Before market open, a trader populates the Watchlist with Consistent Trending momentum names, Regime Upside stocks, and Intraday Bull Call Spread signals. During market hours, monitoring is restricted to this filtered list, avoiding impulsive trades on stocks outside the systematic framework.",
  },
  {
    name: "Portfolio Backtest",
    icon: "◉",
    tag: "TEST",
    what: "Portfolio Backtest allows users to rigorously test how a strategy or stock basket would have performed historically across different market environments before committing real capital.",
    model: "The backtest engine evaluates portfolio-level metrics including annualised returns, calendar-year performance breakdown, maximum drawdown, volatility, Sharpe ratio, Sortino ratio, portfolio turnover, and hit rate. It supports equal-weight allocation and mean-variance optimisation (MVO) to compare risk-adjusted outcomes. The engine segments performance across bull, bear, sideways, high-volatility, and low-volatility regimes to stress-test strategy behaviour.",
    why: "A strategy that performs well in recent markets may be a product of regime luck rather than structural edge. Backtesting across multiple market cycles provides statistical evidence of whether a strategy has genuine alpha, acceptable drawdown characteristics, and consistent behaviour across varying conditions. It prevents the common mistake of deploying untested capital based on short-term recency bias.",
    example: "A trader builds a 20-stock momentum portfolio with monthly rebalancing. The backtest compares equal-weight allocation versus MVO across the last five years, revealing that MVO reduced maximum drawdown by 18% while maintaining comparable annualised returns, making it the preferred construction method.",
  },
  {
    name: "Consistent Trending",
    icon: "◆",
    tag: "MOMENTUM",
    what: "Consistent Trending is a quant momentum model that identifies stocks showing persistent and stable price strength across multiple lookback windows, filtering for repeatable trend behaviour rather than short-lived spikes.",
    model: "The model evaluates price momentum across short, medium, and longer lookback periods simultaneously and scores stocks on the consistency of their outperformance across all windows. It penalises stocks with erratic momentum — strong in one period but weak in another — and rewards names where trend participation is smooth, drawdowns are controlled, and upside continuation is statistically persistent. This multi-window consistency score forms the primary ranking factor.",
    why: "Single-period momentum strategies are susceptible to mean reversion after sharp one-directional moves. By requiring consistency across multiple timeframes, this model selects stocks where price strength is structural rather than episodic. This improves the probability of trend continuation post-entry and reduces exposure to false breakouts driven by noise or temporary sector rotations.",
    example: "A stock that ranks in the top decile of 1-month, 3-month, and 6-month momentum simultaneously, shows controlled retracements below 8%, and has participated in the last four consecutive market upswings qualifies as a Consistent Trending candidate suitable for a momentum portfolio allocation.",
  },
  {
    name: "Slow Movement",
    icon: "◇",
    tag: "STABILITY",
    what: "Slow Movement identifies stocks that exhibit gradual, low-volatility directional drift with controlled intraday behaviour, minimal gap risk, and stable trend participation over extended periods.",
    model: "The model filters for low realised volatility, smooth intraday candle structure, absence of erratic gaps, and consistent directional drift. It ranks stocks by the ratio of directional price change to total price movement — a high ratio indicates efficient, low-noise trending. Stocks with frequent whipsaws, wide daily ranges relative to trend progress, or unstable beta are systematically excluded.",
    why: "For conservative portfolios and long-term compounders, low-volatility stable trends are preferable to aggressive momentum because they produce smoother NAV curves, lower drawdown depth, and reduced behavioural pressure to exit positions prematurely. Slow Movement names also tend to have better Sharpe ratios over long holding periods compared to high-beta momentum stocks.",
    example: "A defensive sector stock rising 18% over 12 weeks with daily moves averaging 0.4%, no gaps above 1%, and consistent buying volume qualifies as a Slow Movement candidate suitable for a low-volatility income or retirement portfolio sleeve.",
  },
  {
    name: "Cheap Value",
    icon: "◐",
    tag: "VALUE",
    what: "Cheap Value identifies stocks that appear undervalued relative to their fundamental and price-based characteristics while also showing early signs of market recognition or structural improvement.",
    model: "The model blends valuation-style ranking with price trend confirmation. It screens for stocks trading at relative discounts across multiple valuation dimensions and then applies a price-based filter to identify names where the market is beginning to recognise the mispricing. This dual-confirmation approach avoids the classic value trap where cheap stocks remain cheap indefinitely without a catalyst for re-rating.",
    why: "Pure statistical value screens frequently identify distressed or structurally impaired businesses that deserve their low valuations. Adding price-based confirmation ensures the model selects value stocks where an actual re-rating process has begun. This improves timing precision and distinguishes genuine value opportunities from permanent impairments masquerading as cheap stocks.",
    example: "A stock trading at a significant discount to its sector peers on price-to-earnings and price-to-book metrics, while also showing improving price structure and rising relative strength over the past six weeks, enters the Cheap Value bucket as a candidate for a value-plus-momentum blended strategy.",
  },
  {
    name: "Best Quality",
    icon: "◑",
    tag: "QUALITY",
    what: "Best Quality filters for companies exhibiting superior stability, cleaner market behaviour, lower return volatility, and more predictable trend structure relative to the broader market universe.",
    model: "The model evaluates stocks on a composite quality score that rewards consistency of price behaviour, lower beta to index movements, stable relative performance across multiple market regimes, and absence of structural weakness signals. It acts as a pre-filter for portfolio construction by establishing a clean, higher-quality sub-universe before applying momentum, value, or other factor overlays.",
    why: "Lower-quality stocks — characterised by high volatility, unstable trends, and weak survivability across regimes — can appear attractive in isolation but dilute portfolio-level risk-adjusted returns when included in factor strategies. Quality filtering at the universe level is one of the most effective ways to improve the overall robustness of a systematic strategy without sacrificing return potential.",
    example: "Before constructing a long-only momentum portfolio, a portfolio manager applies the Best Quality filter to reduce the universe from 500 stocks to the top 150 by quality score. This pre-filtered universe is then ranked by momentum, producing a final 20-stock portfolio with significantly lower historical drawdown than an unfiltered momentum approach.",
  },
  {
    name: "Regime Upside",
    icon: "▲",
    tag: "RISK-ON",
    what: "Regime Upside identifies stocks with the highest beta to positive market regimes — stocks that participate most strongly when index trend, market breadth, and risk appetite are collectively supportive.",
    model: "The model analyses each stock's historical return behaviour during bullish market regime periods — defined by index uptrend, expanding breadth, positive sector rotation, and improving risk sentiment. It scores stocks by their average excess return, consistency of outperformance, and drawdown behaviour specifically during these regime windows.",
    why: "Not all stocks participate equally in bull phases. Regime Upside ensures long exposures are concentrated in stocks with the highest probability of capturing the current upside move, improving the efficiency of risk deployment in favourable market environments.",
    example: "When Nifty 50 is in a confirmed uptrend with breadth above 65% and FII flows are net positive, Regime Upside highlights high-beta, high-participation names in sectors aligned with the current rotation.",
  },
  {
    name: "Regime Downside",
    icon: "▼",
    tag: "RISK-OFF",
    what: "Regime Downside identifies stocks that become most vulnerable and underperform most severely when market conditions shift to a bearish, risk-off, or high-volatility regime.",
    model: "The model examines each stock's historical behaviour during negative regime periods — characterised by index downtrends, contracting breadth, rising VIX, and risk-off sector rotation. It identifies stocks with persistently elevated downside beta, weak recovery behaviour after market bounces, and tendency to lead market declines.",
    why: "During risk-off regimes, holding weak names causes disproportionate portfolio damage because they fall faster and recover slower than the index. Regime Downside helps traders identify which positions to exit, hedge, or short during unfavourable market environments.",
    example: "When Nifty 50 breaks below its 50-day moving average with breadth below 35% and FII selling accelerates, Regime Downside highlights stocks most likely to fall 20-40% from current levels.",
  },
  {
    name: "Range Bound Upside",
    icon: "◭",
    tag: "RANGE",
    what: "Range Bound Upside identifies stocks trading within a defined price range but exhibiting upside pressure near support zones, showing accumulation behaviour and breakout readiness characteristics.",
    model: "The model detects sideways consolidation structures where buyers are repeatedly defending lower price levels. It analyses support strength, volume behaviour at range lows, compression of volatility, upside pressure indicators, and breadth of accumulation to score stocks by their breakout probability.",
    why: "The highest-risk-reward entries often occur before a trend becomes fully visible. By identifying accumulation inside a range before the breakout is obvious, traders can enter at lower prices with defined risk relative to the range support.",
    example: "A large-cap stock consolidating between 1,200 and 1,380 for 14 weeks, repeatedly bouncing from 1,210 with increasing volume at each touch of support, enters Range Bound Upside as a pre-breakout accumulation candidate.",
  },
  {
    name: "Range Bound Downside",
    icon: "◮",
    tag: "RANGE",
    what: "Range Bound Downside identifies stocks in sideways consolidation that are exhibiting distribution behaviour, repeated rejection at resistance, and increasing downside pressure suggesting an impending breakdown.",
    model: "The model detects distribution-like structures within consolidation ranges — repeated failures at resistance, weak recovery attempts after each bounce, declining volume on upside moves and increasing volume on downside moves, and compression of price action near the lower boundary of the range.",
    why: "Waiting for a confirmed breakdown before entering bearish trades often means missing a significant portion of the move. By identifying distribution behaviour inside a range before the breakdown is confirmed, traders can position in advance with defined risk relative to the resistance level.",
    example: "A mid-cap stock oscillating between 540 and 620, failing at 615 on each attempt with declining volume and showing progressively weaker bounces from 545, enters Range Bound Downside as a pre-breakdown distribution candidate.",
  },
  {
    name: "Aggressive Call Option Stocks",
    icon: "⬡",
    tag: "OPTIONS",
    what: "Aggressive Call Option Stocks identifies underlying stocks where directional strength, volatility expansion, and breakout behaviour combine to create high-probability bullish option trade setups.",
    model: "The model filters for stocks exhibiting strong upside momentum, expanding realised volatility relative to implied volatility, breakout confirmation from key technical levels, high options open interest in call strikes, and premium expansion behaviour that supports bullish option strategies.",
    why: "Randomly buying call options on momentum stocks without underlying model confirmation leads to high loss rates due to time decay, IV crush post-event, and poor entry timing. This model ensures bullish options trades are placed only on stocks where the underlying price structure supports premium expansion.",
    example: "A stock breaking out of a 10-week base with 3x average volume, expanding ATR, rising open interest in near-month calls, and sector tailwinds enters the Aggressive Call Option bucket as a candidate for an ATM or slightly OTM call with 3-4 week expiry.",
  },
  {
    name: "Aggressive Put Option Stocks",
    icon: "⬢",
    tag: "OPTIONS",
    what: "Aggressive Put Option Stocks identifies underlying stocks where structural weakness, volatility expansion, and breakdown behaviour create high-probability bearish option trade setups.",
    model: "The model filters for stocks with confirmed bearish momentum, breakdown from key support levels, rising realised volatility, elevated put open interest, and premium expansion behaviour consistent with bearish option strategies.",
    why: "Buying puts on randomly weak stocks fails because elevated implied volatility often already prices the expected move. This model identifies situations where the underlying breakdown is structural and volatility expansion is in its early phase.",
    example: "A stock breaking below a 6-month support level with increasing sell volume, rising put OI in near-month strikes, and a weakening sector backdrop enters the Aggressive Put Option bucket.",
  },
  {
    name: "Intraday Bull Call Spreads",
    icon: "◈",
    tag: "INTRADAY",
    what: "Intraday Bull Call Spreads identifies defined-risk, limited-capital bullish options spread opportunities during market hours, combining index direction confirmation with stock-level upside momentum.",
    model: "The model integrates intraday index trend confirmation, real-time breadth data, sector rotation signals, and stock-level upside momentum to identify bull call spread candidates. It evaluates optimal strike selection based on premium-to-risk ratios and intraday support levels.",
    why: "Naked call buying exposes traders to full premium loss on any adverse move. A bull call spread reduces the capital at risk while maintaining meaningful directional exposure in a confirmed upside environment.",
    example: "When Nifty confirms intraday upside above a key resistance with improving breadth and a specific stock shows a clean bull flag on the 15-minute chart, the model identifies a bull call spread as a defined-risk trade with a 2.5:1 reward-to-risk profile.",
  },
  {
    name: "Intraday Bear Put Spreads",
    icon: "◇",
    tag: "INTRADAY",
    what: "Intraday Bear Put Spreads identifies defined-risk, limited-capital bearish options spread opportunities during market hours, combining index weakness confirmation with stock-level downside momentum.",
    model: "The model combines intraday index downtrend signals, contracting breadth, sector weakness data, and stock-level bearish momentum to identify bear put spread candidates. It analyses premium-to-risk ratios for put spread structures and optimal strike spacing given current implied volatility levels.",
    why: "Bear put spreads allow traders to express high-conviction bearish intraday views with precisely defined maximum loss, avoiding the rapid premium erosion of naked put buying during unexpected intraday reversals.",
    example: "When BankNifty breaks intraday support with declining breadth and a banking sector stock shows a confirmed distribution breakdown on the 15-minute chart, the model constructs a bear put spread targeting a 2:1 to 3:1 reward-to-risk outcome by end of session.",
  },
  {
    name: "Upside Trend Stocks",
    icon: "◆",
    tag: "LIVE",
    what: "Upside Trend Stocks delivers a real-time feed of stocks exhibiting confirmed intraday upside momentum, allowing traders to monitor active long opportunities without manual market scanning.",
    model: "The model processes live price feeds, intraday trend direction, momentum persistence indicators, volume confirmation, and relative strength versus the index to identify stocks where upside momentum is structurally active rather than a temporary spike.",
    why: "Manual intraday scanning of hundreds of stocks is operationally impossible and introduces significant selection bias. Upside Trend Stocks eliminates this problem by delivering a systematically filtered live list of stocks where upside momentum is confirmed in real time.",
    example: "During market hours, a stock breaking above its intraday range high with 2x average volume and positive relative strength versus Nifty appears in the Upside Trend Stocks panel for monitoring or momentum continuation trade.",
  },
  {
    name: "Downside Trend Stocks",
    icon: "◉",
    tag: "LIVE",
    what: "Downside Trend Stocks delivers a real-time feed of stocks exhibiting confirmed intraday downside momentum, enabling traders to monitor active short or defensive opportunities without manual scanning.",
    model: "The model processes live price behaviour, intraday breakdown confirmations, selling volume characteristics, momentum decay indicators, and relative weakness versus the index to identify stocks where bearish momentum is structurally active.",
    why: "Identifying genuine intraday weakness versus false breakdowns driven by temporary selling pressure requires systematic signal confirmation. Downside Trend Stocks removes this ambiguity by presenting only stocks where bearish momentum is multi-factor confirmed.",
    example: "A stock breaking intraday support with rising sell volume, negative relative strength versus BankNifty, and a confirmed downside trend on multiple timeframes appears in the Downside Trend Stocks panel as a signal to exit longs or construct a short-side position.",
  },
];

const socialLinks = [
  { label: "LinkedIn", url: "https://www.linkedin.com/company/lightninbull/" },
  { label: "Instagram", url: "https://www.instagram.com/lightninbull/" },
  { label: "Facebook", url: "https://www.facebook.com/lightninbull/" },
  { label: "Pinterest", url: "https://www.pinterest.com/lightninbull/" },
  { label: "Twitter", url: "https://x.com/lightninbull" },
];

/* ─── Mouse-local lightning: tiny bolts near cursor, very rare ─── */
const LocalLightning: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const boltsRef = useRef<Array<{
    pts: { x: number; y: number }[];
    opacity: number;
  }>>([]);
  const lastBoltTime = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const makeBolt = (mx: number, my: number) => {
      const angle = (Math.random() * Math.PI * 2);
      const len = 80 + Math.random() * 100;
      const pts: { x: number; y: number }[] = [{ x: mx, y: my }];
      let cx = mx, cy = my;
      const segs = 6 + Math.floor(Math.random() * 5);
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const baseX = mx + Math.cos(angle) * len * t;
        const baseY = my + Math.sin(angle) * len * t;
        cx = baseX + (Math.random() - 0.5) * 28;
        cy = baseY + (Math.random() - 0.5) * 28;
        pts.push({ x: cx, y: cy });
      }
      boltsRef.current.push({ pts, opacity: 0.9 });
      // max 3 bolts at a time
      if (boltsRef.current.length > 3) boltsRef.current.shift();
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      const now = Date.now();
      // Only spark every 3–6 seconds randomly on mouse move
      if (now - lastBoltTime.current > 3000 + Math.random() * 3000) {
        makeBolt(e.clientX, e.clientY);
        lastBoltTime.current = now;
      }
    };

    window.addEventListener("mousemove", onMouseMove);

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      boltsRef.current = boltsRef.current.filter(b => b.opacity > 0.02);

      for (const bolt of boltsRef.current) {
        const { pts, opacity } = bolt;
        if (pts.length < 2) continue;

        // Glow layer
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(250,204,21,${opacity * 0.35})`;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 18;
        ctx.shadowColor = `rgba(250,200,0,${opacity * 0.7})`;
        ctx.stroke();

        // Core
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(255,245,160,${opacity * 0.85})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(255,255,200,${opacity})`;
        ctx.stroke();

        bolt.opacity *= 0.72;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
};

/* ─── GlassCard: individual card with push + electric spark on click ─── */
interface GlassCardProps {
  feature: FeatureInfo;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({ feature, index, isSelected, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const sparkingRef = useRef(false);

  const fireSparks = (clickX: number, clickY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || sparkingRef.current) return;
    sparkingRef.current = true;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sparks radiate from click point
    const sparks: {
      x: number; y: number;
      vx: number; vy: number;
      len: number; opacity: number; life: number;
    }[] = [];

    const count = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 1.5 + Math.random() * 3.5;
      sparks.push({
        x: clickX, y: clickY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 18 + Math.random() * 28,
        opacity: 0.9 + Math.random() * 0.1,
        life: 1,
      });
    }

    // Also 2-3 short branch sparks
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.5;
      sparks.push({
        x: clickX + (Math.random() - 0.5) * 20,
        y: clickY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 10 + Math.random() * 14,
        opacity: 0.7,
        life: 1,
      });
    }

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const s of sparks) {
        if (s.life <= 0) continue;
        alive = true;
        s.life -= 0.06;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.88;
        s.vy *= 0.88;

        const op = s.opacity * s.life;

        // Glow
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 4), s.y - s.vy * (s.len / 4));
        ctx.strokeStyle = `rgba(250,204,21,${op * 0.35})`;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(250,200,0,${op * 0.8})`;
        ctx.stroke();

        // Core spark line
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 4), s.y - s.vy * (s.len / 4));
        ctx.strokeStyle = `rgba(255,248,160,${op * 0.95})`;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 4;
        ctx.shadowColor = `rgba(255,255,200,${op})`;
        ctx.stroke();
      }

      if (alive) {
        raf = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        sparkingRef.current = false;
      }
    };

    raf = requestAnimationFrame(draw);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const card = cardRef.current;
    if (card) {
      const rect = card.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      fireSparks(cx, cy);
    }
    onClick();
  };

  return (
    <button
      ref={cardRef}
      type="button"
      className={`feature-card ${isSelected ? "selected" : ""}`}
      style={{ animationDelay: `${index * 0.035}s` }}
      onClick={handleClick}
    >
      {/* Spark canvas — sits over the card, pointer-events none */}
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10,
          borderRadius: "12px",
        }}
      />

      <div className="feature-topline">
        <span className="card-icon">{feature.icon}</span>
        <span className="feature-tag">{feature.tag}</span>
      </div>
      <h3 className="card-title">
        <span className="title-thunder">{feature.name}</span>
      </h3>
      <p className="card-desc">{feature.what}</p>
      <span className="feature-action">View details →</span>
      <div className="card-corner" />
    </button>
  );
};

/* ─── Main Auth component ─── */
const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signUpForm, setSignUpForm] = useState(initialSignUpState);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo | null>(null);

  const authCardRef = useRef<HTMLDivElement | null>(null);
  const intelligenceRef = useRef<HTMLElement | null>(null);
  const aboutRef = useRef<HTMLElement | null>(null);
  const contactRef = useRef<HTMLElement | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const heading = useMemo(
    () => mode === "login" ? "access your trading dashboard" : "create your lightninbull account",
    [mode]
  );

  const resetMessages = () => { setErrorMessage(""); setSuccessMessage(""); };

  const scrollToElement = (el: HTMLElement | null) =>
    el?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openSignUp = () => {
    setMode("signup");
    resetMessages();
    setTimeout(() => authCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const handleFeatureClick = (feature: FeatureInfo) => {
    setSelectedFeature(feature);
    setTimeout(() => detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages(); setLoading(true);
    try {
      const result = await loginUser(phone, password);
      saveAuthToken(result.access_token);
      window.location.href = "/dashboard";
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  };

  const handleSignUpChange = (field: keyof typeof initialSignUpState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSignUpForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    if (signUpForm.password !== signUpForm.confirmPassword) {
      setErrorMessage("Passwords do not match."); return;
    }
    setLoading(true);
    try {
      await registerUser({ name: signUpForm.name, email: signUpForm.email, phone: signUpForm.phone, password: signUpForm.password });
      const loginResult = await loginUser(signUpForm.phone, signUpForm.password);
      saveAuthToken(loginResult.access_token);
      setSuccessMessage("Account created successfully. Redirecting...");
      window.location.href = "/dashboard";
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sign up failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <LocalLightning />

      {/* ═══════════════════════════════════════════════
          HERO — everything fits in one viewport
      ═══════════════════════════════════════════════ */}
      <section className="hero-section">
        <video autoPlay muted loop playsInline className="bg-video">
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>
        <div className="video-overlay" />
        <div className="noise-overlay" />
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />

        {/* NAV */}
        <nav className="top-nav">
          <button type="button" className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="logo-bolt">⚡</span> LIGHTNINBULL
          </button>
          <div className="nav-links">
            <button type="button" onClick={() => scrollToElement(intelligenceRef.current)}>markets</button>
            <button type="button" onClick={() => scrollToElement(intelligenceRef.current)}>intelligence</button>
            <button type="button" onClick={() => scrollToElement(intelligenceRef.current)}>research</button>
            <button type="button" onClick={() => scrollToElement(aboutRef.current)}>about us</button>
            <button type="button" onClick={() => scrollToElement(contactRef.current)}>contact</button>
          </div>
        </nav>

        {/* MAIN HERO BODY — two columns, fills 100vh */}
        <div className="hero-body">

          {/* LEFT COLUMN */}
          <div className="hero-left">
            <p className="eyebrow-label">INSTITUTIONAL QUANT INTELLIGENCE</p>

            <h1 className="hero-headline">
              Invest and trade
              <br />
              with the <span className="headline-gold">precision</span>
              <br />
              of algorithms.
            </h1>

            <p className="hero-subtext">
              Real-time signals. Deep factor analytics.
              Built for traders who demand discipline, data, and edge.
            </p>

            {/* STATS */}
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">10K+</span>
                <span className="stat-label">active users</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">16+</span>
                <span className="stat-label">AI modules</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-num">live</span>
                <span className="stat-label">signal engine</span>
              </div>
            </div>

            {/* QUANT AI — visible directly below stats in hero */}
            <div className="quant-block">
              <div className="quant-accent-bar" />
              <div className="quant-inner">
                <span className="quant-label">LIGHTNINBULL INTELLIGENCE LAYER</span>
                <h2 className="quant-heading">
                  Quant <em className="quant-ai">AI</em> Fund Manager
                </h2>
                <p className="quant-sub">Factor models · Regime detection · Intraday signals · Derivatives analytics</p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Login card */}
          <div ref={authCardRef} className="login-card">
            <div className="card-header">
              <span className="card-logo">⚡ LIGHTNINBULL</span>
              <p className="card-sub">{heading}</p>
            </div>
            <div className="card-divider" />

            {errorMessage ? <div className="auth-alert error">{errorMessage}</div> : null}
            {successMessage ? <div className="auth-alert success">{successMessage}</div> : null}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="login-form">
                <div className="input-group">
                  <label className="input-label">PHONE NUMBER</label>
                  <input placeholder="+91 00000 00000" value={phone} onChange={e => setPhone(e.target.value)} className="input" required />
                </div>
                <div className="input-group">
                  <label className="input-label">PASSWORD</label>
                  <input type="password" placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} className="input" required />
                </div>
                <button className="btn" disabled={loading} type="submit">
                  {loading ? <span className="btn-loading"><span className="spinner" /> Authenticating...</span> : <span>Access Dashboard →</span>}
                </button>
                <button type="button" className="signup-ghost-btn" onClick={openSignUp}>
                  New to LightninBull? Create Account →
                </button>
                <p className="forgot-link">Forgot credentials? <a href="#support">Contact support</a></p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="login-form">
                <div className="input-group">
                  <label className="input-label">FULL NAME</label>
                  <input placeholder="Your name" value={signUpForm.name} onChange={handleSignUpChange("name")} className="input" required />
                </div>
                <div className="input-group">
                  <label className="input-label">EMAIL</label>
                  <input type="email" placeholder="you@example.com" value={signUpForm.email} onChange={handleSignUpChange("email")} className="input" required />
                </div>
                <div className="input-group">
                  <label className="input-label">PHONE NUMBER</label>
                  <input placeholder="+91 00000 00000" value={signUpForm.phone} onChange={handleSignUpChange("phone")} className="input" required />
                </div>
                <div className="signup-grid">
                  <div className="input-group">
                    <label className="input-label">PASSWORD</label>
                    <input type="password" placeholder="••••••••" value={signUpForm.password} onChange={handleSignUpChange("password")} className="input" required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">CONFIRM</label>
                    <input type="password" placeholder="••••••••" value={signUpForm.confirmPassword} onChange={handleSignUpChange("confirmPassword")} className="input" required />
                  </div>
                </div>
                <button className="btn" disabled={loading} type="submit">
                  {loading ? <span className="btn-loading"><span className="spinner" /> Creating account...</span> : <span>Create Account →</span>}
                </button>
                <button type="button" className="signup-ghost-btn" onClick={() => { setMode("login"); resetMessages(); }}>
                  Already have an account? Login →
                </button>
              </form>
            )}
          </div>
        </div>

        {/* scroll hint */}
        <div className="scroll-indicator">
          <span>SCROLL TO EXPLORE</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          INTELLIGENCE — feature grid
      ═══════════════════════════════════════════════ */}
      <section ref={intelligenceRef} className="intelligence-section">
        <div className="section-label-row">
          <div className="label-line" />
          <p className="section-label">ALL INTELLIGENCE MODULES</p>
          <div className="label-line" />
        </div>

        <p className="section-desc">
          A next-generation quantitative platform combining portfolio analytics, factor modeling,
          regime intelligence, derivatives insights, and real-time trading signals — all inside one unified intelligence layer.
        </p>

        <div className="feature-grid">
          {features.map((feature, index) => (
            <GlassCard
              key={feature.name}
              feature={feature}
              index={index}
              isSelected={selectedFeature?.name === feature.name}
              onClick={() => handleFeatureClick(feature)}
            />
          ))}
        </div>

        {selectedFeature ? (
          <div ref={detailPanelRef} className="feature-detail-panel">
            <div className="detail-left">
              <p className="detail-kicker">{selectedFeature.tag}</p>
              <h3>{selectedFeature.name}</h3>
              <p>{selectedFeature.what}</p>
            </div>
            <div className="detail-right">
              <div className="detail-box"><span>QUANT MODEL LOGIC</span><p>{selectedFeature.model}</p></div>
              <div className="detail-box"><span>WHY IT HELPS</span><p>{selectedFeature.why}</p></div>
              <div className="detail-box"><span>EXAMPLE USE CASE</span><p>{selectedFeature.example}</p></div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ═══════════════════════════════════════════════
          ABOUT
      ═══════════════════════════════════════════════ */}
      <section ref={aboutRef} className="about-section">
        <div className="about-inner">
          <p className="section-label about-label">ABOUT LIGHTNINBULL</p>
          <h2 className="about-title">Built for traders who want structure,<br />not noise.</h2>
          <p className="about-text">
            LightninBull is an AI-driven Quant Fund Manager platform built to bring institutional-style market intelligence to traders and investors.
            The platform combines factor models, regime detection, intraday signals, derivatives analytics, portfolio backtesting, and risk management into one unified dashboard.
          </p>
          <p className="growth-line">10K+ active users and rising.</p>
          <div className="about-stats">
            <div><span>10K+</span><p>Active Users</p></div>
            <div><span>16+</span><p>AI Modules</p></div>
            <div><span>Real-Time</span><p>Signal Engine</p></div>
            <div><span>Risk</span><p>Portfolio Analytics</p></div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════ */}
      <footer ref={contactRef} className="footer-strip" id="support">
        <div className="footer-top">
          <div>
            <span className="footer-logo">⚡ LIGHTNINBULL</span>
            <p className="footer-desc">Institutional Quant Intelligence for systematic trading, portfolio construction, and disciplined risk management.</p>
          </div>
          <div className="footer-links-wrap">
            <div className="footer-col">
              <h4>Social Links</h4>
              {socialLinks.map(link => (
                <a key={link.label} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
              ))}
            </div>
            <div className="footer-col">
              <h4>Contact Us</h4>
              <a href="mailto:support@lightninbull.com">Contact us</a>
              <a href="mailto:support@lightninbull.com">Help & Support</a>
              <a href="mailto:partners@lightninbull.com">Partner with us</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} LightninBull. Institutional Quant Intelligence. All rights reserved.</span>
          <button type="button" onClick={openSignUp}>Join LightninBull →</button>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════
          ALL STYLES
      ═══════════════════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');

        .auth-page, .auth-page * { box-sizing: border-box; }

        .auth-page {
          background: #030405;
          color: #fff;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .auth-page button { font: inherit; }

        /* ── VIDEO BG ── */
        .hero-section {
          position: relative;
          height: 100vh;
          min-height: 700px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Syne', sans-serif;
        }

        .bg-video {
          position: absolute;
          inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0.45;
        }

        .video-overlay {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 60% 50%, rgba(250,204,21,0.09), transparent 50%),
            linear-gradient(150deg, rgba(3,4,5,0.96) 0%, rgba(3,4,5,0.55) 50%, rgba(3,4,5,0.93) 100%);
          z-index: 1;
        }

        .noise-overlay {
          position: absolute; inset: 0; z-index: 2; opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px; pointer-events: none;
        }

        .ambient-orb { position: absolute; border-radius: 50%; pointer-events: none; z-index: 1; filter: blur(100px); }
        .orb-1 {
          width: 520px; height: 520px;
          background: radial-gradient(circle, rgba(250,204,21,0.13), transparent 70%);
          top: -80px; left: -100px;
          animation: orb1 14s ease-in-out infinite alternate;
        }
        .orb-2 {
          width: 380px; height: 380px;
          background: radial-gradient(circle, rgba(250,160,0,0.09), transparent 70%);
          bottom: 40px; right: -80px;
          animation: orb2 10s ease-in-out infinite alternate;
        }
        @keyframes orb1 { from{transform:translate(0,0)} to{transform:translate(50px,35px)} }
        @keyframes orb2 { from{transform:translate(0,0)} to{transform:translate(-35px,-25px)} }

        /* ── NAV ── */
        .top-nav {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 56px;
          border-bottom: 1px solid rgba(250,204,21,0.1);
          flex-shrink: 0;
        }

        .nav-logo {
          border: none; background: transparent;
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 4px;
          color: #fff; cursor: pointer;
        }
        .logo-bolt {
          color: #facc15; margin-right: 5px;
          filter: drop-shadow(0 0 8px rgba(250,204,21,0.9));
          animation: boltPulse 2.2s ease-in-out infinite alternate;
        }
        @keyframes boltPulse {
          from { filter: drop-shadow(0 0 5px rgba(250,204,21,0.7)); }
          to   { filter: drop-shadow(0 0 18px rgba(255,230,0,1)) drop-shadow(0 0 40px rgba(250,204,21,0.55)); }
        }
        .nav-links { display: flex; align-items: center; gap: 30px; }
        .nav-links button {
          border: none; background: transparent;
          font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 1.5px;
          color: rgba(255,255,255,0.45); cursor: pointer; text-transform: lowercase;
          transition: color 0.2s, text-shadow 0.2s;
        }
        .nav-links button:hover { color: #facc15; text-shadow: 0 0 14px rgba(250,204,21,0.65); }

        /* ── HERO BODY: two columns, fills remaining height ── */
        .hero-body {
          position: relative; z-index: 10;
          flex: 1;
          display: flex;
          align-items: stretch;
          padding: 0 56px;
          gap: 40px;
          overflow: hidden;
        }

        /* ── LEFT ── */
        .hero-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 28px 0 16px;
          min-width: 0;
        }

        .eyebrow-label {
          font-family: 'DM Mono', monospace; font-size: 9.5px; letter-spacing: 5px;
          color: #facc15; margin-bottom: 18px;
          text-shadow: 0 0 20px rgba(250,204,21,0.5);
        }

        .hero-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(52px, 5.8vw, 88px);
          font-weight: 300; line-height: 0.95;
          color: #f7f0df; letter-spacing: -2.2px; margin: 0;
        }

        .headline-gold {
          color: #f5d020; font-style: italic; font-weight: 300;
          text-shadow: 0 0 35px rgba(250,204,21,0.65), 0 0 90px rgba(250,204,21,0.28);
          animation: goldGlow 2.8s ease-in-out infinite alternate;
        }
        @keyframes goldGlow {
          from { text-shadow: 0 0 22px rgba(250,204,21,0.5), 0 0 60px rgba(250,204,21,0.2); }
          to   { text-shadow: 0 0 55px rgba(255,230,0,0.9), 0 0 120px rgba(250,204,21,0.45); }
        }

        .hero-subtext {
          margin-top: 14px;
          font-family: 'DM Mono', monospace; font-size: 12px; line-height: 1.8;
          color: rgba(255,255,255,0.48); letter-spacing: 0.3px;
        }

        /* STATS */
        .hero-stats {
          display: flex; align-items: stretch;
          margin-top: 20px;
          border: 1px solid rgba(250,204,21,0.18);
          max-width: 520px;
          background: rgba(3,4,5,0.55);
          backdrop-filter: blur(10px);
          box-shadow: 0 0 40px rgba(250,204,21,0.07);
        }
        .stat { padding: 16px 22px; display: flex; flex-direction: column; gap: 5px; min-width: 130px; }
        .stat-num {
          font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 400;
          color: #f7f0df; line-height: 1; text-transform: lowercase;
          text-shadow: 0 0 18px rgba(250,204,21,0.22);
        }
        .stat-label { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 3px; color: rgba(255,255,255,0.35); text-transform: uppercase; }
        .stat-divider { width: 1px; background: rgba(250,204,21,0.13); }

        /* QUANT BLOCK */
        .quant-block {
          display: flex;
          align-items: stretch;
          margin-top: 20px;
          max-width: 520px;
          border: 1px solid rgba(250,204,21,0.14);
          background: rgba(3,4,5,0.5);
          backdrop-filter: blur(10px);
          overflow: hidden;
        }
        .quant-accent-bar {
          width: 3px;
          flex-shrink: 0;
          background: linear-gradient(180deg, #facc15, rgba(250,204,21,0.3));
          box-shadow: 0 0 12px rgba(250,204,21,0.6);
          animation: barPulse 2.5s ease-in-out infinite alternate;
        }
        @keyframes barPulse {
          from { box-shadow: 0 0 8px rgba(250,204,21,0.4); }
          to   { box-shadow: 0 0 22px rgba(255,230,0,0.9), 0 0 40px rgba(250,204,21,0.35); }
        }
        .quant-inner { padding: 16px 20px; }
        .quant-label {
          font-family: 'DM Mono', monospace; font-size: 7.5px; letter-spacing: 4.5px;
          color: rgba(250,204,21,0.78); text-transform: uppercase;
          text-shadow: 0 0 14px rgba(250,204,21,0.4);
          display: block; margin-bottom: 8px;
        }
        .quant-heading {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(28px, 3.2vw, 46px); font-weight: 300;
          color: #f7f0df; letter-spacing: -0.8px; line-height: 1;
          margin: 0 0 7px;
        }
        .quant-ai {
          font-style: italic; color: #facc15; font-weight: 300;
          text-shadow: 0 0 30px rgba(250,204,21,0.65), 0 0 80px rgba(250,204,21,0.28);
          animation: quantAiGlow 2.5s ease-in-out infinite alternate;
        }
        @keyframes quantAiGlow {
          from { text-shadow: 0 0 18px rgba(250,204,21,0.5), 0 0 50px rgba(250,204,21,0.18); }
          to   { text-shadow: 0 0 45px rgba(255,230,0,0.9), 0 0 100px rgba(250,204,21,0.4); }
        }
        .quant-sub {
          font-family: 'DM Mono', monospace; font-size: 9.5px; letter-spacing: 1.2px;
          color: rgba(255,255,255,0.32); margin: 0;
        }

        /* ── RIGHT — LOGIN CARD ── */
        .login-card {
          position: relative; z-index: 10;
          width: 340px;
          flex-shrink: 0;
          align-self: center;
          padding: 20px 22px;
          border-radius: 4px;
          background: rgba(5,6,9,0.94);
          border: 1px solid rgba(250,204,21,0.22);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.02), 0 28px 56px rgba(0,0,0,0.7), 0 0 70px rgba(250,204,21,0.08);
          backdrop-filter: blur(22px);
        }
        .login-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #facc15, transparent);
          border-radius: 4px 4px 0 0;
          animation: cardTopGlow 3s ease-in-out infinite alternate;
        }
        @keyframes cardTopGlow {
          from { box-shadow: 0 0 8px rgba(250,204,21,0.45); opacity: 0.75; }
          to   { box-shadow: 0 0 26px rgba(255,230,0,1), 0 0 50px rgba(250,204,21,0.4); opacity: 1; }
        }

        .card-header { margin-bottom: 12px; }
        .card-logo { font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 800; letter-spacing: 4px; color: #facc15; text-shadow: 0 0 18px rgba(250,204,21,0.55); }
        .card-sub { margin-top: 6px; font-family: 'DM Mono', monospace; font-size: 9.5px; letter-spacing: 0.8px; color: rgba(255,255,255,0.34); text-transform: lowercase; }
        .card-divider { height: 1px; background: rgba(250,204,21,0.1); margin-bottom: 14px; }

        .login-form { display: flex; flex-direction: column; gap: 9px; }
        .signup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .input-group { display: flex; flex-direction: column; gap: 5px; }
        .input-label { font-family: 'DM Mono', monospace; font-size: 7.5px; letter-spacing: 3px; color: rgba(255,255,255,0.3); }

        .input {
          width: 100%; padding: 9px 11px; border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #fff; font-family: 'DM Mono', monospace; font-size: 11.5px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s; letter-spacing: 0.3px;
        }
        .input:focus { border-color: rgba(250,204,21,0.52); background: rgba(250,204,21,0.04); box-shadow: 0 0 16px rgba(250,204,21,0.16); }
        .input::placeholder { color: rgba(255,255,255,0.17); }

        .btn {
          width: 100%; padding: 11px; border-radius: 3px;
          background: linear-gradient(90deg, #facc15 0%, #f0b800 100%);
          border: none; font-family: 'Syne', sans-serif; font-weight: 800;
          font-size: 10.5px; letter-spacing: 3px; color: #050608; cursor: pointer;
          margin-top: 1px; position: relative; overflow: hidden; text-transform: uppercase;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 0 20px rgba(250,204,21,0.3), 0 4px 16px rgba(250,204,21,0.18);
        }
        .btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transform: translateX(-100%); transition: transform 0.5s ease;
        }
        .btn:hover::after { transform: translateX(100%); }
        .btn:hover { opacity: 0.93; transform: translateY(-1px); box-shadow: 0 0 44px rgba(255,220,0,0.5), 0 6px 28px rgba(250,204,21,0.28); }
        .btn:disabled { opacity: 0.6; cursor: default; transform: none; }
        .btn-loading { display: flex; align-items: center; justify-content: center; gap: 9px; }
        .spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(5,6,8,0.3); border-top-color: #050608; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }

        .signup-ghost-btn {
          width: 100%; padding: 9px; border-radius: 3px;
          background: transparent; border: 1px solid rgba(250,204,21,0.24); color: #facc15;
          font-family: 'DM Mono', monospace; font-size: 7.5px; letter-spacing: 2px;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .signup-ghost-btn:hover { background: rgba(250,204,21,0.07); border-color: rgba(250,204,21,0.54); transform: translateY(-1px); }

        .forgot-link { text-align: center; font-family: 'DM Mono', monospace; font-size: 9.5px; color: rgba(255,255,255,0.24); letter-spacing: 0.4px; margin: 0; }
        .forgot-link a { color: rgba(250,204,21,0.68); text-decoration: none; }
        .forgot-link a:hover { color: #facc15; }

        .auth-alert { margin-bottom: 10px; padding: 9px 11px; border-radius: 3px; font-family: 'DM Mono', monospace; font-size: 9.5px; line-height: 1.55; }
        .auth-alert.error { background: rgba(220,38,38,0.14); border: 1px solid rgba(248,113,113,0.35); color: #fecaca; }
        .auth-alert.success { background: rgba(22,163,74,0.14); border: 1px solid rgba(74,222,128,0.35); color: #bbf7d0; }

        /* SCROLL HINT */
        .scroll-indicator {
          position: relative; z-index: 10; flex-shrink: 0;
          display: flex; align-items: center; gap: 16px;
          padding: 10px 56px 14px;
          font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 5px; color: rgba(255,255,255,0.22);
        }
        .scroll-line {
          flex: 1; max-width: 70px; height: 1px;
          background: linear-gradient(90deg, rgba(250,204,21,0.6), transparent);
          animation: scrollPulse 2s ease-in-out infinite;
        }
        @keyframes scrollPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

        /* ── INTELLIGENCE SECTION ── */
        .intelligence-section {
          padding: 90px 56px 130px;
          font-family: 'Syne', sans-serif;
          background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(250,204,21,0.07), transparent 70%), #030405;
          perspective: 1200px;
        }

        .section-label-row { display: flex; align-items: center; gap: 22px; margin-bottom: 36px; }
        .label-line { flex: 1; height: 1px; background: rgba(250,204,21,0.11); }
        .section-label {
          font-family: 'DM Mono', monospace; font-size: 8.5px; letter-spacing: 5px;
          color: rgba(250,204,21,0.85); white-space: nowrap; text-transform: uppercase;
          text-shadow: 0 0 16px rgba(250,204,21,0.42);
        }

        .section-desc {
          max-width: 740px; margin: 0 auto 60px;
          font-family: 'DM Mono', monospace; font-size: 12.5px; line-height: 2;
          color: rgba(255,255,255,0.42); text-align: center;
        }

        /* ── 3D GLASS FEATURE GRID ── */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          perspective: 1200px;
        }

        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

        /* Glass card wrapper — holds 3D transform */
        .feature-card {
          position: relative;
          text-align: left;
          padding: 28px 24px 24px;
          border-radius: 12px;
          cursor: pointer;
          border: none;
          color: inherit;
          animation: fadeUp 0.5s ease both;
          min-height: 230px;
          transform-style: preserve-3d;
          transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;

          /* Glass morphism */
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.055) 0%,
            rgba(255,255,255,0.02) 50%,
            rgba(250,204,21,0.025) 100%
          );
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow:
            0 4px 24px rgba(0,0,0,0.55),
            0 1px 0 rgba(255,255,255,0.07) inset,
            0 -1px 0 rgba(0,0,0,0.3) inset;
          overflow: hidden;
        }

        /* Glass shine layer */
        .feature-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 40%;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.07) 0%,
            transparent 100%
          );
          border-radius: 12px 12px 0 0;
          pointer-events: none;
        }

        /* Hover: lift slightly, glow edge */
        .feature-card:hover {
          transform: translateY(-4px) scale(1.012);
          border-color: rgba(250,204,21,0.3);
          box-shadow:
            0 12px 40px rgba(0,0,0,0.6),
            0 0 30px rgba(250,204,21,0.12),
            0 1px 0 rgba(255,255,255,0.1) inset,
            0 -1px 0 rgba(0,0,0,0.3) inset;
        }

        /* Selected: push BACK (recede into screen) with gold glow burst */
        .feature-card.selected {
          animation: cardPush 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
          border-color: rgba(250,204,21,0.65);
          background: linear-gradient(
            135deg,
            rgba(250,204,21,0.09) 0%,
            rgba(255,255,255,0.03) 50%,
            rgba(250,204,21,0.05) 100%
          );
          box-shadow:
            0 2px 10px rgba(0,0,0,0.75),
            0 0 55px rgba(250,204,21,0.25),
            0 0 110px rgba(250,204,21,0.1),
            0 1px 0 rgba(255,255,255,0.09) inset;
        }

        @keyframes cardPush {
          0%   { transform: scale(1) translateZ(0) rotateX(0deg); }
          25%  { transform: scale(0.9) translateZ(-65px) rotateX(7deg); }
          55%  { transform: scale(0.92) translateZ(-46px) rotateX(5deg); }
          100% { transform: scale(0.93) translateZ(-40px) rotateX(4deg); }
        }

        /* Thunder sweep line on hover/selected */
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: -110%; width: 100%; height: 2px;
          border-radius: 12px 12px 0 0;
          background: linear-gradient(90deg,
            transparent,
            rgba(250,204,21,0.8),
            rgba(255,248,120,1),
            rgba(250,204,21,0.8),
            transparent
          );
          box-shadow: 0 0 14px rgba(250,204,21,0.9), 0 0 32px rgba(250,204,21,0.45);
          opacity: 0;
          z-index: 3;
        }
        .feature-card:hover::before, .feature-card.selected::before {
          opacity: 1;
          animation: thunderSweep 0.52s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        @keyframes thunderSweep { from{left:-110%} to{left:110%} }

        .feature-topline {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px; position: relative; z-index: 2;
        }
        .card-icon {
          font-size: 18px; color: rgba(250,204,21,0.62);
          transition: color 0.3s, filter 0.3s, transform 0.3s;
        }
        .feature-tag {
          font-family: 'DM Mono', monospace; font-size: 7.5px; letter-spacing: 2.5px;
          color: rgba(255,255,255,0.3);
        }
        .feature-card:hover .card-icon {
          color: #facc15;
          filter: drop-shadow(0 0 9px rgba(250,204,21,1)) drop-shadow(0 0 22px rgba(250,204,21,0.55));
          transform: scale(1.15);
        }
        .feature-card.selected .card-icon {
          color: #facc15;
          filter: drop-shadow(0 0 14px rgba(250,204,21,1)) drop-shadow(0 0 36px rgba(250,204,21,0.7));
        }

        /* Title gold thunder sweep */
        .card-title {
          font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 400;
          color: #f7f0df; margin: 0 0 12px; line-height: 1.05; letter-spacing: -0.3px;
          position: relative; z-index: 2;
        }
        .title-thunder {
          display: inline-block;
          background: linear-gradient(90deg, #f7f0df, #f7f0df);
          background-clip: text; -webkit-background-clip: text; color: transparent;
        }
        .feature-card:hover .title-thunder, .feature-card.selected .title-thunder {
          background: linear-gradient(
            100deg,
            #c8b87a 0%, #f7f0df 28%, #facc15 47%,
            #fff8a0 50%, #facc15 53%, #f7f0df 72%, #c8b87a 100%
          );
          background-size: 250% 100%;
          background-clip: text; -webkit-background-clip: text; color: transparent;
          animation: titleThunder 0.6s ease forwards;
          filter: drop-shadow(0 0 7px rgba(250,204,21,0.5));
        }
        @keyframes titleThunder {
          from { background-position: 200% center; }
          to   { background-position: -50% center; }
        }

        .card-desc {
          font-family: 'DM Mono', monospace; font-size: 10.5px; line-height: 1.7;
          color: rgba(255,255,255,0.38); margin: 0; position: relative; z-index: 2;
        }
        .feature-action {
          display: inline-block; margin-top: 16px;
          font-family: 'DM Mono', monospace; font-size: 8.5px; letter-spacing: 2px;
          color: rgba(250,204,21,0.68); position: relative; z-index: 2;
          transition: color 0.2s, text-shadow 0.2s;
        }
        .feature-card:hover .feature-action, .feature-card.selected .feature-action {
          color: #facc15; text-shadow: 0 0 12px rgba(250,204,21,0.65);
        }
        .card-corner {
          position: absolute; bottom: 15px; right: 15px;
          width: 16px; height: 16px;
          border-right: 1px solid rgba(250,204,21,0.3);
          border-bottom: 1px solid rgba(250,204,21,0.3);
          z-index: 2; border-radius: 0 0 4px 0;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .feature-card:hover .card-corner, .feature-card.selected .card-corner {
          border-color: rgba(250,204,21,0.75);
          box-shadow: 3px 3px 10px rgba(250,204,21,0.25);
        }

        /* ── GLASS DETAIL PANEL — pops up below selected row ── */
        .feature-detail-panel {
          margin-top: 6px;
          border-radius: 14px;
          border: 1px solid rgba(250,204,21,0.25);

          /* Glass morphism matching cards */
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.06) 0%,
            rgba(255,255,255,0.02) 40%,
            rgba(250,204,21,0.04) 100%
          );
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);

          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: 40px;
          padding: 38px;

          box-shadow:
            0 8px 48px rgba(0,0,0,0.65),
            0 0 80px rgba(250,204,21,0.1),
            0 1px 0 rgba(255,255,255,0.08) inset,
            0 -1px 0 rgba(0,0,0,0.25) inset;

          /* Pop-up animation — rises from below */
          animation: panelPop 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both;
          position: relative;
          overflow: hidden;
        }

        /* Glass shine on detail panel top */
        .feature-detail-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 35%;
          background: linear-gradient(180deg, rgba(255,255,255,0.06), transparent);
          border-radius: 14px 14px 0 0;
          pointer-events: none;
        }

        /* Gold accent line at top of panel */
        .feature-detail-panel::after {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%; height: 1.5px;
          background: linear-gradient(90deg, transparent, rgba(250,204,21,0.7), rgba(255,248,100,1), rgba(250,204,21,0.7), transparent);
          box-shadow: 0 0 20px rgba(250,204,21,0.6), 0 0 50px rgba(250,204,21,0.3);
          border-radius: 0;
        }

        @keyframes panelPop {
          from {
            opacity: 0;
            transform: translateY(24px) scaleY(0.92);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scaleY(1);
            filter: blur(0);
          }
        }

        .detail-kicker {
          font-family: 'DM Mono', monospace; font-size: 8.5px; letter-spacing: 4px;
          color: #facc15; margin: 0 0 16px;
          text-shadow: 0 0 16px rgba(250,204,21,0.55);
        }
        .detail-left h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(36px, 3.8vw, 56px); font-weight: 300;
          color: #f7f0df; line-height: 0.95; margin: 0 0 20px; letter-spacing: -0.8px;
        }
        .detail-left p {
          font-family: 'DM Mono', monospace; font-size: 12px; line-height: 1.9;
          color: rgba(255,255,255,0.46); margin: 0;
        }
        .detail-right { display: grid; gap: 14px; }
        .detail-box {
          border-left: 2px solid rgba(250,204,21,0.38);
          padding: 16px 0 16px 20px;
          background: rgba(255,255,255,0.02);
          border-radius: 0 6px 6px 0;
        }
        .detail-box span {
          display: block; font-family: 'DM Mono', monospace; font-size: 7.5px;
          letter-spacing: 3px; color: rgba(250,204,21,0.9); margin-bottom: 9px;
          text-shadow: 0 0 12px rgba(250,204,21,0.45);
        }
        .detail-box p {
          font-family: 'DM Mono', monospace; font-size: 11.5px; line-height: 1.82;
          color: rgba(255,255,255,0.46); margin: 0;
        }

        /* ── ABOUT ── */
        .about-section { padding: 110px 56px; background: radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.07), transparent 70%), #050608; font-family: 'Syne', sans-serif; }
        .about-inner { max-width: 1180px; margin: 0 auto; }
        .about-label { text-align: center; display: block; margin-bottom: 30px; }
        .about-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(44px, 5vw, 76px); font-weight: 300; line-height: 0.98; letter-spacing: -1.5px; color: #f7f0df; text-align: center; margin: 0; }
        .about-text { max-width: 800px; margin: 32px auto 0; text-align: center; font-family: 'DM Mono', monospace; font-size: 12.5px; line-height: 2; color: rgba(255,255,255,0.43); }
        .growth-line { margin: 36px 0 46px; text-align: center; font-family: 'Cormorant Garamond', serif; font-size: clamp(30px, 3.8vw, 52px); font-style: italic; color: #facc15; text-shadow: 0 0 60px rgba(250,204,21,0.24); }
        .about-stats { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid rgba(250,204,21,0.1); background: rgba(250,204,21,0.02); }
        .about-stats div { padding: 26px 22px; border-right: 1px solid rgba(250,204,21,0.08); }
        .about-stats div:last-child { border-right: none; }
        .about-stats span { display: block; font-family: 'Cormorant Garamond', serif; font-size: 32px; color: #f7f0df; margin-bottom: 7px; }
        .about-stats p { margin: 0; font-family: 'DM Mono', monospace; font-size: 8.5px; letter-spacing: 2.4px; color: rgba(255,255,255,0.34); text-transform: uppercase; }

        /* ── FOOTER ── */
        .footer-strip { padding: 60px 56px 30px; background: #030405; border-top: 1px solid rgba(250,204,21,0.1); font-family: 'Syne', sans-serif; }
        .footer-top { display: flex; justify-content: space-between; gap: 56px; max-width: 1180px; margin: 0 auto 48px; }
        .footer-logo { display: block; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 4px; color: #f7f0df; margin-bottom: 18px; }
        .footer-desc { max-width: 460px; font-family: 'DM Mono', monospace; font-size: 11.5px; line-height: 1.9; color: rgba(255,255,255,0.35); margin: 0; }
        .footer-links-wrap { display: flex; gap: 66px; }
        .footer-col { display: flex; flex-direction: column; gap: 11px; min-width: 140px; }
        .footer-col h4 { font-family: 'DM Mono', monospace; font-size: 8.5px; letter-spacing: 3px; color: #facc15; text-transform: uppercase; margin: 0 0 7px; text-shadow: 0 0 12px rgba(250,204,21,0.4); }
        .footer-col a { font-family: 'DM Mono', monospace; font-size: 10.5px; color: rgba(255,255,255,0.37); text-decoration: none; transition: color 0.2s, text-shadow 0.2s; }
        .footer-col a:hover { color: #facc15; text-shadow: 0 0 12px rgba(250,204,21,0.6); }
        .footer-bottom { max-width: 1180px; margin: 0 auto; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; gap: 22px; }
        .footer-bottom span { font-family: 'DM Mono', monospace; font-size: 9.5px; color: rgba(255,255,255,0.26); letter-spacing: 0.8px; }
        .footer-bottom button { border: 1px solid rgba(250,204,21,0.3); background: rgba(250,204,21,0.05); color: #facc15; font-family: 'DM Mono', monospace; font-size: 8.5px; letter-spacing: 2.5px; text-transform: uppercase; padding: 11px 16px; border-radius: 3px; cursor: pointer; transition: all 0.2s; }
        .footer-bottom button:hover { background: rgba(250,204,21,0.11); box-shadow: 0 0 22px rgba(250,204,21,0.2); }

        /* ── RESPONSIVE ── */
        @media (max-width: 1200px) {
          .feature-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .hero-headline { font-size: clamp(48px, 5.5vw, 76px); }
        }
        @media (max-width: 980px) {
          .top-nav { padding: 18px 24px; }
          .nav-links { gap: 14px; flex-wrap: wrap; }
          .hero-body { flex-direction: column; padding: 20px 24px 10px; gap: 24px; overflow-y: auto; }
          .hero-section { height: auto; min-height: 100vh; }
          .hero-left { padding: 16px 0 0; }
          .login-card { width: 100%; max-width: 420px; align-self: flex-start; }
          .hero-stats, .quant-block { max-width: 100%; }
          .feature-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .feature-detail-panel { grid-template-columns: 1fr; }
          .about-stats { grid-template-columns: repeat(2, 1fr); }
          .about-stats div:nth-child(2) { border-right: none; }
          .about-stats div:nth-child(1), .about-stats div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .footer-top { flex-direction: column; }
          .scroll-indicator { padding: 10px 24px 14px; }
        }
        @media (max-width: 640px) {
          .top-nav { flex-direction: column; padding: 16px 20px; gap: 14px; }
          .nav-links { justify-content: flex-start; }
          .hero-body { padding: 16px 20px 8px; }
          .hero-headline { font-size: clamp(40px, 12vw, 58px); letter-spacing: -1.3px; }
          .hero-stats { flex-direction: column; }
          .stat-divider { width: 100%; height: 1px; }
          .quant-heading { font-size: clamp(24px, 8vw, 36px); }
          .login-card { padding: 18px 18px; }
          .signup-grid { grid-template-columns: 1fr; }
          .intelligence-section, .about-section, .footer-strip { padding-left: 20px; padding-right: 20px; }
          .section-label { white-space: normal; text-align: center; line-height: 1.6; }
          .feature-grid { grid-template-columns: 1fr; gap: 12px; }
          .feature-detail-panel { padding: 24px; grid-template-columns: 1fr; }
          .about-stats { grid-template-columns: 1fr; }
          .about-stats div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.08); }
          .about-stats div:last-child { border-bottom: none; }
          .footer-links-wrap { flex-direction: column; gap: 30px; }
          .footer-bottom { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
};

export default Auth;
