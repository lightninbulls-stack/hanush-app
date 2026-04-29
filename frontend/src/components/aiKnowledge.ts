export type KnowledgeTopic = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
};

export const LIGHTNIN_BULL_KNOWLEDGE: KnowledgeTopic[] = [
  {
    id: "dashboard-overview",
    title: "Dashboard overview",
    keywords: ["dashboard", "lightnin bull", "lightninbull", "how to use", "what is this", "welcome", "guide"],
    answer:
      "LightninBull is not just a stock screener. It is an AI-driven Quant Fund Manager workflow. The idea is to separate two important decisions: stock selection creates return potential, while allocation controls volatility and portfolio risk. The dashboard helps users discover stocks, shortlist ideas, add them to Watchlist, backtest portfolios, rebalance with discipline, and monitor performance over time.",
  },
  {
    id: "core-workflow",
    title: "Core workflow",
    keywords: ["workflow", "steps", "process", "discover select backtest rebalance", "live workflow"],
    answer:
      "The LightninBull workflow is: 1) scan the market universe, 2) use the selection engine to find alpha opportunities, 3) use the allocation engine to control risk and volatility, 4) test the portfolio with Equal Weight or MVO, and 5) rebalance using disciplined risk rules. In simple words: discover, select, backtest, rebalance, then monitor and improve.",
  },
  {
    id: "stock-discovery",
    title: "Stock Discovery",
    keywords: ["stock discovery", "discover stocks", "scan market", "market universe", "ai selected opportunities"],
    answer:
      "Stock Discovery means the AI Quant Fund Manager scans the market using multiple models: momentum, regime, value, quality, range-bound, derivatives, and intraday models. Instead of manually checking every stock, users can start from model-filtered buckets that highlight higher-conviction opportunities.",
  },
  {
    id: "intelligent-buckets",
    title: "Intelligent Buckets",
    keywords: ["bucket", "buckets", "intelligent buckets", "stock buckets", "model bucket", "categories"],
    answer:
      "Intelligent Buckets classify stocks into useful groups such as Consistent Trending, Slow Movement, Cheap Value, Best Quality, Regime Upside, Regime Downside, Range Bound Upside, Range Bound Downside, Aggressive Call Option Stocks, and Aggressive Put Option Stocks. Each bucket gives a different type of trading or portfolio insight.",
  },
  {
    id: "watchlist-engine",
    title: "Watchlist Engine",
    keywords: ["watchlist", "add to watchlist", "track selected", "selected ideas", "shortlist"],
    answer:
      "The Watchlist Engine lets users move selected stocks from any model bucket into one place. The main benefit is focus: users track only the names that matter to them instead of scanning the entire market manually every day.",
  },
  {
    id: "portfolio-backtest",
    title: "Portfolio Backtest",
    keywords: ["portfolio backtest", "backtest", "equal weight", "mvo", "mean variance", "simulation", "test before committing"],
    answer:
      "Portfolio Backtest helps users test selected stocks before committing real capital. The dashboard supports Equal Weight and Mean-Variance Optimization style allocation. Equal Weight is the institutional baseline, while MVO tries to create risk-adjusted portfolio weights based on return, risk, and diversification behaviour.",
  },
  {
    id: "selection-alpha-engine",
    title: "Selection / Alpha Engine",
    keywords: ["selection", "alpha engine", "alpha", "return potential", "high probability alpha", "stock selection"],
    answer:
      "Selection is the Alpha Engine. This is where return potential comes from. LightninBull uses regime-based filtering, momentum ranking, and factor model screening to find high-probability alpha stocks. Selection answers the question: which stocks deserve attention?",
  },
  {
    id: "allocation-risk-engine",
    title: "Allocation / Risk Engine",
    keywords: ["allocation", "risk engine", "risk", "volatility", "minimum variance", "portfolio weights", "control volatility"],
    answer:
      "Allocation is the Risk Engine. This controls volatility and portfolio risk after stocks are selected. LightninBull supports Equal Weight as a simple institutional baseline and Minimum Variance / MVO style allocation for risk-adjusted portfolio weights. Allocation answers the question: how much capital should go into each stock?",
  },
  {
    id: "risk-adjusted-portfolio",
    title: "Risk-adjusted portfolio output",
    keywords: ["risk adjusted", "final output", "optimized portfolio", "diversified", "systematic"],
    answer:
      "The final output of the workflow is a risk-adjusted portfolio: diversified, systematic, and optimized for risk and return. The goal is not only to find strong stocks, but to combine them in a disciplined way so that portfolio volatility is controlled.",
  },
  {
    id: "risk-rebalancing",
    title: "Risk and Rebalancing",
    keywords: ["rebalance", "rebalancing", "risk control", "2 weeks", "3%", "5%", "emotions", "discipline"],
    answer:
      "LightninBull uses rule-based rebalancing to reduce emotional decision-making. The dashboard explains three core rebalance rules: rebalance every 2 weeks, rebalance if the portfolio falls by 3%, or rebalance when the portfolio gains 5%. The idea is to let the process control risk before emotion controls the trader.",
  },
  {
    id: "monitor-improve",
    title: "Monitor and Improve",
    keywords: ["monitor", "improve", "performance", "factor behaviour", "review risk", "evaluate"],
    answer:
      "Monitor & Improve means users should continuously track portfolio performance, review risk, evaluate factor behaviour, and improve portfolio construction over time. A quant process is not one-time stock picking; it is a loop of signal review, risk review, and portfolio improvement.",
  },
  {
    id: "factor-models",
    title: "Factor Models",
    keywords: ["factor", "factor models", "momentum", "value", "quality", "regime", "consistent trending", "slow movement", "cheap value", "best quality"],
    answer:
      "The Factor Models layer covers different ways of ranking stocks. Consistent Trending focuses on stable trend behaviour. Slow Movement can help identify steadier names. Cheap Value focuses on valuation-style opportunities. Best Quality focuses on stronger business or quality characteristics. Regime Upside and Regime Downside focus on market regime behaviour.",
  },
  {
    id: "regime-upside",
    title: "Regime Upside",
    keywords: ["regime upside", "upside regime", "bullish regime", "upside stocks"],
    answer:
      "Regime Upside is designed to show stocks where the market regime supports bullish continuation. In practical terms, these are stocks that may be better aligned with an upside market environment. Users should treat this as a model signal and combine it with risk management, not as a guaranteed buy call.",
  },
  {
    id: "regime-downside",
    title: "Regime Downside",
    keywords: ["regime downside", "downside regime", "bearish regime", "downside stocks"],
    answer:
      "Regime Downside is designed to show stocks where the market regime supports downside behaviour. It helps users identify weaker or bearish candidates. This is useful for risk awareness, hedging ideas, or bearish strategy research, but it is still a signal layer, not guaranteed advice.",
  },
  {
    id: "derivatives-intelligence",
    title: "Derivatives Intelligence",
    keywords: ["derivatives", "aggressive call", "aggressive put", "option stocks", "call option", "put option"],
    answer:
      "The Derivatives Intelligence layer includes Aggressive Call Option Stocks and Aggressive Put Option Stocks. These categories are designed to capture names where option activity or derivative demand may be relevant. They help users understand where bullish or bearish option interest may be stronger.",
  },
  {
    id: "intraday-signals",
    title: "Intraday Stock Signals",
    keywords: ["intraday", "intraday stock signals", "upside trend stocks", "downside trend stocks", "live signals", "paper signal"],
    answer:
      "Intraday Stock Signals are live intraday trend-tracking panels. Upside Trend Stocks focus on bullish intraday trend signals, while Downside Trend Stocks focus on bearish intraday trend signals. These are meant for tracking live signal behaviour such as entry, LTP, max LTP, and status, not for blind trading without a plan.",
  },
  {
    id: "option-spreads",
    title: "Intraday Index Option Spreads",
    keywords: ["option spreads", "intraday index option spreads", "bull call spreads", "bear put spreads", "spread engine"],
    answer:
      "Intraday Index Option Spreads include Bull Call Spreads and Bear Put Spreads. A Bull Call Spread is used for controlled-risk bullish exposure. A Bear Put Spread is used for controlled-risk bearish exposure. These strategies cap both risk and reward compared with naked option buying.",
  },
  {
    id: "not-investment-advice",
    title: "Risk disclaimer",
    keywords: ["advice", "guaranteed", "should i buy", "buy now", "sell now", "risk", "disclaimer"],
    answer:
      "LightninBull is a research and analytics dashboard. Signals should not be treated as guaranteed buy or sell calls. Users should apply position sizing, stop-loss rules, diversification, and their own judgment before taking any trade. The goal is disciplined decision support, not emotional trading.",
  },
];

export function findKnowledgeAnswer(question: string): string | null {
  const normalized = question.toLowerCase();

  let bestTopic: KnowledgeTopic | null = null;
  let bestScore = 0;

  for (const topic of LIGHTNIN_BULL_KNOWLEDGE) {
    let score = 0;

    for (const keyword of topic.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  if (!bestTopic || bestScore === 0) return null;
  return `${bestTopic.title}\n\n${bestTopic.answer}`;
}

export function getKnowledgeOverview(): string {
  return (
    "I can explain the LightninBull dashboard knowledge base, including:\n" +
    "- Dashboard overview\n" +
    "- Stock Discovery\n" +
    "- Intelligent Buckets\n" +
    "- Watchlist Engine\n" +
    "- Portfolio Backtest\n" +
    "- Selection / Alpha Engine\n" +
    "- Allocation / Risk Engine\n" +
    "- Risk-adjusted portfolio output\n" +
    "- Risk and Rebalancing rules\n" +
    "- Factor Models\n" +
    "- Regime Upside / Regime Downside\n" +
    "- Intraday Stock Signals\n" +
    "- Intraday Index Option Spreads\n\n" +
    "Ask: 'Explain the alpha engine', 'What is rebalancing?', or 'How does the dashboard work?'"
  );
}
