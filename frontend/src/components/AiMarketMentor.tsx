import React, { useState, useRef, useEffect } from "react";
import { fetchStocksByCategory } from "../api";
import { addWatchlistSymbol } from "../services/watchlistApi";

// ─── Product Knowledge ────────────────────────────────────────────────────────

// Aliases are sorted longest-first at runtime so "slow movement" beats "slow"
const FACTOR_CATEGORIES: Array<{ name: string; aliases: string[] }> = [
  {
    name: "Consistent Trending",
    aliases: [
      "consistent trending", "consistent trend", "consistent", "trending", "momentum", "ct",
    ],
  },
  {
    name: "Slow Movement",
    aliases: [
      "slow movement", "slow move", "slow moving", "slow", "low vol", "low volatility",
      "low volume", "low vola",
    ],
  },
  {
    name: "Cheap Value",
    aliases: [
      "cheap value", "cheap values", "cheap", "value stocks", "value", "undervalued", "cv",
    ],
  },
  {
    name: "Best Quality",
    aliases: [
      "best quality", "high quality", "quality stocks", "quality", "bq",
    ],
  },
  {
    name: "Regime Upside",
    aliases: [
      "regime upside", "regime up", "upside regime", "regime upside stocks",
    ],
  },
  {
    name: "Regime Downside",
    aliases: [
      "regime downside", "regime down", "downside regime",
    ],
  },
  {
    name: "Range Bound Upside",
    aliases: [
      "range bound upside", "range bound up", "range up", "range bound", "range",
    ],
  },
  {
    name: "Range Bound Downside",
    aliases: [
      "range bound downside", "range bound down", "range down",
    ],
  },
  {
    name: "Aggressive Call Option Stocks",
    aliases: [
      "aggressive call option stocks", "aggressive call option", "aggressive calls",
      "aggressive call", "call option stocks", "call options", "calls",
    ],
  },
  {
    name: "Aggressive Put Option Stocks",
    aliases: [
      "aggressive put option stocks", "aggressive put option", "aggressive puts",
      "aggressive put", "put option stocks", "put options", "puts",
    ],
  },
];

// Build a flat alias → category map, longest alias first (prevents "slow" beating "slow movement")
const ALIAS_MAP: Array<{ alias: string; category: string }> = FACTOR_CATEGORIES.flatMap(
  (f) => f.aliases.map((a) => ({ alias: a.toLowerCase(), category: f.name }))
).sort((a, b) => b.alias.length - a.alias.length);

// All words that belong to category names — these must NEVER be treated as tickers
const CATEGORY_STOP_WORDS = new Set(
  FACTOR_CATEGORIES.flatMap((f) =>
    f.aliases.flatMap((a) => a.toLowerCase().split(/\s+/))
  )
);

// Common English words that old/broken AI parsers might accidentally treat as tickers
const ENGLISH_STOP_WORDS = new Set([
  // User command words
  "add", "get", "put", "show", "open", "go", "run", "give", "take", "send",
  "want", "need", "from", "into", "onto", "with", "for", "the", "and",
  "top", "bottom", "first", "last", "my", "me", "all", "some", "few", "more",
  "in", "on", "at", "by", "to", "of", "an", "a", "is", "it", "be",
  // Finance/product words
  "stock", "stocks", "share", "shares", "sector", "fund", "etf", "index",
  "watchlist", "watch", "list", "portfolio", "backtest", "signal", "signals",
  "market", "equity", "nse", "bse", "nifty", "sensex",
  "bull", "bear", "spread", "spreads", "option", "options",
  "slow", "fast", "high", "low", "mid", "bot", "big", "small", "new", "old",
  // Misc short strings that look like tickers but aren't
  "bot", "api", "now", "yes", "no", "ok", "not", "can", "did", "has", "had",
]);

const ALL_STOCKS_SENTINEL = 999; // means "fetch every stock in the category"

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // "all" / "every" / "entire" → sentinel, sliced to actual list length later
  all: ALL_STOCKS_SENTINEL,
  every: ALL_STOCKS_SENTINEL,
  entire: ALL_STOCKS_SENTINEL,
};

function extractNumber(text: string): number | null {
  const lower = text.toLowerCase();
  for (const [word, num] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return num;
  }
  const match = lower.match(/\b(\d+)\b/);
  if (match) return Math.min(parseInt(match[1], 10), ALL_STOCKS_SENTINEL);
  return null; // caller decides the default
}

// ─── Fuzzy Matching ───────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// Two words are "similar enough" if edits ≤ 30% of the longer word (min 1 typo allowed)
function wordSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 4) return false;
  const threshold = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.32));
  return levenshtein(a, b) <= threshold;
}

// Score how well the user's input matches a given alias phrase
function aliasScore(inputWords: string[], alias: string): number {
  const aliasWords = alias.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (aliasWords.length === 0) return 0;

  let matched = 0;
  for (const aw of aliasWords) {
    if (inputWords.some((iw) => wordSimilar(iw, aw))) matched++;
  }
  return matched / aliasWords.length; // 0.0 → 1.0
}

