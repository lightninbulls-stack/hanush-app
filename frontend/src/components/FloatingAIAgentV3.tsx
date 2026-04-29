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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type BacktestStrategy = "equal_weight" | "mvo" | "mvo_short";

type StockRow = {
  symbol?: string;
  ticker?: string;
  sector?: string;
  score?: number;
  strength?: number;
};

type StockCategoryResponse = {
  stocks?: StockRow[];
};

const FACTOR_CATEGORIES = [
  "Consistent Trending",
  "Slow Movement",
  "Cheap Value",
  "Best Quality",
];

const ALL_CATEGORIES = [
  ...FACTOR_CATEGORIES,
  "Regime Upside",
  "Regime Downside",
  "Range Bound Upside",
  "Range Bound Downside",
  "Aggressive Call Option Stocks",
  "Aggressive Put Option Stocks",
];

const CATEGORY_ALIASES: Array<{ category: string; aliases: string[] }> = [
  {
    category: "Consistent Trending",
    aliases: [
      "consistent trending",
      "momentum",
      "momentum stocks",
      "trending",
      "trending stocks",
      "trend stocks",
      "consistent trend",
    ],
  },
  { category: "Slow Movement", aliases: ["slow movement", "slow moving", "low movement"] },
  { category: "Cheap Value", aliases: ["cheap value", "value", "value stocks", "cheap stocks"] },
  { category: "Best Quality", aliases: ["best quality", "quality", "quality stocks"] },
  { category: "Regime Upside", aliases: ["regime upside", "upside regime", "upside stocks", "bullish regime"] },
  { category: "Regime Downside", aliases: ["regime downside", "downside regime", "downside stocks", "bearish regime"] },
  { category: "Range Bound Upside", aliases: ["range bound upside", "range upside"] },
  { category: "Range Bound Downside", aliases: ["range bound downside", "range downside"] },
  { category: "Aggressive Call Option Stocks", aliases: ["aggressive call", "call option stocks", "call stocks"] },
  { category: "Aggressive Put Option Stocks", aliases: ["aggressive put", "put option stocks", "put stocks"] },
];

const DEFAULT_BUCKET = "Regime Upside";

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I am your Lightnin Bull AI Agent. Try: add top 3 stocks from momentum to watchlist, add top 10 Regime Upside stocks, run equal weight backtest, run MVO backtest, or show live Bull Call Spread.",
};

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/watch\s+list/g, "watchlist")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSymbol(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function safeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: unknown): string {
  const parsed = safeNumber(value);
  return parsed === null ? "--" : parsed.toFixed(2);
}

function formatPercent(value: unknown): string {
  const parsed = safeNumber(value);
  return parsed === null ? "--" : `${parsed.toFixed(2)}%`;
}

function getSpeechRecognitionConstructor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function isVoiceSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

