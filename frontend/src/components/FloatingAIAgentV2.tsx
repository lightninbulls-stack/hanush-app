import React, { useMemo, useRef, useState } from "react";
import { findKnowledgeAnswer, getKnowledgeOverview } from "./aiKnowledge";
import {
  addWatchlistSymbols,
  clearWatchlistSymbols,
  fetchWatchlistSymbols,
  removeWatchlistSymbols,
  runWatchlistBacktest,
  type PortfolioBacktestResponse,
} from "../services/watchlistApi";

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

type ChatRole = "user" | "assistant";
type StrategyType = "equal_weight" | "mvo" | "mvo_short";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type StockRow = {
  symbol?: string;
  ticker?: string;
  sector?: string;
  score?: number;
  strength?: number;
};

type StockCategoryResponse = {
  category?: string;
  stocks?: StockRow[];
};

type SpreadLeg = {
  side?: string | null;
  trading_symbol?: string | null;
  avg_price?: number | null;
  ltp?: number | null;
  pnl?: number | null;
  quantity?: number | null;
  strike?: number | null;
  expiry?: string | null;
  right?: string | null;
  status?: string | null;
  entry_time?: string | null;
};

type IntradaySpread = {
  index?: string;
  spread_type?: string;
  strategy_name?: string;
  status?: string;
  ui_state?: string;
  message?: string;
  net_pnl?: number;
  stop_loss?: number;
  target?: number;
  updated_at?: string;
  updated_at_ist?: string;
  entry_time?: string | null;
  legs?: SpreadLeg[];
  signals?: any[];
  entered_count?: number;
  total_count?: number;
};

type IntradaySpreadMap = Record<string, IntradaySpread>;

const FACTOR_CATEGORIES = [
  "Consistent Trending",
  "Slow Movement",
  "Cheap Value",
  "Best Quality",
];

const ALL_STOCK_BUCKETS = [
  ...FACTOR_CATEGORIES,
  "Regime Upside",
  "Regime Downside",
  "Range Bound Upside",
  "Range Bound Downside",
  "Aggressive Call Option Stocks",
  "Aggressive Put Option Stocks",
];

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I am your Lightnin Bull AI Agent. You can type or use the mic. Ask me to add stocks to watchlist, run equal-weight/MVO backtests, explain the dashboard, or show live spreads.",
};

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

function safeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown): string {
  const parsed = safeNumber(value);
  return parsed === null ? "--" : parsed.toFixed(2);
}

function formatPercent(value: unknown): string {
  const parsed = safeNumber(value);
  return parsed === null ? "--" : `${parsed.toFixed(2)}%`;
}

function formatNumber(value: unknown): string {
  const parsed = safeNumber(value);
  return parsed === null ? "--" : parsed.toFixed(2);
}

