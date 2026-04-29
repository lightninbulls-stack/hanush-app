import React, { useMemo, useState } from "react";
import { findKnowledgeAnswer, getKnowledgeOverview } from "./aiKnowledge";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://hanush-backend-service1.onrender.com"
).replace(/\/+$/, "");

type ChatRole = "user" | "assistant";

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

type IntradaySpreadMap = Record<string, any>;

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I am your Lightnin Bull AI Agent. Ask me about the dashboard workflow, alpha engine, risk engine, Regime Upside, intraday signals, option spreads, or rebalancing rules.",
};

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

function safeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function strategyExplanation(message: string): string | null {
  if (message.includes("bull call")) {
    return (
      "Bull Call Spread\n\n" +
      "Lightnin Bull uses Bull Call Spreads when the index has upside confirmation. " +
      "The structure buys a lower-strike call and sells a higher-strike call, so max loss and max profit are both predefined. " +
      "It is a controlled-risk bullish strategy, not a guaranteed profit trade."
    );
  }

  if (message.includes("bear put")) {
    return (
      "Bear Put Spread\n\n" +
      "Bear Put Spread is a bearish debit spread. It buys a higher-strike put and sells a lower-strike put. " +
      "It is useful when downside confirmation is present and you want capped downside-risk exposure."
    );
  }

  if (message.includes("short straddle") || message.includes("straddle")) {
    return (
      "Short Straddle\n\n" +
      "Short Straddle sells ATM CE and ATM PE together. It benefits from theta decay and range-bound movement, " +
      "but risk increases sharply if the market trends strongly. Use strict stop-loss and position sizing."
    );
  }

  if (message.includes("covered call")) {
    return (
      "Covered Call\n\n" +
      "Covered Call holds the underlying or index-equivalent exposure and sells a call against it. " +
      "It can generate option income in sideways or moderately bullish regimes, but upside becomes capped above the sold-call strike."
    );
  }

  return null;
}

function pickCategory(message: string): string | null {
  if (message.includes("regime upside") || message.includes("upside stocks") || message.includes("momentum stocks")) {
    return "Regime Upside";
  }
  if (message.includes("regime downside") || message.includes("downside stocks")) {
    return "Regime Downside";
  }
  if (message.includes("consistent trending") || message.includes("trending stocks")) {
    return "Consistent Trending";
  }
  if (message.includes("slow movement")) return "Slow Movement";
  if (message.includes("cheap value") || message.includes("value stocks")) return "Cheap Value";
  if (message.includes("best quality") || message.includes("quality stocks")) return "Best Quality";
  if (message.includes("range bound upside")) return "Range Bound Upside";
  if (message.includes("range bound downside")) return "Range Bound Downside";
  if (message.includes("aggressive call")) return "Aggressive Call Option Stocks";
  if (message.includes("aggressive put")) return "Aggressive Put Option Stocks";
  return null;
}