function mentionsWatchlist(message: string): boolean {
  return message.includes("watchlist") || message.includes("wishlist") || message.includes("watch li");
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

function detectCategories(message: string): { categories: string[]; usedDefault: boolean } {
  const categories = new Set<string>();

  if (message.includes("factor") || message.includes("factors") || message.includes("factor bucket")) {
    FACTOR_CATEGORIES.forEach((category) => categories.add(category));
  }

  if (message.includes("all categories") || message.includes("all bucket") || message.includes("all buckets")) {
    ALL_CATEGORIES.forEach((category) => categories.add(category));
  }

  CATEGORY_ALIASES.forEach(({ category, aliases }) => {
    if (aliases.some((alias) => message.includes(alias))) {
      categories.add(category);
    }
  });

  if (categories.size === 0 && message.includes("top")) {
    categories.add(DEFAULT_BUCKET);
    return { categories: Array.from(categories), usedDefault: true };
  }

  return { categories: Array.from(categories), usedDefault: false };
}

function extractManualSymbols(rawQuestion: string): string[] {
  const cleaned = normalizeText(rawQuestion)
    .replace(/watchlist|wishlist|add|save|put|include|remove|delete|clear|empty|from|to|my|the|stock|stocks|symbol|symbols|please|top|one|two|three|four|five|six|seven|eight|nine|ten|\d+/gi, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ");

  const blocked = new Set([
    "REGIME",
    "UPSIDE",
    "DOWNSIDE",
    "MOMENTUM",
    "CONSISTENT",
    "TRENDING",
    "SLOW",
    "MOVEMENT",
    "CHEAP",
    "VALUE",
    "BEST",
    "QUALITY",
    "FACTOR",
    "BUCKET",
  ]);

  return Array.from(
    new Set(
      cleaned
        .split(/\s+/)
        .map(normalizeSymbol)
        .filter((item) => item.length >= 2 && item.length <= 15 && !blocked.has(item))
    )
  );
}

async function fetchStocksByCategoryForAI(category: string): Promise<StockRow[]> {
  const response = await fetch(`${API_BASE_URL}/stocks/${encodeURIComponent(category)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Failed to fetch ${category}: ${response.status}`);

  const data = (await response.json()) as StockCategoryResponse;
  return Array.isArray(data.stocks) ? data.stocks : [];
}

async function fetchTopSymbols(categories: string[], topN: number) {
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

  return {
    rows,
    symbols: Array.from(new Set(rows.flatMap((row) => row.symbols))),
  };
}

async function answerWatchlist(rawQuestion: string): Promise<string | null> {
  const message = normalizeText(rawQuestion);
  const hasWatchlist = mentionsWatchlist(message);
  const hasAddIntent = /(add|save|put|include)/.test(message);
  const hasRemoveIntent = /(remove|delete)/.test(message);
  const hasClearIntent = /(clear|empty)/.test(message);
  const hasShowIntent = /(show|view|list|what)/.test(message);
  const hasTopCategoryIntent = message.includes("top") && detectCategories(message).categories.length > 0;

  const isAdd = hasAddIntent && (hasWatchlist || hasTopCategoryIntent);
  const isRemove = hasRemoveIntent && hasWatchlist;
  const isClear = hasClearIntent && hasWatchlist;
  const isShow = hasShowIntent && hasWatchlist;

  if (!isAdd && !isRemove && !isClear && !isShow) return null;

  if (isClear) {
    await clearWatchlistSymbols();
    return "Done. I cleared your watchlist.";
  }

  if (isShow) {
    const symbols = await fetchWatchlistSymbols();
    return symbols.length ? `Current watchlist (${symbols.length}):\n${symbols.join(", ")}` : "Your watchlist is empty.";
  }

  const topN = extractTopCount(message);
  const { categories, usedDefault } = detectCategories(message);

  if (categories.length > 0) {
    const { rows, symbols } = await fetchTopSymbols(categories, topN);
    if (!symbols.length) return "I found the bucket, but no stocks were available from the backend.";

    const before = await fetchWatchlistSymbols();
    const after = isAdd ? await addWatchlistSymbols(symbols) : await removeWatchlistSymbols(symbols);
    const beforeSet = new Set(before.map(normalizeSymbol));
    const afterSet = new Set(after.map(normalizeSymbol));
    const changed = isAdd
      ? symbols.filter((symbol) => !beforeSet.has(symbol))
      : symbols.filter((symbol) => !afterSet.has(symbol));

    const lines = [
      isAdd ? `Done. Added ${changed.length} new stock(s) to your watchlist.` : `Done. Removed ${changed.length} stock(s) from your watchlist.`,
      usedDefault ? `No bucket was mentioned, so I used ${DEFAULT_BUCKET} by default.` : `Bucket(s): ${categories.join(", ")}`,
      `Top count requested: ${topN}`,
      "",
      "Symbols:",
    ];

    rows.forEach((row) => lines.push(`- ${row.category}: ${row.symbols.join(", ") || "No stocks"}`));
    lines.push("", `Current watchlist count: ${after.length}`);
    return lines.join("\n");
  }

  const manualSymbols = extractManualSymbols(rawQuestion);
  if (!manualSymbols.length) {
    return "I understood the watchlist action, but I could not identify symbols or bucket. Try: add top 3 stocks from momentum to watchlist.";
  }

  const before = await fetchWatchlistSymbols();
  const after = isAdd ? await addWatchlistSymbols(manualSymbols) : await removeWatchlistSymbols(manualSymbols);

  return [
    isAdd ? `Done. Added: ${manualSymbols.join(", ")}` : `Done. Removed: ${manualSymbols.join(", ")}`,
    `Before count: ${before.length}`,
    `Current watchlist count: ${after.length}`,
  ].join("\n");
}

function pickBacktestStrategy(message: string): BacktestStrategy | null {
  const asksBacktest = message.includes("backtest") || message.includes("portfolio test") || message.includes("simulate");
  if (!asksBacktest) return null;
  if (message.includes("mvo short") || message.includes("short mvo")) return "mvo_short";
  if (message.includes("mvo") || message.includes("mean variance") || message.includes("mean-variance")) return "mvo";
  return "equal_weight";
}

function strategyLabel(strategy: BacktestStrategy): string {
  if (strategy === "mvo") return "MVO Weights";
  if (strategy === "mvo_short") return "MVO Short";
  return "Equal Weight";
}

function summarizeBacktest(result: PortfolioBacktestResponse, strategy: BacktestStrategy): string {
  const metrics = result.metrics || {};
  const benchmark = result.benchmark_metrics || null;
  const holdings = Array.isArray(result.holdings) ? result.holdings : [];

  const lines = [
    `Portfolio Backtest — ${strategyLabel(strategy)}`,
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
  ];

  if (benchmark) {
    lines.push("", `Benchmark: ${result.benchmark_name || "NIFTY 50"}`, `- Benchmark CAGR: ${formatPercent(benchmark.cagr_pct)}`, `- Benchmark Sharpe: ${formatNumber(benchmark.sharpe)}`);
  }

  if (holdings.length > 0) {
    lines.push("", "Top holdings / weights:");
    holdings.slice(0, 10).forEach((holding) => {
      lines.push(`- ${holding.symbol}: ${(Number(holding.weight || 0) * 100).toFixed(2)}% | Return: ${formatPercent(holding.total_return_pct)}`);
    });
  }

  return `${lines.join("\n")}\n\nUse this as research output, not a guaranteed allocation recommendation.`;
}

async function answerBacktest(rawQuestion: string): Promise<string | null> {
  const message = normalizeText(rawQuestion);
  const strategy = pickBacktestStrategy(message);
  if (!strategy) return null;

  const symbols = await fetchWatchlistSymbols();
  if (!symbols.length) return "Your watchlist is empty. First ask: add top 3 stocks from momentum to watchlist.";

  const result = await runWatchlistBacktest(symbols, strategy);
  return summarizeBacktest(result, strategy);
}

async function answerSpread(rawQuestion: string): Promise<string | null> {
  const message = normalizeText(rawQuestion);
  const wantsBull = message.includes("bull call") || message.includes("call spread") || message.includes("bullish spread");
  const wantsBear = message.includes("bear put") || message.includes("put spread") || message.includes("bearish spread");
  if (!wantsBull && !wantsBear) return null;

  const response = await fetch(`${API_BASE_URL}/api/intraday-spreads/all`, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch spread data: ${response.status}`);

  const json = await response.json();
  const data = json?.data || {};
  const payload = wantsBull
    ? data.ALPHA_BULL_PAPER || Object.values(data).find((spread: any) => spread?.spread_type === "bull_call")
    : data.ALPHA_BEAR_PAPER || Object.values(data).find((spread: any) => spread?.spread_type === "put_debit");

  const label = wantsBull ? "Bull Call Spread" : "Bear Put Spread";
  const concept = wantsBull
    ? "A Bull Call Spread buys a lower-strike call and sells a higher-strike call. Risk and reward are capped."
    : "A Bear Put Spread buys a higher-strike put and sells a lower-strike put. Downside exposure is capped.";

  if (!payload) return `${label}\n\n${concept}\n\nNo live payload is available right now.`;

  const lines = [
    label,
    "",
    concept,
    "",
    "Live status:",
    `- Index: ${payload.index || "--"}`,
    `- Strategy: ${payload.strategy_name || "--"}`,
    `- Status: ${payload.status || payload.ui_state || "WAITING"}`,
    `- Message: ${payload.message || "No message"}`,
    `- Net P&L: ${formatNumber(payload.net_pnl)}`,
    `- Stop Loss: ${formatNumber(payload.stop_loss)}`,
    `- Target: ${formatNumber(payload.target)}`,
  ];

  const legs = Array.isArray(payload.legs) ? payload.legs : [];
  if (legs.length > 0) {
    lines.push("", "Live legs:");
    legs.forEach((leg: any, index: number) => {
      lines.push(`- ${leg.side || `LEG ${index + 1}`} ${leg.trading_symbol || "--"} | Strike: ${leg.strike || "--"} | Entry: ${formatNumber(leg.avg_price)} | LTP: ${formatNumber(leg.ltp)} | P&L: ${formatNumber(leg.pnl)}`);
    });
  }

  return lines.join("\n");
}

async function answerStocks(rawQuestion: string): Promise<string | null> {
  const message = normalizeText(rawQuestion);
  const { categories } = detectCategories(message);
  if (!categories.length) return null;

  const category = categories[0];
  const stocks = (await fetchStocksByCategoryForAI(category)).slice(0, 8);
  const knowledge = findKnowledgeAnswer(category) || "";

  if (!stocks.length) return `${knowledge ? `${knowledge}\n\n` : ""}No ${category} stocks are available right now.`;

  const lines = [`Current ${category} stocks:`];
  stocks.forEach((stock, index) => {
    const symbol = normalizeSymbol(stock.symbol || stock.ticker);
    const sector = stock.sector || "N/A";
    const score = safeNumber(stock.score ?? stock.strength);
    lines.push(`${index + 1}. ${symbol} | Sector: ${sector}${score !== null ? ` | Score: ${score.toFixed(2)}` : ""}`);
  });

  return knowledge ? `${knowledge}\n\n${lines.join("\n")}` : lines.join("\n");
}

async function buildAnswer(question: string): Promise<string> {
  const message = normalizeText(question);
  if (!message) return getKnowledgeOverview();

  const watchlist = await answerWatchlist(question);
  if (watchlist) return watchlist;

  const backtest = await answerBacktest(question);
  if (backtest) return backtest;

  const spread = await answerSpread(question);
  if (spread) return spread;

  const stocks = await answerStocks(question);
  if (stocks) return stocks;

  const knowledge = findKnowledgeAnswer(message);
  if (knowledge) return knowledge;

  if (message.includes("help") || message.includes("what can you")) return getKnowledgeOverview();

  return (
    "I can help with Lightnin Bull actions and explanations.\n\n" +
    "Examples:\n" +
    "- Add top 3 stocks from momentum to watchlist\n" +
    "- Add top 10 Regime Upside stocks to watchlist\n" +
    "- Show my watchlist\n" +
    "- Run equal weight backtest\n" +
    "- Run MVO weights backtest\n" +
    "- Show live Bull Call Spread"
  );
}

const FloatingAIAgentV3: React.FC = () => {
  const token = getAuthToken();
  const recognitionRef = useRef<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);

  const visible = useMemo(() => Boolean(token), [token]);
  const voiceSupported = useMemo(() => isVoiceSupported(), []);

  if (!visible) return null;

  const sendMessage = async () => {
    const question = input.trim();
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
      setMessages([...nextMessages, { role: "assistant", content: "I could not complete this action right now. Please check backend data/API and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore stop errors
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

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      const spokenText = `${finalTranscript} ${interimTranscript}`.trim();
      if (spokenText) setInput(spokenText);
    };

    recognition.onerror = (event: any) => {
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
          <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(226,184,75,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: 1.5, color: "#e2b84b", textTransform: "uppercase", marginBottom: 4 }}>AI Market Mentor</div>
              <div style={{ fontFamily: "var(--font-serif, serif)", fontSize: 22, color: "#f7f0df" }}>Lightnin Bull AI Agent</div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopListening();
                setIsOpen(false);
              }}
              aria-label="Close Lightnin Bull AI Agent"
              style={{ width: 34, height: 34, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer" }}
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

            {loading && <div style={{ color: "#e2b84b", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>AI is updating Lightnin Bull data…</div>}
          </div>

          {(isListening || voiceError) && (
            <div style={{ padding: "8px 14px", color: isListening ? "#e2b84b" : "#f87171", fontFamily: "var(--font-mono, monospace)", fontSize: 11, borderTop: "1px solid rgba(226,184,75,0.10)" }}>
              {isListening ? "Listening… speak your command now." : voiceError}
            </div>
          )}

          <div style={{ padding: 14, borderTop: "1px solid rgba(226,184,75,0.16)", display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={startVoiceInput}
              disabled={loading || !voiceSupported}
              title={voiceSupported ? "Speak to AI" : "Voice input is not supported in this browser"}
              style={{ width: 42, borderRadius: 12, border: isListening ? "1px solid rgba(248,113,113,0.9)" : "1px solid rgba(226,184,75,0.35)", background: isListening ? "rgba(248,113,113,0.16)" : "rgba(226,184,75,0.10)", color: isListening ? "#f87171" : "#e2b84b", cursor: loading || !voiceSupported ? "not-allowed" : "pointer", fontSize: 16 }}
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
              placeholder="Type: add top 3 stocks from momentum to watchlist..."
              style={{ flex: 1, minWidth: 0, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "#050505", color: "#fff", padding: "11px 12px", outline: "none" }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading}
              style={{ borderRadius: 12, border: "none", background: loading ? "rgba(226,184,75,0.45)" : "linear-gradient(135deg, #e2b84b, #f59e0b)", color: "#050505", fontWeight: 800, padding: "0 16px", cursor: loading ? "not-allowed" : "pointer" }}
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
        style={{ position: "fixed", right: 22, bottom: 22, zIndex: 9999, border: "1px solid rgba(226,184,75,0.72)", borderRadius: 999, background: "linear-gradient(135deg, #e2b84b, #f59e0b)", color: "#050505", boxShadow: "0 12px 38px rgba(0,0,0,0.45)", padding: "13px 18px", fontWeight: 900, fontSize: 13, letterSpacing: 0.2, cursor: "pointer" }}
      >
        ⚡ Lightnin Bull AI Agent
      </button>
    </>
  );
};

export default FloatingAIAgentV3;
