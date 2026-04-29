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

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function extractNumber(text: string): number {
  const lower = text.toLowerCase();
  for (const [word, num] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return num;
  }
  const match = lower.match(/\b(\d+)\b/);
  return match ? Math.min(parseInt(match[1], 10), 20) : 5;
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

// ─── Intent Parser ────────────────────────────────────────────────────────────

type Intent =
  | { type: "add_to_watchlist"; category: string; count: number }
  | { type: "needs_category"; count: number }
  | { type: "navigate"; tab: string }
  | { type: "explain_alpha" }
  | { type: "explain_product" }
  | { type: "list_factors" }
  | { type: "unknown" };

function parseIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();

  // "add … to watchlist" or "add … stocks"
  const wantsAdd =
    /\badd\b/.test(lower) ||
    (/\bwatchlist\b/.test(lower) &&
      (/\bfrom\b|\btop\b|\bstock/.test(lower)));

  if (wantsAdd) {
    const category = matchCategory(lower);
    if (category) {
      return { type: "add_to_watchlist", category, count: extractNumber(lower) };
    }
    // Wants to add but no category found → ask which factor
    return { type: "needs_category", count: extractNumber(lower) };
  }

  // Navigation: "show", "open", "go to", "take me to", "view"
  const wantsNav = /\b(show|open|go to|take me|view|navigate|see)\b/.test(lower);

  if (wantsNav || !wantsAdd) {
    if (/\bwatchlist\b/.test(lower)) return { type: "navigate", tab: "Watchlist" };
    if (/\bbull.?call\b/.test(lower)) return { type: "navigate", tab: "Bull Call Spreads" };
    if (/\bbear.?put\b/.test(lower)) return { type: "navigate", tab: "Bear Put Spreads" };
    if (/\bbacktest\b|\bback.test\b|\bportfolio\b/.test(lower))
      return { type: "navigate", tab: "Portfolio Backtest" };
    if (/\bupside.trend\b/.test(lower)) return { type: "navigate", tab: "Upside Trend Stocks" };
    if (/\bdownside.trend\b/.test(lower)) return { type: "navigate", tab: "Downside Trend Stocks" };

    const category = matchCategory(lower);
    if (category) return { type: "navigate", tab: category };
  }

  // Backtest without "show/open"
  if (/\bbacktest\b/.test(lower)) return { type: "navigate", tab: "Portfolio Backtest" };

  // Explain intents
  if (/\balpha\b|\bhow.?it.?work|\bexplain.?model|\bsignal/.test(lower))
    return { type: "explain_alpha" };

  if (
    /\bfactor|\bcategor|\bbucket|\blist\b/.test(lower) &&
    /\bwhat|\bshow|\blist\b/.test(lower)
  )
    return { type: "list_factors" };

  if (/\bwhat|\bhow|\bhelp\b|\bexplain\b|\bcan you/.test(lower))
    return { type: "explain_product" };

  return { type: "unknown" };
}

// ─── Static Responses ─────────────────────────────────────────────────────────

const ALPHA_EXPLANATION = `LightninBull's alpha engine uses 6 quantitative models:

• Consistent Trending — Stocks with sustained price momentum across 1W to 6M timeframes.
• Slow Movement — Strong risk-adjusted returns with low drawdown and low volatility.
• Cheap Value — Fundamentally undervalued stocks screened by quality metrics.
• Best Quality — High-quality businesses with strong balance sheets.
• Regime — Market-regime-aware: Upside in bull phases, Downside in bear phases.
• Range Bound — Mean-reversion opportunities in sideways markets.

Each model ranks stocks by a proprietary score. Add top-ranked stocks from any bucket to your Watchlist and backtest them using Equal Weight or MVO allocation.`;

const PRODUCT_EXPLANATION = `I'm the Lightnin Bull AI Agent. Here's what I can do:

• Add stocks to watchlist — "Add top 5 Slow Movement stocks to my watchlist"
• Navigate to any section — "Show Regime Upside" or "Open Portfolio Backtest"
• View live option spreads — "Show Bull Call Spreads" or "Show Bear Put Spreads"
• Explain the models — "Explain the alpha engine"

Available factor buckets:
Consistent Trending · Slow Movement · Cheap Value · Best Quality
Regime Upside · Regime Downside · Range Bound Upside · Range Bound Downside
Aggressive Call Options · Aggressive Put Options`;

const FACTOR_LIST = `Available factor buckets on LightninBull:

1. Consistent Trending — momentum stocks
2. Slow Movement — low-volatility, steady movers
3. Cheap Value — undervalued opportunities
4. Best Quality — high-quality businesses
5. Regime Upside — bull-market leaders
6. Regime Downside — bear-market signals
7. Range Bound Upside — sideways breakout longs
8. Range Bound Downside — sideways breakout shorts
9. Aggressive Call Option Stocks — derivative demand (calls)
10. Aggressive Put Option Stocks — derivative demand (puts)

Say "Add top 5 [factor name] stocks to watchlist" to get started.`;

const UNKNOWN_RESPONSE = `I didn't quite catch that. Try:

• "Add top 5 Slow Movement stocks to watchlist"
• "Show Consistent Trending"
• "Open Portfolio Backtest"
• "Show Bull Call Spreads"
• "Explain the alpha engine"
• "List all factor buckets"`;

// ─── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  "Add top 5 Consistent Trending to watchlist",
  "Add top 5 Slow Movement to watchlist",
  "Add top 5 Regime Upside to watchlist",
  "Show Bull Call Spreads",
  "Open Portfolio Backtest",
  "Explain the alpha engine",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

// Remembers an incomplete "add" intent while waiting for the user to name a factor
type PendingState = { type: "awaiting_category"; count: number } | null;

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

  const executeAddToWatchlist = async (category: string, count: number) => {
    pushMsg("assistant", `Fetching top ${count} stocks from "${category}"…`);

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

    const top = (result.stocks ?? [])
      .sort((a, b) => a.rank - b.rank)
      .slice(0, count)
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
      // ── Pending state: user is answering "which factor?" ──────────────────
      if (pending?.type === "awaiting_category") {
        const category = matchCategory(trimmed.toLowerCase());
        if (category) {
          setPending(null);
          await executeAddToWatchlist(category, pending.count);
        } else {
          pushMsg(
            "assistant",
            `I still couldn't identify a factor from "${trimmed}".\n\nAvailable buckets:\nConsistent Trending · Slow Movement · Cheap Value · Best Quality · Regime Upside · Regime Downside · Range Bound Upside · Range Bound Downside · Aggressive Call Options · Aggressive Put Options\n\nWhich one would you like?`
          );
        }
        return;
      }

      // ── Normal intent parsing ─────────────────────────────────────────────
      const intent = parseIntent(trimmed);

      switch (intent.type) {
        case "add_to_watchlist":
          await executeAddToWatchlist(intent.category, intent.count);
          break;

        case "needs_category": {
          const countWord = intent.count === 5 ? "stocks" : `${intent.count} stock${intent.count > 1 ? "s" : ""}`;
          setPending({ type: "awaiting_category", count: intent.count });
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

        case "explain_alpha":
          pushMsg("assistant", ALPHA_EXPLANATION);
          break;

        case "explain_product":
          pushMsg("assistant", PRODUCT_EXPLANATION);
          break;

        case "list_factors":
          pushMsg("assistant", FACTOR_LIST);
          break;

        default:
          pushMsg("assistant", UNKNOWN_RESPONSE);
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