async function answerFromStocks(category: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/stocks/${encodeURIComponent(category)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${category}: ${response.status}`);
  }

  const data = (await response.json()) as StockCategoryResponse;
  const stocks = Array.isArray(data?.stocks) ? data.stocks.slice(0, 8) : [];

  const knowledge = findKnowledgeAnswer(category) || "";

  if (stocks.length === 0) {
    return `${knowledge ? `${knowledge}\n\n` : ""}No ${category} stocks are available right now. Please refresh the dashboard after the backend data updates.`;
  }

  const lines = [`Current ${category} stocks from Lightnin Bull:`];
  stocks.forEach((stock, index) => {
    const symbol = String(stock.symbol || stock.ticker || "UNKNOWN").toUpperCase();
    const sector = stock.sector || "N/A";
    const score = safeNumber(stock.score ?? stock.strength);
    lines.push(
      `${index + 1}. ${symbol} | Sector: ${sector}${score !== null ? ` | Score: ${score.toFixed(2)}` : ""}`
    );
  });

  lines.push("");
  lines.push("This is a signal dashboard output, not a guaranteed buy/sell recommendation. Use risk management before trading.");

  if (knowledge) {
    return `${knowledge}\n\n${lines.join("\n")}`;
  }

  return lines.join("\n");
}

async function answerFromIntraday(message: string): Promise<string | null> {
  const wantsUpside = message.includes("upside trend") || message.includes("live upside");
  const wantsDownside = message.includes("downside trend") || message.includes("live downside");

  if (!wantsUpside && !wantsDownside) return null;

  const strategyKey = wantsUpside
    ? "LIGHTNIN_BULL_UPSIDE_INTRADAY_SIGNAL"
    : "LIGHTNIN_BEAR_DOWNSIDE_INTRADAY_SIGNAL";
  const label = wantsUpside ? "Upside Trend Stocks" : "Downside Trend Stocks";

  const response = await fetch(`${API_BASE_URL}/api/intraday-spreads/all`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch intraday data: ${response.status}`);
  }

  const json = await response.json();
  const allSpreads = (json?.data || {}) as IntradaySpreadMap;
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
      const symbol = String(row.symbol || "UNKNOWN").toUpperCase();
      const status = row.signal_status || "WAITING";
      const entry = safeNumber(row.entry_price ?? row.avg_price);
      const ltp = safeNumber(row.current_ltp);
      const maxLtp = safeNumber(row.max_ltp ?? row.favorable_price);
      lines.push(
        `- ${symbol} | ${status}${entry !== null ? ` | Entry: ${entry.toFixed(2)}` : ""}${ltp !== null ? ` | LTP: ${ltp.toFixed(2)}` : ""}${maxLtp !== null ? ` | Max: ${maxLtp.toFixed(2)}` : ""}`
      );
    });
  } else {
    lines.push("No stock-level signal rows are available yet.");
  }

  if (knowledge) {
    return `${knowledge}\n\n${lines.join("\n")}`;
  }

  return lines.join("\n");
}

async function buildAnswer(question: string): Promise<string> {
  const message = question.toLowerCase().trim();

  if (!message) {
    return getKnowledgeOverview();
  }

  if (
    message.includes("what can you explain") ||
    message.includes("knowledge") ||
    message.includes("help me") ||
    message === "help"
  ) {
    return getKnowledgeOverview();
  }

  const intradayAnswer = await answerFromIntraday(message);
  if (intradayAnswer) return intradayAnswer;

  const category = pickCategory(message);
  if (category) return answerFromStocks(category);

  const explanation = strategyExplanation(message);
  if (explanation) return explanation;

  const knowledgeAnswer = findKnowledgeAnswer(message);
  if (knowledgeAnswer) return knowledgeAnswer;

  if (message.includes("payment") || message.includes("subscription") || message.includes("premium")) {
    return (
      "Premium unlocks the full stock list, intraday option spreads, and intraday stock signals. " +
      "For exact payment validity, open the Pricing/Profile section because subscription status is checked from your account API."
    );
  }

  return (
    "I can help with Lightnin Bull dashboard knowledge, categories, regime signals, intraday stock signals, and option-spread explanations.\n\n" +
    "Try asking:\n" +
    "- Explain the alpha engine\n" +
    "- Explain the risk engine\n" +
    "- What is the rebalancing rule?\n" +
    "- Show Regime Upside stocks\n" +
    "- Show live Upside Trend Stocks\n" +
    "- How to use the Lightnin Bull dashboard"
  );
}

const FloatingAIAgent: React.FC = () => {
  const token = getAuthToken();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);

  const visible = useMemo(() => Boolean(token), [token]);

  if (!visible) return null;

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];

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
          content:
            "AI Agent could not read live Lightnin Bull data right now. Please check backend deployment and try again.",
        },
      ]);
    } finally {
      setLoading(false);
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
              <div
                style={{
                  fontFamily: "var(--font-serif, serif)",
                  fontSize: 22,
                  color: "#f7f0df",
                }}
              >
                Lightnin Bull AI Agent
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
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

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
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
                    background: isUser
                      ? "linear-gradient(135deg, #e2b84b, #f59e0b)"
                      : "rgba(255,255,255,0.055)",
                    color: isUser ? "#050505" : "rgba(255,255,255,0.86)",
                    border: isUser
                      ? "1px solid rgba(226,184,75,0.8)"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {message.content}
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  color: "#e2b84b",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                }}
              >
                AI is reading Lightnin Bull knowledge…
              </div>
            )}
          </div>

          <div
            style={{
              padding: 14,
              borderTop: "1px solid rgba(226,184,75,0.16)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about dashboard, alpha, risk, or signals..."
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
              onClick={sendMessage}
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

export default FloatingAIAgent;
