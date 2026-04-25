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
    model:
      "The Watchlist operates as an execution-ready monitoring layer that receives curated outputs from momentum, regime, value, quality, range-bound, options, and intraday signal models. It applies systematic filtering rules to reduce the tradeable universe from thousands of stocks to a focused, signal-backed shortlist. Each entry in the watchlist is tagged by strategy type, signal strength, and model source so the trader always knows why a stock is being tracked.",
    why:
      "Manual market scanning introduces cognitive overload, confirmation bias, and missed opportunities. The Watchlist removes decision noise by ensuring only model-validated ideas enter the trader's field of attention. It enforces discipline by separating the stock selection process from the execution process, which is a critical distinction in systematic trading.",
    example:
      "Before market open, a trader populates the Watchlist with Consistent Trending momentum names, Regime Upside stocks, and Intraday Bull Call Spread signals. During market hours, monitoring is restricted to this filtered list, avoiding impulsive trades on stocks outside the systematic framework.",
  },
  {
    name: "Portfolio Backtest",
    icon: "◉",
    tag: "TEST",
    what: "Portfolio Backtest allows users to rigorously test how a strategy or stock basket would have performed historically across different market environments before committing real capital.",
    model:
      "The backtest engine evaluates portfolio-level metrics including annualised returns, calendar-year performance breakdown, maximum drawdown, volatility, Sharpe ratio, Sortino ratio, portfolio turnover, and hit rate. It supports equal-weight allocation and mean-variance optimisation (MVO) to compare risk-adjusted outcomes. The engine segments performance across bull, bear, sideways, high-volatility, and low-volatility regimes to stress-test strategy behaviour.",
    why:
      "A strategy that performs well in recent markets may be a product of regime luck rather than structural edge. Backtesting across multiple market cycles provides statistical evidence of whether a strategy has genuine alpha, acceptable drawdown characteristics, and consistent behaviour across varying conditions. It prevents the common mistake of deploying untested capital based on short-term recency bias.",
    example:
      "A trader builds a 20-stock momentum portfolio with monthly rebalancing. The backtest compares equal-weight allocation versus MVO across the last five years, revealing that MVO reduced maximum drawdown by 18% while maintaining comparable annualised returns, making it the preferred construction method.",
  },
  {
    name: "Consistent Trending",
    icon: "◆",
    tag: "MOMENTUM",
    what: "Consistent Trending is a quant momentum model that identifies stocks showing persistent and stable price strength across multiple lookback windows, filtering for repeatable trend behaviour rather than short-lived spikes.",
    model:
      "The model evaluates price momentum across short, medium, and longer lookback periods simultaneously and scores stocks on the consistency of their outperformance across all windows. It penalises stocks with erratic momentum — strong in one period but weak in another — and rewards names where trend participation is smooth, drawdowns are controlled, and upside continuation is statistically persistent. This multi-window consistency score forms the primary ranking factor.",
    why:
      "Single-period momentum strategies are susceptible to mean reversion after sharp one-directional moves. By requiring consistency across multiple timeframes, this model selects stocks where price strength is structural rather than episodic. This improves the probability of trend continuation post-entry and reduces exposure to false breakouts driven by noise or temporary sector rotations.",
    example:
      "A stock that ranks in the top decile of 1-month, 3-month, and 6-month momentum simultaneously, shows controlled retracements below 8%, and has participated in the last four consecutive market upswings qualifies as a Consistent Trending candidate suitable for a momentum portfolio allocation.",
  },
  {
    name: "Slow Movement",
    icon: "◇",
    tag: "STABILITY",
    what: "Slow Movement identifies stocks that exhibit gradual, low-volatility directional drift with controlled intraday behaviour, minimal gap risk, and stable trend participation over extended periods.",
    model:
      "The model filters for low realised volatility, smooth intraday candle structure, absence of erratic gaps, and consistent directional drift. It ranks stocks by the ratio of directional price change to total price movement — a high ratio indicates efficient, low-noise trending. Stocks with frequent whipsaws, wide daily ranges relative to trend progress, or unstable beta are systematically excluded.",
    why:
      "For conservative portfolios and long-term compounders, low-volatility stable trends are preferable to aggressive momentum because they produce smoother NAV curves, lower drawdown depth, and reduced behavioural pressure to exit positions prematurely. Slow Movement names also tend to have better Sharpe ratios over long holding periods compared to high-beta momentum stocks.",
    example:
      "A defensive sector stock rising 18% over 12 weeks with daily moves averaging 0.4%, no gaps above 1%, and consistent buying volume qualifies as a Slow Movement candidate suitable for a low-volatility income or retirement portfolio sleeve.",
  },
  {
    name: "Cheap Value",
    icon: "◐",
    tag: "VALUE",
    what: "Cheap Value identifies stocks that appear undervalued relative to their fundamental and price-based characteristics while also showing early signs of market recognition or structural improvement.",
    model:
      "The model blends valuation-style ranking with price trend confirmation. It screens for stocks trading at relative discounts across multiple valuation dimensions and then applies a price-based filter to identify names where the market is beginning to recognise the mispricing. This dual-confirmation approach avoids the classic value trap where cheap stocks remain cheap indefinitely without a catalyst for re-rating.",
    why:
      "Pure statistical value screens frequently identify distressed or structurally impaired businesses that deserve their low valuations. Adding price-based confirmation ensures the model selects value stocks where an actual re-rating process has begun. This improves timing precision and distinguishes genuine value opportunities from permanent impairments masquerading as cheap stocks.",
    example:
      "A stock trading at a significant discount to its sector peers on price-to-earnings and price-to-book metrics, while also showing improving price structure and rising relative strength over the past six weeks, enters the Cheap Value bucket as a candidate for a value-plus-momentum blended strategy.",
  },
  {
    name: "Best Quality",
    icon: "◑",
    tag: "QUALITY",
    what: "Best Quality filters for companies exhibiting superior stability, cleaner market behaviour, lower return volatility, and more predictable trend structure relative to the broader market universe.",
    model:
      "The model evaluates stocks on a composite quality score that rewards consistency of price behaviour, lower beta to index movements, stable relative performance across multiple market regimes, and absence of structural weakness signals. It acts as a pre-filter for portfolio construction by establishing a clean, higher-quality sub-universe before applying momentum, value, or other factor overlays.",
    why:
      "Lower-quality stocks — characterised by high volatility, unstable trends, and weak survivability across regimes — can appear attractive in isolation but dilute portfolio-level risk-adjusted returns when included in factor strategies. Quality filtering at the universe level is one of the most effective ways to improve the overall robustness of a systematic strategy without sacrificing return potential.",
    example:
      "Before constructing a long-only momentum portfolio, a portfolio manager applies the Best Quality filter to reduce the universe from 500 stocks to the top 150 by quality score. This pre-filtered universe is then ranked by momentum, producing a final 20-stock portfolio with significantly lower historical drawdown than an unfiltered momentum approach.",
  },
  {
    name: "Regime Upside",
    icon: "▲",
    tag: "RISK-ON",
    what: "Regime Upside identifies stocks with the highest beta to positive market regimes — stocks that participate most strongly when index trend, market breadth, and risk appetite are collectively supportive.",
    model:
      "The model analyses each stock's historical return behaviour during bullish market regime periods — defined by index uptrend, expanding breadth, positive sector rotation, and improving risk sentiment. It scores stocks by their average excess return, consistency of outperformance, and drawdown behaviour specifically during these regime windows, identifying names that reliably amplify upside when conditions are favourable.",
    why:
      "Not all stocks participate equally in bull phases. Some structurally underperform even during strong markets due to sector positioning, factor headwinds, or poor earnings momentum. Regime Upside ensures long exposures are concentrated in stocks with the highest probability of capturing the current upside move, improving the efficiency of risk deployment in favourable market environments.",
    example:
      "When Nifty 50 is in a confirmed uptrend with breadth above 65% and FII flows are net positive, Regime Upside highlights high-beta, high-participation names in sectors aligned with the current rotation, enabling the trader to concentrate long exposure where the risk-reward is most asymmetric.",
  },
  {
    name: "Regime Downside",
    icon: "▼",
    tag: "RISK-OFF",
    what: "Regime Downside identifies stocks that become most vulnerable and underperform most severely when market conditions shift to a bearish, risk-off, or high-volatility regime.",
    model:
      "The model examines each stock's historical behaviour during negative regime periods — characterised by index downtrends, contracting breadth, rising VIX, and risk-off sector rotation. It identifies stocks with persistently elevated downside beta, weak recovery behaviour after market bounces, and tendency to lead market declines. These names are ranked by their regime-specific weakness score.",
    why:
      "During risk-off regimes, holding weak names causes disproportionate portfolio damage because they fall faster and recover slower than the index. Regime Downside helps traders identify which positions to exit, hedge, or short during unfavourable market environments. It also supports building a systematic short book by targeting structurally weak stocks with the highest downside participation probability.",
    example:
      "When Nifty 50 breaks below its 50-day moving average with breadth below 35% and FII selling accelerates, Regime Downside highlights the stocks most likely to fall 20-40% from current levels, enabling defensive repositioning or short-side trade construction before the broader market fully prices the risk.",
  },
  {
    name: "Range Bound Upside",
    icon: "◭",
    tag: "RANGE",
    what: "Range Bound Upside identifies stocks trading within a defined price range but exhibiting upside pressure near support zones, showing accumulation behaviour and breakout readiness characteristics.",
    model:
      "The model detects sideways consolidation structures where buyers are repeatedly defending lower price levels. It analyses support strength, volume behaviour at range lows, compression of volatility, upside pressure indicators, and breadth of accumulation to score stocks by their breakout probability and potential magnitude. It specifically avoids selecting range-bound stocks where the upside pressure is weak or where distribution patterns dominate.",
    why:
      "The highest-risk-reward entries often occur before a trend becomes fully visible. By identifying accumulation inside a range before the breakout is obvious, traders can enter at lower prices with defined risk relative to the range support. This early positioning provides a better reward-to-risk ratio than chasing stocks after they have already broken out and attracted widespread attention.",
    example:
      "A large-cap stock consolidating between 1,200 and 1,380 for 14 weeks, repeatedly bouncing from 1,210 with increasing volume at each touch of support and narrowing price swings, enters Range Bound Upside as a pre-breakout accumulation candidate with defined risk at the range low.",
  },
  {
    name: "Range Bound Downside",
    icon: "◮",
    tag: "RANGE",
    what: "Range Bound Downside identifies stocks in sideways consolidation that are exhibiting distribution behaviour, repeated rejection at resistance, and increasing downside pressure suggesting an impending breakdown.",
    model:
      "The model detects distribution-like structures within consolidation ranges — repeated failures at resistance, weak recovery attempts after each bounce, declining volume on upside moves and increasing volume on downside moves, and compression of price action near the lower boundary of the range. It ranks stocks by the strength of bearish pressure and breakdown probability within the range structure.",
    why:
      "Waiting for a confirmed breakdown before entering bearish trades often means missing a significant portion of the move. By identifying distribution behaviour inside a range before the breakdown is confirmed, traders can position in advance with defined risk relative to the resistance level, improving entry quality and potential reward-to-risk significantly.",
    example:
      "A mid-cap stock oscillating between 540 and 620, failing at 615 on each attempt with declining volume and showing progressively weaker bounces from 545, enters Range Bound Downside as a pre-breakdown distribution candidate with defined risk at the range high.",
  },
  {
    name: "Aggressive Call Option Stocks",
    icon: "⬡",
    tag: "OPTIONS",
    what: "Aggressive Call Option Stocks identifies underlying stocks where directional strength, volatility expansion, and breakout behaviour combine to create high-probability bullish option trade setups.",
    model:
      "The model filters for stocks exhibiting strong upside momentum, expanding realised volatility relative to implied volatility, breakout confirmation from key technical levels, high options open interest in call strikes, and premium expansion behaviour that supports bullish option strategies. It prioritises underlyings where the directional move is likely to be large enough to overcome time decay and justify an aggressive options structure.",
    why:
      "Randomly buying call options on momentum stocks without underlying model confirmation leads to high loss rates due to time decay, IV crush post-event, and poor entry timing. This model ensures that bullish options trades are placed only on stocks where the underlying price structure, volatility dynamics, and breakout characteristics collectively support premium expansion and directional conviction.",
    example:
      "A stock breaking out of a 10-week base with 3x average volume, expanding ATR, rising open interest in near-month calls, and sector tailwinds enters the Aggressive Call Option bucket as a candidate for an ATM or slightly OTM call with 3-4 week expiry.",
  },
  {
    name: "Aggressive Put Option Stocks",
    icon: "⬢",
    tag: "OPTIONS",
    what: "Aggressive Put Option Stocks identifies underlying stocks where structural weakness, volatility expansion, and breakdown behaviour create high-probability bearish option trade setups.",
    model:
      "The model filters for stocks with confirmed bearish momentum, breakdown from key support levels, rising realised volatility, elevated put open interest, and premium expansion behaviour consistent with bearish option strategies. It avoids stocks where volatility is already extremely elevated — reducing the risk of entering bearish options into already-priced disasters — and focuses on early-stage breakdowns where premium has not yet been fully priced.",
    why:
      "Buying puts on randomly weak stocks fails because elevated implied volatility often already prices the expected move, and any stabilisation causes rapid premium erosion. This model identifies situations where the underlying breakdown is structural, volatility expansion is in its early phase, and the risk-reward for put holders is asymmetric before the broader market fully recognises the weakness.",
    example:
      "A stock breaking below a 6-month support level with increasing sell volume, rising put OI in near-month strikes, and a weakening sector backdrop enters the Aggressive Put Option bucket as a candidate for an ATM put position ahead of continued downside.",
  },
  {
    name: "Intraday Bull Call Spreads",
    icon: "◈",
    tag: "INTRADAY",
    what: "Intraday Bull Call Spreads identifies defined-risk, limited-capital bullish options spread opportunities during market hours, combining index direction confirmation with stock-level upside momentum.",
    model:
      "The model integrates intraday index trend confirmation, real-time breadth data, sector rotation signals, and stock-level upside momentum to identify bull call spread candidates. It evaluates optimal strike selection based on premium-to-risk ratios, near-expiry time decay characteristics, and intraday support levels that define stop discipline for spread holders. The model targets structures with a reward-to-risk of at least 2:1 at expiry.",
    why:
      "Naked call buying exposes traders to full premium loss on any adverse move. A bull call spread reduces the capital at risk while maintaining meaningful directional exposure in a confirmed upside environment. This structure is particularly effective for intraday traders who want to participate in momentum moves without carrying unlimited time decay risk or excessive notional exposure.",
    example:
      "When Nifty confirms intraday upside above a key resistance with improving breadth and a specific stock shows a clean bull flag on the 15-minute chart, the model identifies a bull call spread — buy the ATM call and sell the next OTM strike — as a defined-risk trade with a 2.5:1 reward-to-risk profile.",
  },
  {
    name: "Intraday Bear Put Spreads",
    icon: "◇",
    tag: "INTRADAY",
    what: "Intraday Bear Put Spreads identifies defined-risk, limited-capital bearish options spread opportunities during market hours, combining index weakness confirmation with stock-level downside momentum.",
    model:
      "The model combines intraday index downtrend signals, contracting breadth, sector weakness data, and stock-level bearish momentum to identify bear put spread candidates. It analyses premium-to-risk ratios for put spread structures, optimal strike spacing given current implied volatility levels, intraday resistance levels that define stop logic, and expiry selection to balance time decay against anticipated move duration.",
    why:
      "Bear put spreads allow traders to express high-conviction bearish intraday views with precisely defined maximum loss. Unlike naked put buying — where full premium loss occurs on any bounce — the spread structure converts time value into a defined cost of trade. This is critical during intraday sessions where unexpected reversals can rapidly erode option premium.",
    example:
      "When BankNifty breaks intraday support with declining breadth and a banking sector stock shows a confirmed distribution breakdown on the 15-minute chart, the model constructs a bear put spread with defined risk, targeting a 2:1 to 3:1 reward-to-risk outcome by end of session.",
  },
  {
    name: "Upside Trend Stocks",
    icon: "◆",
    tag: "LIVE",
    what: "Upside Trend Stocks delivers a real-time feed of stocks exhibiting confirmed intraday upside momentum, allowing traders to monitor active long opportunities without manual market scanning.",
    model:
      "The model processes live price feeds, intraday trend direction, momentum persistence indicators, volume confirmation, and relative strength versus the index to identify stocks where upside momentum is structurally active rather than a temporary spike. It filters out noise by requiring multiple confirmation factors — trend direction, volume support, and momentum persistence — before flagging a stock as an active Upside Trend candidate.",
    why:
      "Manual intraday scanning of hundreds of stocks is operationally impossible and introduces significant selection bias. Upside Trend Stocks eliminates this problem by delivering a systematically filtered live list of stocks where upside momentum is confirmed in real time. This allows traders to focus entirely on execution and risk management rather than scanning.",
    example:
      "During market hours, a stock breaking above its intraday range high with 2x average volume and positive relative strength versus Nifty appears in the Upside Trend Stocks panel. The trader monitors it for a pullback entry or momentum continuation trade without needing to scan the full market.",
  },
  {
    name: "Downside Trend Stocks",
    icon: "◉",
    tag: "LIVE",
    what: "Downside Trend Stocks delivers a real-time feed of stocks exhibiting confirmed intraday downside momentum, enabling traders to monitor active short or defensive opportunities without manual scanning.",
    model:
      "The model processes live price behaviour, intraday breakdown confirmations, selling volume characteristics, momentum decay indicators, and relative weakness versus the index to identify stocks where bearish momentum is structurally active. It distinguishes between brief intraday dips and confirmed downside trend continuations by requiring multiple signal confirmations before inclusion in the live panel.",
    why:
      "Identifying genuine intraday weakness in real time versus false breakdowns driven by temporary selling pressure requires systematic signal confirmation. Downside Trend Stocks removes this ambiguity by presenting only stocks where bearish momentum is multi-factor confirmed. This helps traders avoid shorting temporary dips while capturing genuine intraday breakdown opportunities.",
    example:
      "A stock breaking intraday support with rising sell volume, negative relative strength versus BankNifty, and a confirmed downside trend on multiple timeframes appears in the Downside Trend Stocks panel. The trader uses this as a signal to exit existing longs in that name or construct a short-side position with defined risk.",
  },
];