function normalizeSymbol(symbol: unknown): string {
  return String(symbol || "").trim().toUpperCase();
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isVoiceSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

function extractTopCount(message: string): number {
  const digitMatch = message.match(/top\s+(\d+)/i);
  if (digitMatch?.[1]) return Math.max(1, Math.min(Number(digitMatch[1]), 50));

  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  for (const [word, value] of Object.entries(wordMap)) {
    if (message.includes(`top ${word}`)) return value;
  }

  return 5;
}

function pickCategory(message: string): string | null {
  if (message.includes("regime upside") || message.includes("upside stocks") || message.includes("momentum stocks")) return "Regime Upside";
  if (message.includes("regime downside") || message.includes("downside stocks")) return "Regime Downside";
  if (message.includes("consistent trending") || message.includes("trending stocks")) return "Consistent Trending";
  if (message.includes("slow movement")) return "Slow Movement";
  if (message.includes("cheap value") || message.includes("value stocks")) return "Cheap Value";
  if (message.includes("best quality") || message.includes("quality stocks")) return "Best Quality";
  if (message.includes("range bound upside")) return "Range Bound Upside";
  if (message.includes("range bound downside")) return "Range Bound Downside";
  if (message.includes("aggressive call")) return "Aggressive Call Option Stocks";
  if (message.includes("aggressive put")) return "Aggressive Put Option Stocks";
  return null;
}

function pickWatchlistCategories(message: string): string[] {
  const categories = new Set<string>();

  if (message.includes("factor") || message.includes("factors")) {
    FACTOR_CATEGORIES.forEach((category) => categories.add(category));
  }

  if (message.includes("all bucket") || message.includes("all stock bucket") || message.includes("all categories")) {
    ALL_STOCK_BUCKETS.forEach((category) => categories.add(category));
  }

  for (const category of ALL_STOCK_BUCKETS) {
    if (message.includes(category.toLowerCase())) categories.add(category);
  }

  const singleCategory = pickCategory(message);
  if (singleCategory) categories.add(singleCategory);

  return Array.from(categories);
}

function pickBacktestStrategy(message: string): StrategyType | null {
  const asksBacktest =
    message.includes("backtest") ||
    message.includes("portfolio test") ||
    message.includes("run test") ||
    message.includes("simulate");

  if (!asksBacktest) return null;
  if (message.includes("mvo short") || message.includes("short mvo")) return "mvo_short";
  if (message.includes("mvo") || message.includes("mean variance") || message.includes("mean-variance")) return "mvo";
  if (message.includes("equal weight") || message.includes("equal-weight") || message.includes("equal weights")) return "equal_weight";
  return "equal_weight";
}

function strategyLabel(strategyType: StrategyType): string {
  if (strategyType === "mvo") return "MVO Weights";
  if (strategyType === "mvo_short") return "MVO Short";
  return "Equal Weight";
}

async function fetchStocksByCategoryForAI(category: string): Promise<StockRow[]> {
  const response = await fetch(`${API_BASE_URL}/stocks/${encodeURIComponent(category)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Failed to fetch ${category}: ${response.status}`);

  const data = (await response.json()) as StockCategoryResponse;
  return Array.isArray(data?.stocks) ? data.stocks : [];
}

async function fetchTopSymbolsFromCategories(categories: string[], topN: number) {
  const rows = await Promise.all(
    categories.map(async (category) => {
      const stocks = await fetchStocksByCategoryForAI(category);
      const symbols = stocks
        .slice(0, topN)
        .map((stock) => normalizeSymbol(stock.symbol || stock.ticker))
        .filter(Boolean);
      return { category, symbols };
    })
  );

  const allSymbols = Array.from(new Set(rows.flatMap((row) => row.symbols)));
  return { rows, allSymbols };
}

function extractManualSymbols(question: string): string[] {
  const cleaned = question
    .replace(/add|remove|delete|from|to|my|the|watchlist|stock|stocks|symbol|symbols|please|top|five|four|three|two|one|ten|\d+/gi, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ");

  return Array.from(
    new Set(
      cleaned
        .split(/\s+/)
        .map((item) => normalizeSymbol(item))
        .filter((item) => item.length >= 2 && item.length <= 15)
    )
  );
}

async function answerFromWatchlistAction(question: string): Promise<string | null> {
  const message = question.toLowerCase().trim();
  const isAdd = message.includes("add") && message.includes("watchlist");
  const isRemove = (message.includes("remove") || message.includes("delete")) && message.includes("watchlist");
  const isClear = (message.includes("clear") || message.includes("empty")) && message.includes("watchlist");

  if (!isAdd && !isRemove && !isClear) return null;

  if (isClear) {
    await clearWatchlistSymbols();
    return "Done. I cleared your watchlist.";
  }

  const topN = extractTopCount(message);
  const categories = pickWatchlistCategories(message);

  if (categories.length > 0) {
    const { rows, allSymbols } = await fetchTopSymbolsFromCategories(categories, topN);

    if (allSymbols.length === 0) {
      return `I found the requested buckets, but there were no stocks available to ${isAdd ? "add" : "remove"}.`;
    }

    const before = await fetchWatchlistSymbols();
    const after = isAdd ? await addWatchlistSymbols(allSymbols) : await removeWatchlistSymbols(allSymbols);

    const beforeSet = new Set(before.map(normalizeSymbol));
    const afterSet = new Set(after.map(normalizeSymbol));

    const changedSymbols = isAdd
      ? allSymbols.filter((symbol) => !beforeSet.has(symbol))
      : allSymbols.filter((symbol) => !afterSet.has(symbol));

    const lines = [
      isAdd
        ? `Done. I added ${changedSymbols.length} new stock(s) to your watchlist.`
        : `Done. I removed ${changedSymbols.length} stock(s) from your watchlist.`,
      "",
      `Requested top ${topN} from: ${categories.join(", ")}`,
      "",
      "Bucket-wise symbols:",
    ];

    rows.forEach((row) => lines.push(`- ${row.category}: ${row.symbols.join(", ") || "No stocks"}`));
    lines.push("", `Current watchlist count: ${after.length}`);
    return lines.join("\n");
  }

  const manualSymbols = extractManualSymbols(question);
  if (manualSymbols.length === 0) {
    return "I understood the watchlist action, but I could not identify the stocks or buckets. Try: add top 5 Regime Upside stocks to my watchlist.";
  }

  const before = await fetchWatchlistSymbols();
  const after = isAdd ? await addWatchlistSymbols(manualSymbols) : await removeWatchlistSymbols(manualSymbols);

  return [
    isAdd
      ? `Done. I added these symbols to your watchlist: ${manualSymbols.join(", ")}`
      : `Done. I removed these symbols from your watchlist: ${manualSymbols.join(", ")}`,
    `Before count: ${before.length}`,
    `Current watchlist count: ${after.length}`,
  ].join("\n");
}

function summarizeBacktestResult(result: PortfolioBacktestResponse, strategyType: StrategyType): string {
  const metrics = result.metrics || {};
  const benchmark = result.benchmark_metrics || null;
  const holdings = Array.isArray(result.holdings) ? result.holdings : [];

  const lines = [
    `Portfolio Backtest — ${strategyLabel(strategyType)}`,
    "",
    `Requested symbols: ${result.requested_symbols?.length || 0}`,
    `Matched symbols: ${result.matched_symbols?.length || 0}`,
    "",
    "Portfolio metrics:",
    `- CAGR: ${formatPercent(metrics.cagr_pct ?? metrics.annualised_return_pct)}`,
    `- Total Return: ${formatPercent(metrics.cumulative_return_pct ?? metrics.total_return_pct)}`,
    `- Sharpe: ${formatNumber(metrics.sharpe ?? metrics.sharpe_ratio)}`,
    `- Sortino: ${formatNumber(metrics.sortino_ratio)}`,
    `- Volatility: ${formatPercent(metrics.annualized_volatility_pct ?? metrics.volatility_pct)}`,
    `- Max Drawdown: ${formatPercent(metrics.max_drawdown_pct)}`,
    `- 1M Return: ${formatPercent(metrics.return_1m_pct)}`,
    `- 3M Return: ${formatPercent(metrics.return_3m_pct)}`,
    `- 6M Return: ${formatPercent(metrics.return_6m_pct)}`,
  ];

  if (benchmark) {
    const alpha =
      safeNumber(metrics.cagr_pct) !== null && safeNumber(benchmark.cagr_pct) !== null
        ? (safeNumber(metrics.cagr_pct) || 0) - (safeNumber(benchmark.cagr_pct) || 0)
        : null;
    const sharpeSpread =
      safeNumber(metrics.sharpe) !== null && safeNumber(benchmark.sharpe) !== null
        ? (safeNumber(metrics.sharpe) || 0) - (safeNumber(benchmark.sharpe) || 0)
        : null;

    lines.push(
      "",
      `Benchmark: ${result.benchmark_name || "NIFTY 50"}`,
      `- Benchmark CAGR: ${formatPercent(benchmark.cagr_pct)}`,
      `- Benchmark Sharpe: ${formatNumber(benchmark.sharpe)}`,
      `- Alpha vs benchmark: ${formatPercent(alpha)}`,
      `- Sharpe spread: ${formatNumber(sharpeSpread)}`
    );
  }

  if (holdings.length > 0) {
    lines.push("", "Top holdings / weights:");
    holdings.slice(0, 10).forEach((holding) => {
      lines.push(
        `- ${holding.symbol}: ${(Number(holding.weight || 0) * 100).toFixed(2)}% | Return: ${formatPercent(holding.total_return_pct)}`
      );
    });
  }

  lines.push(
    "",
    "Interpretation: use this as research output. Recheck the dashboard chart and holdings before making any allocation decision."
  );

  return lines.join("\n");
}

async function answerFromBacktestAction(question: string): Promise<string | null> {
  const message = question.toLowerCase().trim();
  const strategyType = pickBacktestStrategy(message);

  if (!strategyType) return null;

  const symbols = await fetchWatchlistSymbols();
  if (!symbols.length) {
    return "I can run the backtest, but your watchlist is empty. First ask me: add top 10 Regime Upside stocks to my watchlist.";
  }

  const result = await runWatchlistBacktest(symbols, strategyType);
  return summarizeBacktestResult(result, strategyType);
}

async function fetchAllIntradaySpreads(): Promise<IntradaySpreadMap> {
  const response = await fetch(`${API_BASE_URL}/api/intraday-spreads/all`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Failed to fetch intraday spread data: ${response.status}`);

  const json = await response.json();
  return (json?.data || {}) as IntradaySpreadMap;
}

function pickSpreadPayload(allSpreads: IntradaySpreadMap, keys: string[], spreadType: string): IntradaySpread | null {
  for (const key of keys) if (allSpreads[key]) return allSpreads[key];
  return (
    Object.values(allSpreads).find(
      (spread) => String(spread?.spread_type || "").toLowerCase() === spreadType.toLowerCase()
    ) || null
  );
}

function formatLegLine(leg: SpreadLeg, index: number): string {
  const side = leg.side || `LEG ${index + 1}`;
  const symbol = leg.trading_symbol || "Symbol not available";
  const strike = leg.strike ?? "--";
  const right = leg.right || "--";
  const qty = leg.quantity ?? "--";
  const entry = formatMoney(leg.avg_price);
  const ltp = formatMoney(leg.ltp);
  const pnl = formatMoney(leg.pnl);
  const status = leg.status || "--";
  const expiry = leg.expiry || "--";

  return `- ${side} ${symbol} | ${right} ${strike} | Expiry: ${expiry} | Qty: ${qty} | Entry: ${entry} | LTP: ${ltp} | P&L: ${pnl} | Status: ${status}`;
}

function buildSpreadExplanation(label: string, payload: IntradaySpread | null, conceptText: string): string {
  if (!payload) {
    return `${label}\n\n${conceptText}\n\nNo live ${label} payload is available right now. The strategy may be waiting for a signal, booting, or market data may be inactive.`;
  }

  const legs = Array.isArray(payload.legs) ? payload.legs.filter(Boolean) : [];
  const lines = [
    `${label}\n`,
    conceptText,
    "",
    "Live Lightnin Bull spread status:",
    `- Index: ${payload.index || "--"}`,
    `- Strategy: ${payload.strategy_name || "--"}`,
    `- Status: ${payload.status || payload.ui_state || "WAITING"}`,
    `- Message: ${payload.message || "No message"}`,
    `- Entry Time: ${payload.entry_time || "--"}`,
    `- Net P&L: ${formatMoney(payload.net_pnl)}`,
    `- Stop Loss: ${formatMoney(payload.stop_loss)}`,
    `- Target: ${formatMoney(payload.target)}`,
    `- Updated At: ${payload.updated_at_ist || payload.updated_at || "--"}`,
  ];

  if (legs.length > 0) {
    lines.push("", "Live legs:");
    legs.forEach((leg, index) => lines.push(formatLegLine(leg, index)));
  } else {
    lines.push("", "No live legs are available yet. This usually means the strategy has not entered a spread position yet.");
  }

  lines.push("", "Interpretation: use this as live strategy monitoring, not a guaranteed trade recommendation. Watch entry, LTP, net P&L, stop loss, and target together.");
  return lines.join("\n");
}

async function answerFromOptionSpread(message: string): Promise<string | null> {
  const wantsBullCall = message.includes("bull call") || message.includes("call spread") || message.includes("bullish spread");
  const wantsBearPut = message.includes("bear put") || message.includes("put spread") || message.includes("bearish spread");
  const asksLive = ["live", "current", "legs", "strike", "pnl", "p&l", "ltp", "stop loss", "target", "status", "explain"].some((word) => message.includes(word));

  if ((!wantsBullCall && !wantsBearPut) || !asksLive) return null;

  const allSpreads = await fetchAllIntradaySpreads();

  if (wantsBullCall) {
    const payload = pickSpreadPayload(
      allSpreads,
      ["ALPHA_BULL_PAPER", "ALPHA_BULL_SENSEX_PAPER", "SENSEX_ALPHA_BULL_PAPER"],
      "bull_call"
    );

    return buildSpreadExplanation(
      "Bull Call Spread",
      payload,
      "A Bull Call Spread is a controlled-risk bullish option strategy. Lightnin Bull buys a lower-strike call and sells a higher-strike call, so both risk and reward are capped."
    );
  }

  const payload = pickSpreadPayload(
    allSpreads,
    ["ALPHA_BEAR_PAPER", "ALPHA_BEAR_SENSEX_PAPER", "SENSEX_ALPHA_BEAR_PAPER"],
    "put_debit"
  );

  return buildSpreadExplanation(
    "Bear Put Spread",
    payload,
    "A Bear Put Spread is a controlled-risk bearish option strategy. Lightnin Bull buys a higher-strike put and sells a lower-strike put, so downside exposure is capped and structured."
  );
}

async function answerFromStocks(category: string): Promise<string> {
  const stocks = (await fetchStocksByCategoryForAI(category)).slice(0, 8);
  const knowledge = findKnowledgeAnswer(category) || "";

  if (stocks.length === 0) {
    return `${knowledge ? `${knowledge}\n\n` : ""}No ${category} stocks are available right now. Please refresh the dashboard after backend data updates.`;
  }

  const lines = [`Current ${category} stocks from Lightnin Bull:`];
  stocks.forEach((stock, index) => {
    const symbol = normalizeSymbol(stock.symbol || stock.ticker);
    const sector = stock.sector || "N/A";
    const score = safeNumber(stock.score ?? stock.strength);
    lines.push(`${index + 1}. ${symbol} | Sector: ${sector}${score !== null ? ` | Score: ${score.toFixed(2)}` : ""}`);
  });

  lines.push("", "This is a signal dashboard output, not a guaranteed buy/sell recommendation. Use risk management before trading.");
  return knowledge ? `${knowledge}\n\n${lines.join("\n")}` : lines.join("\n");
}

async function answerFromIntraday(message: string): Promise<string | null> {
  const wantsUpside = message.includes("upside trend") || message.includes("live upside");
  const wantsDownside = message.includes("downside trend") || message.includes("live downside");

  if (!wantsUpside && !wantsDownside) return null;

  const strategyKey = wantsUpside ? "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL" : "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL";
  const label = wantsUpside ? "Upside Trend Stocks" : "Downside Trend Stocks";

  const allSpreads = await fetchAllIntradaySpreads();
  const payload = allSpreads[strategyKey];
  const knowledge = findKnowledgeAnswer("intraday stock signals") || "";

  if (!payload) {
    return `${knowledge ? `${knowledge}\n\n` : ""}No live ${label} data is available right now. The websocket engine may still be booting or market data may be inactive.`;
  }

  const signals = Array.isArray(payload.signals) ? payload.signals : [];
  const entered = signals.filter((row: any) => String(row.signal_status || "").toUpperCase() === "ENTERED");
  const rows = (entered.length > 0 ? entered : signals).slice(0, 8);

  const lines = [
    `${label} status: ${payload.status || "WAITING"}`,
    `Message: ${payload.message || "No message"}`,
    `Entered: ${payload.entered_count ?? entered.length} / Total: ${payload.total_count ?? signals.length}`,
  ];

  if (rows.length > 0) {
    lines.push("", "Latest rows:");
    rows.forEach((row: any) => {
      const symbol = normalizeSymbol(row.symbol);
      const status = row.signal_status || "WAITING";
      const entry = safeNumber(row.entry_price ?? row.avg_price);
      const ltp = safeNumber(row.current_ltp);
      const maxLtp = safeNumber(row.max_ltp ?? row.favorable_price);
      lines.push(`- ${symbol} | ${status}${entry !== null ? ` | Entry: ${entry.toFixed(2)}` : ""}${ltp !== null ? ` | LTP: ${ltp.toFixed(2)}` : ""}${maxLtp !== null ? ` | Max: ${maxLtp.toFixed(2)}` : ""}`);
    });
  } else {
    lines.push("No stock-level signal rows are available yet.");
  }

  return knowledge ? `${knowledge}\n\n${lines.join("\n")}` : lines.join("\n");
}

function strategyExplanation(message: string): string | null {
  if (message.includes("bull call")) {
    return "Bull Call Spread\n\nLightnin Bull uses Bull Call Spreads when the index has upside confirmation. It buys a lower-strike call and sells a higher-strike call, so max loss and max profit are both predefined. It is a controlled-risk bullish strategy, not a guaranteed profit trade.";
  }
  if (message.includes("bear put")) {
    return "Bear Put Spread\n\nBear Put Spread is a bearish debit spread. It buys a higher-strike put and sells a lower-strike put. It is useful when downside confirmation is present and you want capped downside-risk exposure.";
  }
  if (message.includes("short straddle") || message.includes("straddle")) {
    return "Short Straddle\n\nShort Straddle sells ATM CE and ATM PE together. It benefits from theta decay and range-bound movement, but risk increases sharply if the market trends strongly. Use strict stop-loss and position sizing.";
  }
  if (message.includes("covered call")) {
    return "Covered Call\n\nCovered Call holds the underlying or index-equivalent exposure and sells a call against it. It can generate option income in sideways or moderately bullish regimes, but upside becomes capped above the sold-call strike.";
  }
  return null;
}

async function buildAnswer(question: string): Promise<string> {
  const message = question.toLowerCase().trim();

  if (!message) return getKnowledgeOverview();

  const watchlistAnswer = await answerFromWatchlistAction(question);
  if (watchlistAnswer) return watchlistAnswer;

  const backtestAnswer = await answerFromBacktestAction(question);
  if (backtestAnswer) return backtestAnswer;

  if (message.includes("what can you explain") || message.includes("knowledge") || message.includes("help me") || message === "help") {
    return getKnowledgeOverview();
  }

  const spreadAnswer = await answerFromOptionSpread(message);
  if (spreadAnswer) return spreadAnswer;

  const intradayAnswer = await answerFromIntraday(message);
  if (intradayAnswer) return intradayAnswer;

  const category = pickCategory(message);
  if (category) return answerFromStocks(category);

  const explanation = strategyExplanation(message);
  if (explanation) return explanation;

  const knowledgeAnswer = findKnowledgeAnswer(message);
  if (knowledgeAnswer) return knowledgeAnswer;

  if (message.includes("payment") || message.includes("subscription") || message.includes("premium")) {
    return "Premium unlocks the full stock list, intraday option spreads, and intraday stock signals. For exact payment validity, open the Pricing/Profile section because subscription status is checked from your account API.";
  }

  return (
    "I can help with Lightnin Bull dashboard knowledge, watchlist actions, portfolio backtests, live spreads, and intraday signals.\n\n" +
    "Try asking:\n" +
    "- Add top 10 Regime Upside stocks to my watchlist\n" +
    "- Run equal weight backtest\n" +
    "- Run MVO weights backtest\n" +
    "- Backtest on MVO short\n" +
    "- Show live Bull Call Spread\n" +
    "- Explain the alpha engine"
  );
}

const FloatingAIAgentV2: React.FC = () => {
  const token = getAuthToken();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);

  const visible = useMemo(() => Boolean(token), [token]);
  const voiceSupported = useMemo(() => isVoiceSupported(), []);

  if (!visible) return null;

  const sendMessage = async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? input).trim();
    if (!question || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const answer = await buildAnswer(question);
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch (error) {
      console.error(error);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "AI Agent could not complete this action right now. Please check backend deployment and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore browser speech stop errors
    }
    setIsListening(false);
  };

  const startVoiceInput = () => {
    setVoiceError("");

    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionConstructor) {
      setVoiceError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError("");
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }

      const spokenText = `${finalTranscript} ${interimTranscript}`.trim();
      if (spokenText) setInput(spokenText);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed") setVoiceError("Microphone permission is blocked. Please allow mic access and try again.");
      else if (event.error === "no-speech") setVoiceError("I did not hear anything. Tap the mic and speak again.");
      else setVoiceError(`Voice input stopped: ${event.error}`);
    };

    recognition.onend = () => setIsListening(false);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError("Voice input could not start. Please try again.");
    }
  };

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            right: 22,
            bottom: 92,
            width: "min(420px, calc(100vw - 28px))",
            height: "min(620px, calc(100vh - 130px))",
            zIndex: 9999,
            borderRadius: 22,
            border: "1px solid rgba(226,184,75,0.42)",
            background: "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(0,0,0,0.96))",
            boxShadow: "0 22px 70px rgba(0,0,0,0.65), 0 0 30px rgba(226,184,75,0.12)",
            color: "#fff",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid rgba(226,184,75,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: "#e2b84b",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                AI Market Mentor
              </div>
              <div style={{ fontFamily: "var(--font-serif, serif)", fontSize: 22, color: "#f7f0df" }}>
                Lightnin Bull AI Agent
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopListening();
                setIsOpen(false);
              }}
              aria-label="Close AI Agent"
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    borderRadius: 16,
                    padding: "10px 12px",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                    fontSize: 13,
                    fontFamily: "Inter, system-ui, sans-serif",
                    background: isUser ? "linear-gradient(135deg, #e2b84b, #f59e0b)" : "rgba(255,255,255,0.055)",
                    color: isUser ? "#050505" : "rgba(255,255,255,0.86)",
                    border: isUser ? "1px solid rgba(226,184,75,0.8)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {message.content}
                </div>
              );
            })}

            {loading && (
              <div style={{ color: "#e2b84b", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                AI is updating Lightnin Bull data…
              </div>
            )}
          </div>

          {(isListening || voiceError) && (
            <div
              style={{
                padding: "8px 14px",
                color: isListening ? "#e2b84b" : "#f87171",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 11,
                borderTop: "1px solid rgba(226,184,75,0.10)",
              }}
            >
              {isListening ? "Listening… speak your command now." : voiceError}
            </div>
          )}

          <div style={{ padding: 14, borderTop: "1px solid rgba(226,184,75,0.16)", display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={startVoiceInput}
              disabled={loading || !voiceSupported}
              title={voiceSupported ? "Speak to AI" : "Voice input is not supported in this browser"}
              style={{
                width: 42,
                borderRadius: 12,
                border: isListening ? "1px solid rgba(248,113,113,0.9)" : "1px solid rgba(226,184,75,0.35)",
                background: isListening ? "rgba(248,113,113,0.16)" : "rgba(226,184,75,0.10)",
                color: isListening ? "#f87171" : "#e2b84b",
                cursor: loading || !voiceSupported ? "not-allowed" : "pointer",
                fontSize: 16,
              }}
            >
              {isListening ? "■" : "🎙️"}
            </button>

            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type or tap mic: run MVO backtest..."
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#050505",
                color: "#fff",
                padding: "11px 12px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={loading}
              style={{
                borderRadius: 12,
                border: "none",
                background: loading ? "rgba(226,184,75,0.45)" : "linear-gradient(135deg, #e2b84b, #f59e0b)",
                color: "#050505",
                fontWeight: 800,
                padding: "0 16px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Open Lightnin Bull AI Agent"
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 9999,
          border: "1px solid rgba(226,184,75,0.72)",
          borderRadius: 999,
          background: "linear-gradient(135deg, #e2b84b, #f59e0b)",
          color: "#050505",
          boxShadow: "0 12px 38px rgba(0,0,0,0.45)",
          padding: "13px 18px",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: 0.2,
          cursor: "pointer",
        }}
      >
        ⚡ AI Agent
      </button>
    </>
  );
};

export default FloatingAIAgentV2;