function matchCategory(text: string): string | null {
  const lower = text.toLowerCase();

  // Pass 1: exact substring (fastest, handles normal input)
  for (const { alias, category } of ALIAS_MAP) {
    if (lower.includes(alias)) return category;
  }

  // Pass 2: fuzzy word-level match (handles typos like "movemennt", "regime upsied")
  const inputWords = lower.split(/\s+/).filter((w) => w.length > 1);
  let bestScore = 0;
  let bestCategory: string | null = null;

  for (const factor of FACTOR_CATEGORIES) {
    for (const alias of factor.aliases) {
      const score = aliasScore(inputWords, alias);
      // Require ≥ 70% of alias words to fuzzy-match, prefer longer/more-specific aliases
      if (score >= 0.7 && score > bestScore) {
        bestScore = score;
        bestCategory = factor.name;
      }
    }
  }

  return bestCategory;
}

// Confirm a symbol looks like a real NSE ticker (not a stray English word)
function looksLikeTicker(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  const lower = s.toLowerCase();
  // NSE tickers: 2-20 chars, letters/digits/& only
  if (!/^[A-Z0-9&-]{2,20}$/.test(s)) return false;
  // Reject category alias words (slow, movement, regime, value, …)
  if (CATEGORY_STOP_WORDS.has(lower)) return false;
  // Reject common English words that can never be real tickers
  if (ENGLISH_STOP_WORDS.has(lower)) return false;
  return true;
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

// Metric keyword → explanation (sourced directly from PortfolioBacktestPanel metricDefinitions)
const METRIC_KNOWLEDGE: Record<string, string> = {
  cagr: `CAGR stands for Compound Annual Growth Rate — your portfolio's yearly growth speed.

Example: 20% CAGR means ₹1,00,000 grows to roughly ₹1,20,000 in one year, ₹1,44,000 in two years, ₹1,73,000 in three years — compounding each year.

On LightninBull the backtest shows your watchlist CAGR vs NIFTY 50 CAGR so you can see whether your stock selection beat the market on a yearly basis.`,

  "total return": `Total Return is the full profit or loss over the entire backtest period (last 1 year).

Example: If you invested ₹1,00,000 and your portfolio is now ₹1,28,000, your total return is +28%.

Unlike CAGR (which annualises), total return is the raw number — useful for comparing absolute gains.`,

  sharpe: `Sharpe Ratio measures the quality of your returns relative to the risk you took.

Formula: (Portfolio Return − Risk-Free Rate) ÷ Volatility

Example:
• Portfolio A: 20% return, 25% volatility → Sharpe ≈ 0.8
• Portfolio B: 18% return, 12% volatility → Sharpe ≈ 1.5
Portfolio B has a better Sharpe — you earned nearly as much but with far less risk.

Industry standard: Sharpe > 1.0 is considered good. > 2.0 is excellent.
Used by every hedge fund, mutual fund, and PMS globally to compare strategies.`,

  "max drawdown": `Max Drawdown is the biggest fall from the portfolio's highest point during the backtest.

Example: If your portfolio peak was ₹1,40,000 and it then dropped to ₹98,000, the Max Drawdown is −30%.

Why it matters: A strategy might have great returns but if it fell 60% in between, most retail investors would have panicked and sold at the bottom. Smaller drawdown = more comfortable ride.

LightninBull shows "DD Improvement" — how much less your portfolio fell compared to NIFTY 50.`,

  drawdown: `See Max Drawdown — the biggest peak-to-trough fall in the portfolio during the backtest period.`,

  volatility: `Volatility measures how much the portfolio's value moves up and down day to day.

Example: 15% annualised volatility means the portfolio can swing ±15% from its average in a year.

Lower volatility = smoother ride. Higher volatility = bigger swings both ways.
The Slow Movement factor bucket specifically targets low-volatility stocks for this reason.`,

  var: `VaR (Value at Risk) at 95% confidence estimates your worst normal-day loss.

Example: 2% VaR means that on a typical bad day (not a crash), ₹1,00,000 may lose around ₹2,000.

It does NOT cover black-swan events — those fall in the remaining 5% tail. Used by banks and fund managers to set daily risk limits.`,

  alpha: `Alpha is the extra return your portfolio generated compared to NIFTY 50.

Example: If your portfolio CAGR is 24% and NIFTY 50 CAGR is 14%, your Alpha is +10%.

Positive alpha = your stock selection added value beyond what the market gave for free.
This is the whole point of factor investing — generating consistent alpha through systematic stock selection.`,

  "sharpe spread": `Sharpe Spread = Your Portfolio Sharpe minus NIFTY 50 Sharpe.

A positive Sharpe Spread means your portfolio delivered better risk-adjusted returns than just buying NIFTY 50.
Example: Portfolio Sharpe 1.8, NIFTY 50 Sharpe 0.9 → Sharpe Spread = +0.9 (excellent).`,

  "1w return": `1W Return is your portfolio's performance over the last ~5 trading sessions (one week).
Useful for tracking very recent momentum.`,

  "2w return": `2W Return is your portfolio's performance over the last ~10 trading sessions (two weeks).
Aligns with LightninBull's 2-week rebalancing cycle.`,

  "1m return": `1M Return covers the last ~21 trading sessions (one month). Good for medium-term trend check.`,

  "3m return": `3M Return covers the last ~63 trading sessions (three months). Shows momentum over a quarter.`,

  "6m return": `6M Return covers the last ~126 trading sessions (six months). Core lookback for Consistent Trending and Slow Movement factors.`,
};

const MVO_EXPLANATION = `MVO — Mean-Variance Optimization — is the mathematical foundation of modern portfolio theory, developed by Harry Markowitz in 1952 (Nobel Prize in Economics).

THE CORE IDEA
Don't just pick stocks with high returns. Find the combination of weights that gives the maximum return for the minimum risk. Risk here means volatility (how much prices fluctuate).

HOW IT WORKS ON LIGHTNINBULL
1. Takes your watchlist stocks and their 1-year daily return history.
2. Calculates expected return for each stock.
3. Builds a covariance matrix — how each stock moves relative to every other stock.
4. Runs an optimizer to find weights that maximize the Sharpe Ratio (return ÷ risk).
5. Assigns higher weight to stocks that: (a) have strong returns AND (b) reduce total portfolio risk by moving differently from other stocks.

SIMPLE EXAMPLE
Say your watchlist has 3 stocks:
• INFY: 22% return, 28% volatility
• HDFC: 18% return, 16% volatility
• TITAN: 26% return, 32% volatility

Equal Weight gives each 33.3%.
MVO might give: HDFC 45%, INFY 35%, TITAN 20% — because HDFC's lower volatility and low correlation with the others reduces total portfolio risk significantly, even though its individual return is lower.

Result: slightly lower return than TITAN-heavy, but far smoother ride and higher Sharpe Ratio.

WHO USES MVO IN REAL LIFE
• BlackRock, Vanguard, Fidelity use MVO variants in index and smart-beta funds.
• Every SEBI-regulated PMS (Portfolio Management Service) in India runs some form of MVO.
• Pension funds (LIC, EPFO) use it to balance equity and debt allocations.
• Hedge funds use it as the base layer before adding their own alpha signals.

MVO SHORT (on LightninBull)
Same math but inverted — finds weights for a short portfolio. Useful in Regime Downside phases when you want to benefit from falling prices. The optimizer identifies which stocks are likely to underperform and allocates negative weights to them.

WHEN TO USE WHICH STRATEGY
• Equal Weight → Simple, works well, good for beginners, no math bias.
• MVO Weights → Better risk-adjusted returns when stocks in your watchlist have different volatilities.
• MVO Short → For bearish market conditions (use with Regime Downside or Bear Put Spreads).`;

const EQUAL_WEIGHT_EXPLANATION = `Equal Weight is the simplest portfolio construction method — divide your capital equally among all stocks.

HOW IT WORKS
If you have 5 stocks in your watchlist and ₹1,00,000 to invest:
Each stock gets ₹20,000 (20% weight each).

If you have 10 stocks: each gets 10%.

EXAMPLE ON LIGHTNINBULL
Watchlist: LUPIN, ICICIGI, MARICO, BHARTIARTL, APOLLOHOSP
Equal Weight: 20% each → ₹20,000 in each stock.

PROS
• No complex math — easy to understand and execute.
• Works surprisingly well — research shows equal-weight portfolios outperform cap-weighted indices over the long term.
• Rebalancing is simple: just bring each back to equal after 2 weeks.

CONS
• Ignores volatility — a very volatile stock gets the same weight as a stable one.
• No diversification optimization — two similar stocks both get full weight.

WHEN TO USE
Use Equal Weight first to understand your watchlist's raw performance. Then compare with MVO to see if optimization adds value for your specific stock mix.`;

const REBALANCING_EXPLANATION = `LightninBull uses 3 rebalancing rules — all three run in parallel, whichever triggers first wins.

RULE 1 — TIME BASED (every 2 weeks)
Even if nothing dramatic happened, rebalance every 2 weeks. This keeps the portfolio aligned with the latest factor rankings. Stocks that drifted up get trimmed, stocks that fell get topped up — classic "buy low, sell high" discipline built into the process.

RULE 2 — LOSS BASED (portfolio falls 3%)
If your portfolio drops 3% from its last rebalance point, rebalance immediately. This forces a systematic review — are the stocks still in their factor buckets? Should some be replaced? It prevents riding bad positions too long.

RULE 3 — PROFIT BASED (portfolio gains 5%)
If the portfolio gains 5%, lock in some profits through rebalancing. This trims winners before they become overweight and concentrates your risk. Many retail investors hold winners too long — this rule enforces discipline.

WHY THESE NUMBERS (3% and 5%)
3% downside tolerance matches typical intraday swing + a buffer. 5% upside is roughly 2-3x the market's weekly move — a meaningful gain worth protecting.

Industry parallel: Most PMS and AIF (Alternative Investment Funds) in India use similar threshold-based rebalancing. It reduces emotional decision-making and systematic drift.`;

const WORKFLOW_EXPLANATION = `LightninBull follows a 6-step AI Quant Fund Manager workflow:

STEP 1 — STOCK DISCOVERY
The AI scans the Indian market universe (NSE TOP 200 F&O stocks) using 6 quantitative models: Momentum, Low Volatility, Value, Quality, Regime, and Range Bound.

STEP 2 — INTELLIGENT BUCKETS
Stocks are classified into factor buckets:
• Consistent Trending (momentum leaders)
• Slow Movement (low-vol steady movers)
• Cheap Value (fundamentally undervalued)
• Best Quality (high-quality businesses)
• Regime Upside / Downside (market-phase signals)
• Range Bound Upside / Downside (sideways opportunities)
• Aggressive Call / Put Option Stocks (derivative demand signals)

STEP 3 — ADD TO WATCHLIST
Select high-conviction stocks from any bucket and add them to your Watchlist. You can add top or bottom N stocks from any factor.

STEP 4 — PORTFOLIO BACKTEST
Test your watchlist using 3 strategies:
• Equal Weight (simple, 1 year historical simulation)
• MVO Weights (optimized allocation, max Sharpe)
• MVO Short (bearish optimized portfolio)
All benchmarked against NIFTY 50.

STEP 5 — RISK REBALANCING
Rebalance every 2 weeks, or when portfolio falls 3%, or gains 5%. This enforces discipline and prevents emotional decisions.

STEP 6 — MONITOR & IMPROVE
Track CAGR, Sharpe Ratio, Alpha, Max Drawdown vs NIFTY 50. Refine your factor selection over time.`;

const PLATFORM_EXPLANATION = `LightninBull is a Quant Intelligence Platform built for serious Indian market participants.

WHAT IT IS
A complete AI-driven Quant Fund Manager workflow — not just a screener. It covers stock discovery, intelligent classification, watchlist management, portfolio backtesting, and disciplined rebalancing.

WHAT IT COVERS
• Indian Equities (NSE TOP 200 F&O universe)
• Factor Research (Momentum, Value, Quality, Low Vol, Regime, Range Bound)
• Derivatives Intelligence (Aggressive Call/Put Option demand signals)
• Live Bull Call Spread and Bear Put Spread signals (intraday)
• Live Upside and Downside Trend Stock signals (intraday)
• Portfolio Backtest with NIFTY 50 benchmark comparison
• Retail allocation guide (₹10,000 to ₹100 crore)

WHO IT IS FOR
Indian traders and investors who want to move from gut-feel to systematic, data-driven decisions — like a professional quant fund but accessible to retail.`;

const FACTOR_DETAIL: Record<string, string> = {
  "Consistent Trending": `Consistent Trending identifies stocks with sustained price momentum across multiple timeframes (1W, 1M, 3M, 6M).

How it works: Stocks are ranked by how consistently they have been moving upward across short, medium, and long timeframes. A stock that is trending up across all 4 windows gets a high rank.

When to use: Bull markets, when broader indices are trending up. These stocks tend to continue their momentum for 2-6 weeks before mean-reverting.

Example of stocks in this bucket: Large-cap leaders with strong institutional buying across multiple sessions.`,

  "Slow Movement": `Slow Movement targets low-volatility stocks with strong risk-adjusted returns.

How it works: Ranks stocks by return-to-volatility ratio. A stock gaining 15% with 10% volatility scores better than one gaining 20% with 25% volatility.

When to use: All market conditions — low-vol stocks tend to hold up better in corrections and keep compounding steadily. This is the "sleep well at night" factor.

Industry parallel: The Low Volatility factor (popularised by Robeco, AQR, BlackRock) has outperformed global markets for decades. In India it works especially well because retail investors tend to chase high-volatility momentum stocks, leaving low-vol names underpriced.`,

  "Cheap Value": `Cheap Value screens for fundamentally undervalued stocks.

How it works: Combines valuation metrics (P/E, P/B, EV/EBITDA) with quality filters to avoid value traps. Only stocks with strong fundamentals at cheap prices qualify.

When to use: Market corrections, when high-quality stocks have sold off due to market sentiment rather than fundamentals.

Industry parallel: Classic Graham-Dodd value investing, modernised by AQR's Value factor research. Shown to outperform over 5-10 year horizons.`,

  "Best Quality": `Best Quality identifies high-quality businesses with strong balance sheets.

How it works: Screens for low debt, high return on equity, consistent earnings growth, and strong cash flows.

When to use: Defensive positioning — in uncertain or bear markets, quality stocks hold value better than speculative names.

Industry parallel: The Quality factor is used by most factor-based ETFs globally (iShares MSCI Quality, Invesco S&P 500 Quality). In India, NIFTY Quality 30 tracks similar criteria.`,

  "Regime Upside": `Regime Upside identifies bull-market leaders using market-regime-aware signals.

How it works: Detects the current market regime (bull/bear/sideways) and surfaces stocks that outperform during bullish phases — high beta, strong momentum, rising volumes.

When to use: When NIFTY and SENSEX are in uptrend, breadth is positive, FII buying is active.`,

  "Regime Downside": `Regime Downside surfaces stocks that perform in bearish market regimes.

How it works: Identifies stocks with negative beta, defensive characteristics, or sector rotation into safety — used for hedging or short positioning.

When to use: When broader indices are in downtrend, FII selling is heavy, or global risk-off is active.`,

  "Range Bound Upside": `Range Bound Upside finds mean-reversion long opportunities in sideways markets.

How it works: Identifies stocks trading near the bottom of their established price range with high probability of bouncing back to the middle or top of the range.

When to use: Sideways markets where indices are oscillating within a band. Works well when VIX is low and there is no strong directional trend.`,

  "Range Bound Downside": `Range Bound Downside finds mean-reversion short opportunities in sideways markets.

How it works: Identifies stocks near the top of their range that are likely to revert back down. Mirror of Range Bound Upside.

When to use: Same sideways conditions, used for hedging existing long positions or short trading.`,

  "Aggressive Call Option Stocks": `Aggressive Call Option Stocks shows stocks with unusually high Call option demand — a signal of institutional bullish positioning.

How it works: Monitors unusual open interest buildup, large block trades, and skew in Call options vs Put options. When institutions aggressively buy Calls, they are betting the stock will rise sharply.

When to use: Short-term directional trades. The derivative demand signal often precedes a sharp move in the underlying stock.`,

  "Aggressive Put Option Stocks": `Aggressive Put Option Stocks shows stocks with unusually high Put option demand — a signal of institutional bearish or hedging positioning.

How it works: Same as Aggressive Calls but for Puts. High Put buying signals that smart money expects a fall or is aggressively hedging a position.

When to use: Short-term defensive trades or identifying stocks to avoid in the near term.`,
};

// ─── Intent Parser ────────────────────────────────────────────────────────────

type Intent =
  | { type: "add_to_watchlist"; category: string; count: number; direction: "top" | "bottom" }
  | { type: "needs_category"; count: number; direction: "top" | "bottom" }
  | { type: "build_factor_portfolio" }
  | { type: "navigate"; tab: string }
  | { type: "explain_mvo" }
  | { type: "explain_equal_weight" }
  | { type: "explain_rebalancing" }
  | { type: "explain_workflow" }
  | { type: "explain_platform" }
  | { type: "explain_alpha" }
  | { type: "explain_factor"; factor: string }
  | { type: "explain_metric"; metric: string }
  | { type: "list_factors" }
  | { type: "unknown" };

function parseIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();

  // ── Add to watchlist ───────────────────────────────────────────────────────
  const wantsAdd =
    /\badd\b/.test(lower) ||
    (/\btake\b|\bgrab\b|\bpick\b|\bfetch\b/.test(lower) && /\bstock|\bfrom\b|\ball\b|\btop\b|\bbottom\b/.test(lower)) ||
    (/\bwatchlist\b/.test(lower) && /\bfrom\b|\btop\b|\bbottom\b|\bstock/.test(lower));

  if (wantsAdd) {
    const direction: "top" | "bottom" = /\bbottom\b/.test(lower) ? "bottom" : "top";
    const count = extractNumber(lower) ?? 5;
    const category = matchCategory(lower);
    if (category) return { type: "add_to_watchlist", category, count, direction };
    return { type: "needs_category", count, direction };
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  const wantsNav = /\b(show|open|go to|take me|view|navigate|see)\b/.test(lower);

  if (wantsNav) {
    if (/\bwatchlist\b/.test(lower)) return { type: "navigate", tab: "Watchlist" };
    if (/\bbull.?call\b/.test(lower)) return { type: "navigate", tab: "Bull Call Spreads" };
    if (/\bbear.?put\b/.test(lower)) return { type: "navigate", tab: "Bear Put Spreads" };
    if (/\bbacktest\b|\bback.test\b|\bportfolio\b/.test(lower)) return { type: "navigate", tab: "Portfolio Backtest" };
    if (/\bupside.trend\b/.test(lower)) return { type: "navigate", tab: "Upside Trend Stocks" };
    if (/\bdownside.trend\b/.test(lower)) return { type: "navigate", tab: "Downside Trend Stocks" };
    const category = matchCategory(lower);
    if (category) return { type: "navigate", tab: category };
  }

  if (/\bbacktest\b/.test(lower) && !wantsNav) return { type: "navigate", tab: "Portfolio Backtest" };

  // ── Build factor portfolio (multi-step guided workflow) ───────────────────
  if (/\bfactor\b/.test(lower) && /\bportfolio\b|\bbacktest\b/.test(lower))
    return { type: "build_factor_portfolio" };

  // ── "run/build/create mvo / equal weight / backtest / portfolio" → navigate ──
  const wantsRun = /\brun\b|\bstart\b|\bdo\b|\bexecute\b|\blaunch\b|\bbuild\b|\bcreate\b/.test(lower);
  if (wantsRun && (/\bmvo\b|\bequal.weight\b|\bbacktest\b|\bportfolio\b/.test(lower)))
    return { type: "navigate", tab: "Portfolio Backtest" };

  // ── MVO (explain, not run) ─────────────────────────────────────────────────
  if (/\bmvo\b|\bmean.varian|\bmarkowitz|\boptimiz|\bmodern portfolio/.test(lower))
    return { type: "explain_mvo" };

  // ── Equal Weight (explain, not run) ───────────────────────────────────────
  if (/\bequal.weight\b|\bequal weight/.test(lower))
    return { type: "explain_equal_weight" };

  // ── Rebalancing ────────────────────────────────────────────────────────────
  if (/\brebalanc|\b2.?week|\bthreshold\b|\b3.?%\b|\b5.?%\b/.test(lower) &&
      /\bwhat|how|when|why|explain/.test(lower))
    return { type: "explain_rebalancing" };

  // ── Specific metric questions ──────────────────────────────────────────────
  for (const [key] of Object.entries(METRIC_KNOWLEDGE)) {
    if (lower.includes(key)) return { type: "explain_metric", metric: key };
  }

  // ── Specific factor questions ──────────────────────────────────────────────
  for (const [factorName] of Object.entries(FACTOR_DETAIL)) {
    if (lower.includes(factorName.toLowerCase()))
      return { type: "explain_factor", factor: factorName };
  }

  // ── Workflow ───────────────────────────────────────────────────────────────
  if (/\bworkflow\b|\bhow does.+work|\bstep.by.step|\bprocess/.test(lower))
    return { type: "explain_workflow" };

  // ── Alpha engine / signals ─────────────────────────────────────────────────
  if (/\balpha.engine|\bsignal\b|\bhow.+rank|\bscor(e|ing)|\bquant.model/.test(lower))
    return { type: "explain_alpha" };

  // ── Platform overview ──────────────────────────────────────────────────────
  if (/\bwhat is lightninbull|\bwhat is this|\babout this|\bplatform\b/.test(lower))
    return { type: "explain_platform" };

  // ── Factor/bucket list ─────────────────────────────────────────────────────
  if (/\bfactor|\bcategor|\bbucket|\blist\b/.test(lower) && /\bwhat|\bshow|\blist\b|\ball\b/.test(lower))
    return { type: "list_factors" };

  // ── Generic help ──────────────────────────────────────────────────────────
  if (/\bwhat can|\bhelp\b|\bwhat do you|\bcan you\b/.test(lower))
    return { type: "explain_platform" };

  // ── Factor-only input (no add/show verb) — treat as nav ───────────────────
  const category = matchCategory(lower);
  if (category) return { type: "navigate", tab: category };

  return { type: "unknown" };
}

// Split "add X and run Y" into [intentX, intentY] and parse each independently.
// Handles "and", "then", "also", "after that".
function parseCompoundIntents(text: string): Intent[] {
  const SPLITTER = /\band\b|\bthen\b|\balso\b|\bafter that\b|\bafter adding\b/i;
  const parts = text.split(SPLITTER).map((s) => s.trim()).filter(Boolean);

  if (parts.length <= 1) return [parseIntent(text)];

  const intents = parts.map((part) => parseIntent(part));

  // Deduplicate: if two parts resolve to the same intent type+tab, keep first
  const seen = new Set<string>();
  return intents.filter((intent) => {
    const key = intent.type === "navigate"
      ? `navigate:${intent.tab}`
      : intent.type;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Static Responses ─────────────────────────────────────────────────────────

const ALPHA_EXPLANATION = `LightninBull's alpha engine uses 6 quantitative models, each independently ranking the NSE TOP 200 F&O universe:

• Consistent Trending — Sustained momentum across 1W, 1M, 3M, 6M timeframes.
• Slow Movement — Highest return-to-volatility ratio. Smooth, steady compounders.
• Cheap Value — Fundamentally undervalued stocks screened to avoid value traps.
• Best Quality — Low debt, high ROE, consistent earnings, strong cash flows.
• Regime — Market-phase-aware: Upside signals in bull regimes, Downside in bear regimes.
• Range Bound — Mean-reversion longs and shorts for sideways markets.
• Derivatives Intelligence — Aggressive Call/Put demand signals from options flow.

Each model scores stocks 0–100. The Watchlist + Portfolio Backtest workflow lets you test whether the scores translated into real alpha vs NIFTY 50.`;

const FACTOR_LIST = `All 10 factor buckets on LightninBull:

1. Consistent Trending — momentum leaders, 1W-6M timeframe
2. Slow Movement — low-volatility steady compounders
3. Cheap Value — fundamentally undervalued stocks
4. Best Quality — high-quality, low-debt businesses
5. Regime Upside — bull-phase market leaders
6. Regime Downside — bear-phase or defensive signals
7. Range Bound Upside — mean-reversion longs (sideways market)
8. Range Bound Downside — mean-reversion shorts (sideways market)
9. Aggressive Call Option Stocks — institutional bullish derivative demand
10. Aggressive Put Option Stocks — institutional bearish derivative demand

Ask me to explain any factor in detail, e.g. "What is Slow Movement?"
Or: "Add top 5 [factor] to watchlist"`;

const UNKNOWN_RESPONSE = `I didn't quite catch that. Here's what I can help with:

• Add stocks — "Add top 5 Slow Movement to watchlist"
• Explain strategies — "What is MVO?" / "What is Equal Weight?"
• Explain metrics — "What is Sharpe Ratio?" / "What is CAGR?" / "What is Max Drawdown?"
• Explain factors — "What is Consistent Trending?" / "Explain Regime Upside"
• Explain workflow — "How does LightninBull work?"
• Navigate — "Show Bull Call Spreads" / "Open Portfolio Backtest"
• Rebalancing — "When should I rebalance?"
• Platform — "What is LightninBull?"`;

// ─── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  "Build factor based portfolio",
  "What is MVO?",
  "Add top 5 Consistent Trending to watchlist",
  "Add top 5 Slow Movement to watchlist",
  "What is Sharpe Ratio?",
  "Open Portfolio Backtest",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

// Remembers an incomplete intent while waiting for the user's next reply
type PendingState =
  | { type: "awaiting_category"; count: number; direction: "top" | "bottom" }
  | { type: "awaiting_strategy" }
  | null;

interface AiMarketMentorProps {
  onNavigate: (tab: string) => void;
  starredSymbols: string[];
  onBulkAddToWatchlist: (symbols: string[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

let msgId = 0;

const AiMarketMentor: React.FC<AiMarketMentorProps> = ({
  onNavigate,
  starredSymbols,
  onBulkAddToWatchlist,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: ++msgId,
      role: "assistant",
      content:
        "I can help with Lightnin Bull dashboard knowledge, watchlist actions, portfolio backtests, live spreads, and intraday signals.\n\nTry asking:\n• Add top 10 Regime Upside stocks to my watchlist\n• Run equal weight backtest\n• Show live Bull Call Spread\n• Explain the alpha engine",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingState>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, messages]);

  const pushMsg = (role: Message["role"], content: string, isError = false) => {
    setMessages((prev) => [...prev, { id: ++msgId, role, content, isError }]);
  };

  const executeAddToWatchlist = async (
    category: string,
    count: number,
    direction: "top" | "bottom" = "top"
  ) => {
    const isAll = count === ALL_STOCKS_SENTINEL;
    const label = direction === "bottom" ? "bottom" : "top";
    pushMsg("assistant", `Fetching ${isAll ? "all" : `${label} ${count}`} stocks from "${category}"…`);

    let result;
    try {
      result = await fetchStocksByCategory(category);
    } catch {
      pushMsg(
        "assistant",
        `Could not load stocks for "${category}". Please try again later.`,
        true
      );
      return;
    }

    const sorted = (result.stocks ?? []).sort((a, b) => a.rank - b.rank);
    const selected = count === ALL_STOCKS_SENTINEL
      ? sorted                                   // entire list
      : direction === "bottom"
        ? sorted.slice(-count)                   // last N = lowest ranked
        : sorted.slice(0, count);                // first N = highest ranked
    const top = selected
      .map((s) => s.symbol.toUpperCase().trim())
      .filter(looksLikeTicker);

    if (top.length === 0) {
      pushMsg("assistant", `No stocks found in "${category}".`);
      return;
    }

    const alreadyInWatchlist = top.filter((s) =>
      starredSymbols.map((x) => x.toUpperCase()).includes(s)
    );
    const toAdd = top.filter(
      (s) => !starredSymbols.map((x) => x.toUpperCase()).includes(s)
    );

    for (const symbol of toAdd) {
      await addWatchlistSymbol(symbol);
    }
    onBulkAddToWatchlist(toAdd);

    let reply = "";
    if (toAdd.length > 0) {
      reply += `Added ${toAdd.length} stock${toAdd.length > 1 ? "s" : ""} from "${category}" to your watchlist:\n${toAdd.join(", ")}`;
    }
    if (alreadyInWatchlist.length > 0) {
      reply += `\n\nAlready in watchlist: ${alreadyInWatchlist.join(", ")}`;
    }
    pushMsg("assistant", reply || "All selected stocks were already in your watchlist.");
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setInput("");
    pushMsg("user", trimmed);
    setBusy(true);

    try {
      // ── Pending: user is answering "which factor?" ────────────────────────
      if (pending?.type === "awaiting_category") {
        const category = matchCategory(trimmed.toLowerCase());
        if (category) {
          setPending(null);
          await executeAddToWatchlist(category, pending.count, pending.direction);
        } else {
          pushMsg(
            "assistant",
            `I still couldn't identify a factor from "${trimmed}".\n\nAvailable buckets:\nConsistent Trending · Slow Movement · Cheap Value · Best Quality · Regime Upside · Regime Downside · Range Bound Upside · Range Bound Downside · Aggressive Call Options · Aggressive Put Options\n\nWhich one would you like?`
          );
        }
        return;
      }

      // ── Pending: user is choosing Equal Weight or MVO ─────────────────────
      if (pending?.type === "awaiting_strategy") {
        const lower = trimmed.toLowerCase();
        if (/\bmvo\b|\bmean.varian|\boptimiz/.test(lower)) {
          setPending(null);
          pushMsg("assistant", 'Perfect! Opening Portfolio Backtest — select "MVO Weights" to run the optimization.');
          setTimeout(() => onNavigate("Portfolio Backtest"), 400);
        } else if (/\bequal.weight\b|\bequal\b|\bsimple\b/.test(lower)) {
          setPending(null);
          pushMsg("assistant", 'Perfect! Opening Portfolio Backtest — select "Equal Weight" to run the backtest.');
          setTimeout(() => onNavigate("Portfolio Backtest"), 400);
        } else {
          pushMsg(
            "assistant",
            "Please choose your backtest strategy:\n\n• **Equal Weight** — simple equal allocation across all stocks\n• **MVO Weights** — mathematically optimized allocation (maximizes Sharpe Ratio)"
          );
        }
        return;
      }

      // ── Parse one or more intents (compound: "add X and run Y") ─────────────
      const intents = parseCompoundIntents(trimmed);

      // If any intent needs clarification (missing category), drop navigate intents
      // from the batch — don't open Portfolio Backtest while mid-conversation.
      const hasPendingClarification = intents.some((i) => i.type === "needs_category");
      const filteredIntents = hasPendingClarification
        ? intents.filter((i) => i.type !== "navigate")
        : intents;

      for (const intent of filteredIntents) {
        switch (intent.type) {
          case "add_to_watchlist":
            await executeAddToWatchlist(intent.category, intent.count, intent.direction);
            break;

          case "build_factor_portfolio": {
            const coreFactors = [
              "Consistent Trending",
              "Slow Movement",
              "Cheap Value",
              "Best Quality",
            ];
            const PER_FACTOR = 5;
            pushMsg("assistant", "Building your factor portfolio — fetching top 5 stocks from each of the 4 core factors…");

            const summary: string[] = [];
            for (const factor of coreFactors) {
              try {
                const result = await fetchStocksByCategory(factor);
                const sorted = [...(result.stocks ?? [])].sort((a, b) => a.rank - b.rank);
                const symbols = sorted.slice(0, PER_FACTOR)
                  .map((s) => s.symbol.toUpperCase().trim())
                  .filter(looksLikeTicker);

                const alreadyIn = symbols.filter((s) =>
                  starredSymbols.map((x) => x.toUpperCase()).includes(s)
                );
                const toAdd = symbols.filter(
                  (s) => !starredSymbols.map((x) => x.toUpperCase()).includes(s)
                );

                for (const sym of toAdd) {
                  await addWatchlistSymbol(sym);
                }
                onBulkAddToWatchlist(toAdd);

                const note = alreadyIn.length > 0 ? ` (${alreadyIn.length} already in watchlist)` : "";
                summary.push(`• ${factor}: ${symbols.join(", ")}${note}`);
              } catch {
                summary.push(`• ${factor}: could not load`);
              }
            }

            setPending({ type: "awaiting_strategy" });
            pushMsg(
              "assistant",
              `Factor portfolio ready!\n\n${summary.join("\n")}\n\nWhich strategy would you like to backtest?\n\n• **Equal Weight** — equal allocation across all stocks\n• **MVO Weights** — optimized allocation for maximum Sharpe Ratio\n\nJust say "Equal Weight" or "MVO".`
            );
            break;
          }

          case "needs_category": {
            const countWord = intent.count === 5 ? "stocks" : `${intent.count} stock${intent.count > 1 ? "s" : ""}`;
            setPending({ type: "awaiting_category", count: intent.count, direction: intent.direction });
            pushMsg(
              "assistant",
              `Sure! I'll add ${countWord} once you tell me which factor bucket.\n\nChoose one:\nConsistent Trending · Slow Movement · Cheap Value · Best Quality · Regime Upside · Regime Downside · Range Bound Upside · Range Bound Downside · Aggressive Call Options · Aggressive Put Options`
            );
            break;
          }

          case "navigate":
            pushMsg("assistant", `Opening "${intent.tab}"…`);
            setTimeout(() => onNavigate(intent.tab), 400);
            break;

          case "explain_mvo":
            pushMsg("assistant", MVO_EXPLANATION);
            break;

          case "explain_equal_weight":
            pushMsg("assistant", EQUAL_WEIGHT_EXPLANATION);
            break;

          case "explain_rebalancing":
            pushMsg("assistant", REBALANCING_EXPLANATION);
            break;

          case "explain_workflow":
            pushMsg("assistant", WORKFLOW_EXPLANATION);
            break;

          case "explain_platform":
            pushMsg("assistant", PLATFORM_EXPLANATION);
            break;

          case "explain_alpha":
            pushMsg("assistant", ALPHA_EXPLANATION);
            break;

          case "explain_factor":
            pushMsg("assistant", FACTOR_DETAIL[intent.factor] ?? `${intent.factor} is one of LightninBull's factor buckets. Ask me to "Add top 5 ${intent.factor} to watchlist" to explore it.`);
            break;

          case "explain_metric":
            pushMsg("assistant", METRIC_KNOWLEDGE[intent.metric] ?? `${intent.metric} is a portfolio performance metric shown in the Portfolio Backtest section.`);
            break;

          case "list_factors":
            pushMsg("assistant", FACTOR_LIST);
            break;

          default:
            if (intents.length === 1) pushMsg("assistant", UNKNOWN_RESPONSE);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend(input);
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 9999,
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #facc15, #d6a21f)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(250,204,21,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
        aria-label="Open Lightnin Bull AI Agent"
        title="Lightnin Bull AI Agent"
      >
        {open ? "✕" : "⚡"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 94,
            right: 28,
            zIndex: 9998,
            width: 360,
            maxHeight: "72vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: 8,
            overflow: "hidden",
            background: "rgba(8,9,12,0.97)",
            border: "1px solid rgba(250,204,21,0.22)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.03)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(250,204,21,0.04)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 9,
                letterSpacing: 4,
                color: "rgba(250,204,21,0.75)",
                marginBottom: 4,
              }}
            >
              AI MARKET MENTOR
            </div>
            <div
              style={{
                fontFamily: "var(--font-sans, sans-serif)",
                fontSize: 15,
                fontWeight: 600,
                color: "#f7f0df",
              }}
            >
              Lightnin Bull AI Agent
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "84%",
                    padding: "10px 14px",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #facc15, #d6a21f)"
                        : msg.isError
                        ? "rgba(239,68,68,0.12)"
                        : "rgba(255,255,255,0.06)",
                    color: msg.role === "user" ? "#050608" : msg.isError ? "#f87171" : "#e5ddc5",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    border:
                      msg.role === "assistant"
                        ? msg.isError
                          ? "1px solid rgba(239,68,68,0.22)"
                          : "1px solid rgba(255,255,255,0.07)"
                        : "none",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {busy && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px 14px 14px 4px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  Thinking…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          <div
            style={{
              padding: "8px 12px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => handleSend(action)}
                disabled={busy}
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: "1px solid rgba(250,204,21,0.28)",
                  background: "rgba(250,204,21,0.05)",
                  color: "#facc15",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  cursor: busy ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: busy ? 0.5 : 1,
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  if (!busy) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(250,204,21,0.14)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(250,204,21,0.05)";
                }}
              >
                {action}
              </button>
            ))}
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px 14px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              placeholder="Type or tap mic: run MVO backtest…"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid rgba(250,204,21,0.18)",
                background: "rgba(255,255,255,0.04)",
                color: "#f7f0df",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 12,
                outline: "none",
              }}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={busy || !input.trim()}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                border: "none",
                background:
                  busy || !input.trim()
                    ? "rgba(250,204,21,0.18)"
                    : "linear-gradient(135deg, #facc15, #d6a21f)",
                color: busy || !input.trim() ? "rgba(255,255,255,0.3)" : "#050608",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 11,
                fontWeight: 600,
                cursor: busy || !input.trim() ? "not-allowed" : "pointer",
                transition: "all 0.18s ease",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AiMarketMentor;