const socialLinks = [
  { label: "LinkedIn", url: "https://www.linkedin.com/company/lightninbull/" },
  { label: "Instagram", url: "https://www.instagram.com/lightninbull/" },
  { label: "Facebook", url: "https://www.facebook.com/lightninbull/" },
  { label: "Pinterest", url: "https://www.pinterest.com/lightninbull/" },
  { label: "Twitter", url: "https://x.com/lightninbull" },
];

/* ─── Lightning canvas: fires on scroll ─── */
const LightningCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const opacityRef = useRef(0);
  const lastScrollRef = useRef(0);
  const pathRef = useRef<{ x: number; y: number }[]>([]);

  const makeBolt = (w: number, h: number) => {
    const sx = 60 + Math.random() * (w - 120);
    const pts: { x: number; y: number }[] = [{ x: sx, y: 0 }];
    let cx = sx;
    const segs = 16 + Math.floor(Math.random() * 10);
    for (let i = 1; i <= segs; i++) {
      cx += (Math.random() - 0.5) * 130;
      cx = Math.max(20, Math.min(w - 20, cx));
      pts.push({ x: cx, y: (h * i) / segs });
    }
    pathRef.current = pts;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const op = opacityRef.current;

      if (op > 0.008 && pathRef.current.length > 1) {
        const pts = pathRef.current;

        // Wide outer glow
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(250,180,0,${op * 0.15})`;
        ctx.lineWidth = 32;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Amber glow
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(250,204,21,${op * 0.5})`;
        ctx.lineWidth = 8;
        ctx.shadowBlur = 40;
        ctx.shadowColor = `rgba(250,200,0,${op * 0.8})`;
        ctx.stroke();

        // Gold core
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(255,240,120,${op * 0.85})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = `rgba(255,250,180,${op})`;
        ctx.stroke();

        // Bright white center
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(255,255,255,${op * 0.9})`;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(255,255,255,${op})`;
        ctx.stroke();

        // Screen flash
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(250,204,21,${op * 0.035})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        opacityRef.current *= 0.79;
      } else {
        opacityRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    const onScroll = () => {
      const sy = window.scrollY;
      const delta = Math.abs(sy - lastScrollRef.current);
      lastScrollRef.current = sy;
      if (delta > 35) {
        makeBolt(canvas.width, canvas.height);
        opacityRef.current = Math.min(1, 0.5 + delta / 1000);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
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

/* ─── Main component ─── */
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
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleSignUpChange = (field: keyof typeof initialSignUpState) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setSignUpForm((prev) => ({ ...prev, [field]: event.target.value }));

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
      console.error(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <LightningCanvas />

      <section className="hero-section">
        <video autoPlay muted loop playsInline className="bg-video">
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>
        <div className="video-overlay" />
        <div className="noise-overlay" />
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />

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

        <div className="hero-content">
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
              <br />
              Built for traders who demand discipline, data, and edge.
            </p>

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

            {/* ── Quant AI Fund Manager lives here, directly below stats ── */}
            <div className="hero-quant-block">
              <span className="quant-accent-line" />
              <p className="quant-eyebrow">LIGHTNINBULL INTELLIGENCE LAYER</p>
              <h2 className="quant-heading">
                Quant <em className="quant-ai-word">AI</em> Fund Manager
              </h2>
              <p className="quant-tagline">
                Factor models · Regime detection · Intraday signals · Derivatives analytics
              </p>
            </div>
          </div>

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
                  <input placeholder="+91 00000 00000" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" required />
                </div>
                <div className="input-group">
                  <label className="input-label">PASSWORD</label>
                  <input type="password" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required />
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

        <div className="scroll-indicator">
          <span>SCROLL TO EXPLORE</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* Intelligence section — title removed from here, now lives in hero */}
      <section ref={intelligenceRef} className="intelligence-section">
        <div className="section-label-row">
          <div className="label-line" />
          <p className="section-label">ALL INTELLIGENCE MODULES</p>
          <div className="label-line" />
        </div>

        <p className="section-desc">
          A next-generation quantitative platform combining portfolio analytics, factor modeling,
          regime intelligence, derivatives insights, and real-time trading signals — all inside one
          unified intelligence layer.
        </p>

        <div className="feature-grid">
          {features.map((feature, index) => (
            <button
              type="button"
              key={feature.name}
              className={`feature-card ${selectedFeature?.name === feature.name ? "selected" : ""}`}
              style={{ animationDelay: `${index * 0.035}s` }}
              onClick={() => handleFeatureClick(feature)}
            >
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

      <section ref={aboutRef} className="about-section">
        <div className="about-inner">
          <p className="section-label about-label">ABOUT LIGHTNINBULL</p>
          <h2 className="about-title">Built for traders who want structure,<br />not noise.</h2>
          <p className="about-text">
            LightninBull is an AI-driven Quant Fund Manager platform built to bring
            institutional-style market intelligence to traders and investors. The platform
            combines factor models, regime detection, intraday signals, derivatives analytics,
            portfolio backtesting, and risk management into one unified dashboard.
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

      <footer ref={contactRef} className="footer-strip" id="support">
        <div className="footer-top">
          <div>
            <span className="footer-logo">⚡ LIGHTNINBULL</span>
            <p className="footer-desc">
              Institutional Quant Intelligence for systematic trading, portfolio construction,
              and disciplined risk management.
            </p>
          </div>
          <div className="footer-links-wrap">
            <div className="footer-col">
              <h4>Social Links</h4>
              {socialLinks.map((link) => (
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

        /* ── HERO ── */
        .hero-section {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Syne', sans-serif;
          background: #030405;
        }

        .bg-video {
          position: absolute;
          inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0.44;
        }

        .video-overlay {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 45%, rgba(250,204,21,0.12), transparent 44%),
            linear-gradient(135deg, rgba(3,4,5,0.97) 0%, rgba(3,4,5,0.62) 48%, rgba(3,4,5,0.95) 100%);
          z-index: 1;
        }

        .noise-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
          pointer-events: none;
        }

        /* Floating gold orbs */
        .ambient-orb { position: absolute; border-radius: 50%; pointer-events: none; z-index: 1; filter: blur(90px); }
        .orb-1 {
          width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(250,204,21,0.16), transparent 70%);
          top: -120px; left: -160px;
          animation: orb1 12s ease-in-out infinite alternate;
        }
        .orb-2 {
          width: 440px; height: 440px;
          background: radial-gradient(circle, rgba(250,160,0,0.12), transparent 70%);
          bottom: 60px; right: -120px;
          animation: orb2 9s ease-in-out infinite alternate;
        }
        .orb-3 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(255,230,80,0.09), transparent 70%);
          top: 44%; left: 52%;
          animation: orb3 16s ease-in-out infinite alternate;
        }
        @keyframes orb1 { from{transform:translate(0,0)} to{transform:translate(60px,44px)} }
        @keyframes orb2 { from{transform:translate(0,0)} to{transform:translate(-44px,-30px)} }
        @keyframes orb3 { from{transform:translate(-50%,-50%)scale(1)} to{transform:translate(-50%,-50%)scale(1.35)} }

        /* ── NAV ── */
        .top-nav {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 30px 60px;
          border-bottom: 1px solid rgba(250,204,21,0.13);
        }

        .nav-logo {
          border: none; background: transparent;
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px; letter-spacing: 4px;
          color: #fff; cursor: pointer;
          text-shadow: 0 0 24px rgba(250,204,21,0.35);
        }

        .logo-bolt {
          color: #facc15; margin-right: 6px;
          filter: drop-shadow(0 0 10px rgba(250,204,21,1)) drop-shadow(0 0 24px rgba(250,204,21,0.6));
          animation: boltPulse 2s ease-in-out infinite alternate;
        }
        @keyframes boltPulse {
          from { filter: drop-shadow(0 0 6px rgba(250,204,21,0.8)); }
          to   { filter: drop-shadow(0 0 22px rgba(255,230,0,1)) drop-shadow(0 0 50px rgba(250,204,21,0.7)); }
        }

        .nav-links { display: flex; align-items: center; gap: 34px; }
        .nav-links button {
          border: none; background: transparent;
          font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 1.6px;
          color: rgba(255,255,255,0.48); cursor: pointer; text-transform: lowercase;
          transition: color 0.2s, text-shadow 0.2s;
        }
        .nav-links button:hover { color: #facc15; text-shadow: 0 0 16px rgba(250,204,21,0.7); }

        /* ── HERO CONTENT ── */
        .hero-content {
          position: relative; z-index: 10; flex: 1;
          display: flex; align-items: center; justify-content: space-between;
          padding: 70px 60px 40px; gap: 70px;
        }

        .hero-left { max-width: 720px; }

        .eyebrow-label {
          font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 5px;
          color: #facc15; margin-bottom: 34px;
          text-shadow: 0 0 22px rgba(250,204,21,0.6);
        }

        .hero-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(72px, 7.4vw, 112px); font-weight: 300;
          line-height: 0.93; color: #f7f0df; letter-spacing: -2.8px; margin: 0;
        }

        .headline-gold {
          color: #f5d020; font-style: italic; font-weight: 300;
          text-shadow: 0 0 40px rgba(250,204,21,0.7), 0 0 100px rgba(250,204,21,0.35), 0 0 200px rgba(250,204,21,0.15);
          animation: goldGlow 2.5s ease-in-out infinite alternate;
        }
        @keyframes goldGlow {
          from { text-shadow: 0 0 24px rgba(250,204,21,0.55), 0 0 70px rgba(250,204,21,0.22); }
          to   { text-shadow: 0 0 60px rgba(255,230,0,0.95), 0 0 130px rgba(250,204,21,0.5), 0 0 220px rgba(250,204,21,0.2); }
        }

        .hero-subtext {
          margin-top: 34px;
          font-family: 'DM Mono', monospace; font-size: 13px; line-height: 1.9;
          color: rgba(255,255,255,0.52); letter-spacing: 0.45px;
        }

        /* ── STATS ── */
        .hero-stats {
          display: flex; align-items: stretch; margin-top: 54px;
          border: 1px solid rgba(250,204,21,0.2); max-width: 610px;
          background: rgba(3,4,5,0.5); backdrop-filter: blur(12px);
          box-shadow: 0 0 50px rgba(250,204,21,0.09), inset 0 0 20px rgba(250,204,21,0.04);
        }
        .stat { min-width: 160px; padding: 24px 28px; display: flex; flex-direction: column; gap: 8px; }
        .stat-num {
          font-family: 'Cormorant Garamond', serif; font-size: 30px; font-weight: 400;
          color: #f7f0df; letter-spacing: -0.6px; line-height: 1; text-transform: lowercase;
          text-shadow: 0 0 20px rgba(250,204,21,0.28);
        }
        .stat-label {
          font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 3px;
          color: rgba(255,255,255,0.36); text-transform: uppercase;
        }
        .stat-divider { width: 1px; background: rgba(250,204,21,0.14); }

        /* ── QUANT AI FUND MANAGER IN HERO ── */
        .hero-quant-block {
          margin-top: 52px;
          max-width: 610px;
          padding-top: 40px;
          border-top: 1px solid rgba(250,204,21,0.12);
        }

        .quant-accent-line {
          display: block;
          width: 52px; height: 2px;
          background: linear-gradient(90deg, #facc15, rgba(250,204,21,0.2));
          margin-bottom: 18px;
          box-shadow: 0 0 12px rgba(250,204,21,0.7), 0 0 30px rgba(250,204,21,0.3);
          animation: accentLinePulse 2s ease-in-out infinite alternate;
        }
        @keyframes accentLinePulse {
          from { box-shadow: 0 0 8px rgba(250,204,21,0.5); width: 48px; }
          to   { box-shadow: 0 0 20px rgba(255,230,0,0.9), 0 0 40px rgba(250,204,21,0.4); width: 68px; }
        }

        .quant-eyebrow {
          font-family: 'DM Mono', monospace; font-size: 8.5px; letter-spacing: 5px;
          color: rgba(250,204,21,0.82); margin: 0 0 14px; text-transform: uppercase;
          text-shadow: 0 0 16px rgba(250,204,21,0.45);
        }

        .quant-heading {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(42px, 4.4vw, 68px); font-weight: 300;
          color: #f7f0df; letter-spacing: -1.4px; line-height: 0.96;
          margin: 0 0 16px;
        }

        .quant-ai-word {
          font-style: italic; color: #facc15; font-weight: 300;
          text-shadow: 0 0 40px rgba(250,204,21,0.7), 0 0 90px rgba(250,204,21,0.35), 0 0 180px rgba(250,204,21,0.15);
          animation: subtleGlow 2.5s ease-in-out infinite alternate;
        }

        .quant-tagline {
          font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 1.5px;
          color: rgba(255,255,255,0.34); margin: 0;
        }

        /* ── LOGIN CARD ── */
        .login-card {
          position: relative; z-index: 10; flex-shrink: 0;
          width: 360px; padding: 22px 24px; border-radius: 4px;
          background: rgba(5,6,9,0.94);
          border: 1px solid rgba(250,204,21,0.24);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.02), 0 34px 68px rgba(0,0,0,0.72), 0 0 90px rgba(250,204,21,0.09);
          backdrop-filter: blur(24px);
        }
        .login-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #facc15, transparent);
          border-radius: 4px 4px 0 0;
          animation: cardTopGlow 3s ease-in-out infinite alternate;
        }
        @keyframes cardTopGlow {
          from { box-shadow: 0 0 10px rgba(250,204,21,0.5); opacity: 0.8; }
          to   { box-shadow: 0 0 30px rgba(255,230,0,1), 0 0 60px rgba(250,204,21,0.45); opacity: 1; }
        }

        .card-header { margin-bottom: 14px; }
        .card-logo { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 4px; color: #facc15; text-shadow: 0 0 20px rgba(250,204,21,0.6); }
        .card-sub { margin-top: 7px; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 1px; color: rgba(255,255,255,0.36); text-transform: lowercase; }
        .card-divider { height: 1px; background: rgba(250,204,21,0.1); margin-bottom: 16px; }

        .login-form { display: flex; flex-direction: column; gap: 10px; }
        .signup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-label { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 3px; color: rgba(255,255,255,0.3); }

        .input {
          width: 100%; padding: 10px 12px; border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #fff; font-family: 'DM Mono', monospace; font-size: 12px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s; letter-spacing: 0.4px;
        }
        .input:focus { border-color: rgba(250,204,21,0.55); background: rgba(250,204,21,0.04); box-shadow: 0 0 18px rgba(250,204,21,0.18); }
        .input::placeholder { color: rgba(255,255,255,0.18); }

        .btn {
          width: 100%; padding: 12px; border-radius: 3px;
          background: linear-gradient(90deg, #facc15 0%, #f0b800 100%);
          border: none; font-family: 'Syne', sans-serif; font-weight: 800;
          font-size: 11px; letter-spacing: 3px; color: #050608; cursor: pointer;
          margin-top: 2px; transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          position: relative; overflow: hidden; text-transform: uppercase;
          box-shadow: 0 0 24px rgba(250,204,21,0.35), 0 4px 20px rgba(250,204,21,0.2);
        }
        .btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.24) 50%, transparent 100%);
          transform: translateX(-100%); transition: transform 0.5s ease;
        }
        .btn:hover::after { transform: translateX(100%); }
        .btn:hover { opacity: 0.93; transform: translateY(-1px); box-shadow: 0 0 50px rgba(255,220,0,0.55), 0 6px 30px rgba(250,204,21,0.3); }
        .btn:disabled { opacity: 0.6; cursor: default; transform: none; }
        .btn-loading { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(5,6,8,0.3); border-top-color: #050608; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .signup-ghost-btn {
          width: 100%; padding: 10px; border-radius: 3px;
          background: transparent; border: 1px solid rgba(250,204,21,0.26); color: #facc15;
          font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 2px;
          text-transform: uppercase; cursor: pointer; transition: all 0.2s ease;
        }
        .signup-ghost-btn:hover { background: rgba(250,204,21,0.08); border-color: rgba(250,204,21,0.58); transform: translateY(-1px); box-shadow: 0 0 22px rgba(250,204,21,0.18); }

        .forgot-link { text-align: center; font-family: 'DM Mono', monospace; font-size: 10px; color: rgba(255,255,255,0.25); letter-spacing: 0.5px; margin: 0; }
        .forgot-link a { color: rgba(250,204,21,0.72); text-decoration: none; }
        .forgot-link a:hover { color: #facc15; text-shadow: 0 0 12px rgba(250,204,21,0.6); }

        .auth-alert { margin-bottom: 12px; padding: 10px 12px; border-radius: 3px; font-family: 'DM Mono', monospace; font-size: 10px; line-height: 1.6; letter-spacing: 0.4px; }
        .auth-alert.error { background: rgba(220,38,38,0.15); border: 1px solid rgba(248,113,113,0.38); color: #fecaca; }
        .auth-alert.success { background: rgba(22,163,74,0.15); border: 1px solid rgba(74,222,128,0.38); color: #bbf7d0; }

        .scroll-indicator {
          position: relative; z-index: 10;
          display: flex; align-items: center; gap: 20px; padding: 24px 60px 34px;
          font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 5px; color: rgba(255,255,255,0.25);
        }
        .scroll-line {
          flex: 1; max-width: 80px; height: 1px;
          background: linear-gradient(90deg, rgba(250,204,21,0.65), transparent);
          box-shadow: 0 0 8px rgba(250,204,21,0.45);
          animation: scrollPulse 2s ease-in-out infinite;
        }
        @keyframes scrollPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

        /* ── INTELLIGENCE SECTION ── */
        .intelligence-section {
          padding: 100px 60px 150px;
          font-family: 'Syne', sans-serif;
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(250,204,21,0.08) 0%, transparent 70%),
            #030405;
        }

        .section-label-row { display: flex; align-items: center; gap: 24px; margin-bottom: 40px; }
        .label-line { flex: 1; height: 1px; background: rgba(250,204,21,0.12); }
        .section-label {
          font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 5px;
          color: rgba(250,204,21,0.88); white-space: nowrap; text-transform: uppercase;
          text-shadow: 0 0 18px rgba(250,204,21,0.45);
        }

        @keyframes subtleGlow {
          from { text-shadow: 0 0 24px rgba(250,204,21,0.45), 0 0 70px rgba(250,204,21,0.18); }
          to   { text-shadow: 0 0 60px rgba(255,230,0,0.95), 0 0 130px rgba(250,204,21,0.5), 0 0 220px rgba(250,204,21,0.2); }
        }

        .section-desc {
          max-width: 760px; margin: 0 auto 70px;
          font-family: 'DM Mono', monospace; font-size: 13px; line-height: 2;
          color: rgba(255,255,255,0.44); text-align: center; letter-spacing: 0.3px;
        }

        /* ── FEATURE GRID ── */
        .feature-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(250,204,21,0.08);
          border: 1px solid rgba(250,204,21,0.1);
          border-radius: 4px; overflow: hidden;
        }

        .feature-card {
          position: relative; text-align: left; padding: 31px 27px;
          background: rgba(5,6,9,0.97);
          transition: background 0.3s ease, transform 0.22s ease;
          overflow: hidden; border: none; cursor: pointer; color: inherit;
          animation: fadeUp 0.5s ease both; min-height: 238px;
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

        /* Radial gold glow on hover */
        .feature-card::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.12), transparent 62%);
          opacity: 0; transition: opacity 0.4s ease;
        }
        .feature-card:hover, .feature-card.selected { background: rgba(10,11,14,1); transform: translateY(-2px); }
        .feature-card:hover::after, .feature-card.selected::after { opacity: 1; }

        /* Thunder sweep line across card top on hover */
        .feature-card::before {
          content: ''; position: absolute;
          top: 0; left: -110%; width: 100%; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(250,204,21,0.8), rgba(255,245,100,1), rgba(250,204,21,0.8), transparent);
          box-shadow: 0 0 14px rgba(250,204,21,0.9), 0 0 40px rgba(250,204,21,0.5);
          opacity: 0;
        }
        .feature-card:hover::before, .feature-card.selected::before {
          opacity: 1;
          animation: thunderSweep 0.55s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        @keyframes thunderSweep { from{left:-110%} to{left:110%} }

        .feature-topline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; position: relative; z-index: 2; }

        .card-icon { font-size: 18px; color: rgba(250,204,21,0.62); transition: color 0.3s, filter 0.3s; }
        .feature-tag { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 2.5px; color: rgba(255,255,255,0.28); }
        .feature-card:hover .card-icon, .feature-card.selected .card-icon {
          color: #facc15;
          filter: drop-shadow(0 0 10px rgba(250,204,21,1)) drop-shadow(0 0 24px rgba(250,204,21,0.6));
        }

        /* Card title with gold thunder sweep on hover */
        .card-title {
          font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 400;
          color: #f7f0df; margin: 0 0 13px; line-height: 1.05; letter-spacing: -0.4px;
          position: relative; z-index: 2; transition: text-shadow 0.3s;
        }

        .title-thunder {
          display: inline-block;
          background: linear-gradient(90deg, #f7f0df 0%, #f7f0df 100%);
          background-clip: text; -webkit-background-clip: text; color: transparent;
          transition: filter 0.3s;
        }
        .feature-card:hover .title-thunder, .feature-card.selected .title-thunder {
          background: linear-gradient(
            100deg,
            #c8b87a 0%,
            #f7f0df 28%,
            #facc15 46%,
            #fff8a0 50%,
            #facc15 54%,
            #f7f0df 72%,
            #c8b87a 100%
          );
          background-size: 250% 100%;
          background-clip: text; -webkit-background-clip: text; color: transparent;
          animation: titleThunder 0.65s ease forwards;
          filter: drop-shadow(0 0 8px rgba(250,204,21,0.55));
        }
        @keyframes titleThunder {
          from { background-position: 200% center; }
          to   { background-position: -50% center; }
        }

        .card-desc { font-family: 'DM Mono', monospace; font-size: 11px; line-height: 1.75; color: rgba(255,255,255,0.4); margin: 0; position: relative; z-index: 2; }

        .feature-action {
          display: inline-block; margin-top: 18px;
          font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px;
          color: rgba(250,204,21,0.7); position: relative; z-index: 2;
          transition: color 0.2s, text-shadow 0.2s;
        }
        .feature-card:hover .feature-action { color: #facc15; text-shadow: 0 0 14px rgba(250,204,21,0.65); }

        .card-corner {
          position: absolute; bottom: 18px; right: 18px;
          width: 18px; height: 18px;
          border-right: 1px solid rgba(250,204,21,0.3); border-bottom: 1px solid rgba(250,204,21,0.3);
          z-index: 2; transition: border-color 0.3s, box-shadow 0.3s;
        }
        .feature-card:hover .card-corner, .feature-card.selected .card-corner {
          border-color: rgba(250,204,21,0.75);
          box-shadow: 4px 4px 14px rgba(250,204,21,0.3);
        }

        /* ── DETAIL PANEL ── */
        .feature-detail-panel {
          margin-top: 42px;
          border: 1px solid rgba(250,204,21,0.22);
          background:
            radial-gradient(ellipse at 0% 100%, rgba(250,204,21,0.1), transparent 60%),
            rgba(5,6,9,0.96);
          display: grid; grid-template-columns: 0.85fr 1.15fr;
          gap: 40px; padding: 38px;
          animation: fadeUp 0.36s ease both;
          box-shadow: 0 0 70px rgba(250,204,21,0.07), inset 0 0 50px rgba(250,204,21,0.04);
        }

        .detail-kicker { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 4px; color: #facc15; margin: 0 0 18px; text-shadow: 0 0 18px rgba(250,204,21,0.55); }
        .detail-left h3 { font-family: 'Cormorant Garamond', serif; font-size: clamp(40px, 4vw, 62px); font-weight: 300; color: #f7f0df; line-height: 0.95; margin: 0 0 24px; letter-spacing: -1px; text-shadow: 0 0 40px rgba(250,204,21,0.14); }
        .detail-left p { font-family: 'DM Mono', monospace; font-size: 13px; line-height: 1.9; color: rgba(255,255,255,0.46); margin: 0; }

        .detail-right { display: grid; gap: 16px; }
        .detail-box { border-left: 2px solid rgba(250,204,21,0.38); padding: 18px 0 18px 22px; box-shadow: inset 4px 0 22px rgba(250,204,21,0.05); }
        .detail-box span { display: block; font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 3px; color: rgba(250,204,21,0.92); margin-bottom: 10px; text-shadow: 0 0 14px rgba(250,204,21,0.45); }
        .detail-box p { font-family: 'DM Mono', monospace; font-size: 12px; line-height: 1.85; color: rgba(255,255,255,0.46); margin: 0; }

        /* ── ABOUT ── */
        .about-section {
          padding: 130px 60px;
          background: radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.08), transparent 70%), #050608;
          font-family: 'Syne', sans-serif;
        }
        .about-inner { max-width: 1180px; margin: 0 auto; }
        .about-label { text-align: center; display: block; margin-bottom: 34px; }
        .about-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(48px, 5.5vw, 82px); font-weight: 300; line-height: 0.98; letter-spacing: -1.8px; color: #f7f0df; text-align: center; margin: 0; }
        .about-text { max-width: 820px; margin: 36px auto 0; text-align: center; font-family: 'DM Mono', monospace; font-size: 13px; line-height: 2; color: rgba(255,255,255,0.44); }
        .growth-line { margin: 38px 0 50px; text-align: center; font-family: 'Cormorant Garamond', serif; font-size: clamp(34px, 4vw, 56px); font-style: italic; color: #facc15; text-shadow: 0 0 70px rgba(250,204,21,0.28), 0 0 140px rgba(250,204,21,0.1); }
        .about-stats { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid rgba(250,204,21,0.11); background: rgba(250,204,21,0.02); }
        .about-stats div { padding: 30px 24px; border-right: 1px solid rgba(250,204,21,0.09); }
        .about-stats div:last-child { border-right: none; }
        .about-stats span { display: block; font-family: 'Cormorant Garamond', serif; font-size: 34px; color: #f7f0df; margin-bottom: 8px; text-shadow: 0 0 22px rgba(250,204,21,0.22); }
        .about-stats p { margin: 0; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2.4px; color: rgba(255,255,255,0.35); text-transform: uppercase; }

        /* ── FOOTER ── */
        .footer-strip { padding: 70px 60px 34px; background: #030405; border-top: 1px solid rgba(250,204,21,0.11); font-family: 'Syne', sans-serif; }
        .footer-top { display: flex; justify-content: space-between; gap: 60px; max-width: 1180px; margin: 0 auto 54px; }
        .footer-logo { display: block; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px; letter-spacing: 4px; color: #f7f0df; margin-bottom: 20px; text-shadow: 0 0 22px rgba(250,204,21,0.32); }
        .footer-desc { max-width: 480px; font-family: 'DM Mono', monospace; font-size: 12px; line-height: 1.9; color: rgba(255,255,255,0.36); margin: 0; }
        .footer-links-wrap { display: flex; gap: 72px; }
        .footer-col { display: flex; flex-direction: column; gap: 12px; min-width: 150px; }
        .footer-col h4 { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 3px; color: #facc15; text-transform: uppercase; margin: 0 0 8px; text-shadow: 0 0 14px rgba(250,204,21,0.45); }
        .footer-col a { font-family: 'DM Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.38); text-decoration: none; transition: color 0.2s, text-shadow 0.2s; }
        .footer-col a:hover { color: #facc15; text-shadow: 0 0 14px rgba(250,204,21,0.65); }
        .footer-bottom { max-width: 1180px; margin: 0 auto; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .footer-bottom span { font-family: 'DM Mono', monospace; font-size: 10px; color: rgba(255,255,255,0.28); letter-spacing: 1px; }
        .footer-bottom button { border: 1px solid rgba(250,204,21,0.32); background: rgba(250,204,21,0.06); color: #facc15; font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; padding: 12px 18px; border-radius: 3px; cursor: pointer; transition: all 0.2s ease; }
        .footer-bottom button:hover { background: rgba(250,204,21,0.12); box-shadow: 0 0 28px rgba(250,204,21,0.24); }

        /* ── RESPONSIVE ── */
        @media (max-width: 1200px) {
          .hero-content { gap: 46px; }
          .hero-headline { font-size: clamp(62px, 7vw, 92px); }
          .feature-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 980px) {
          .top-nav { padding: 24px 28px; align-items: flex-start; gap: 20px; }
          .nav-links { gap: 16px; flex-wrap: wrap; justify-content: flex-end; }
          .hero-content { flex-direction: column; align-items: flex-start; padding: 54px 28px 40px; }
          .login-card { width: 100%; max-width: 400px; }
          .hero-stats, .hero-quant-block { max-width: 100%; }
          .feature-grid { grid-template-columns: repeat(2, 1fr); }
          .feature-detail-panel { grid-template-columns: 1fr; }
          .about-stats { grid-template-columns: repeat(2, 1fr); }
          .about-stats div:nth-child(2) { border-right: none; }
          .about-stats div:nth-child(1), .about-stats div:nth-child(2) { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .footer-top { flex-direction: column; }
        }
        @media (max-width: 640px) {
          .top-nav { flex-direction: column; }
          .nav-links { justify-content: flex-start; }
          .nav-links button { font-size: 10px; }
          .hero-content { padding: 46px 20px 30px; }
          .hero-headline { font-size: clamp(48px, 14vw, 62px); letter-spacing: -1.5px; }
          .hero-subtext { font-size: 11px; }
          .hero-stats { flex-direction: column; }
          .stat-divider { width: 100%; height: 1px; }
          .stat { min-width: auto; }
          .quant-heading { font-size: clamp(36px, 10vw, 50px); }
          .login-card { padding: 20px; }
          .signup-grid { grid-template-columns: 1fr; gap: 10px; }
          .scroll-indicator { padding: 20px; }
          .intelligence-section, .about-section, .footer-strip { padding-left: 20px; padding-right: 20px; }
          .section-label-row { gap: 12px; }
          .section-label { white-space: normal; text-align: center; line-height: 1.6; }
          .feature-grid { grid-template-columns: 1fr; }
          .feature-detail-panel { padding: 26px; }
          .about-stats { grid-template-columns: 1fr; }
          .about-stats div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.08); }
          .about-stats div:last-child { border-bottom: none; }
          .footer-links-wrap { flex-direction: column; gap: 34px; }
          .footer-bottom { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
};

export default Auth;
