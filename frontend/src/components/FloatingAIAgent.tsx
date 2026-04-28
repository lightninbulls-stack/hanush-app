import React, { useMemo, useState } from "react";

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

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I am your Lightnin Bull AI Agent. Ask me about Regime Upside, Regime Downside, intraday signals, option spreads, or how to use the dashboard.",
};

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
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
      const response = await fetch(`${API_BASE_URL}/auth/ai-agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: question,
          history: nextMessages.slice(-8),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Agent failed: ${response.status}`);
      }

      const data = await response.json();
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            data?.answer ||
            "I could not generate an answer right now. Please try again.",
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            "AI Agent connection failed. Please check backend deployment and try again.",
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
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.98), rgba(0,0,0,0.96))",
            boxShadow:
              "0 22px 70px rgba(0,0,0,0.65), 0 0 30px rgba(226,184,75,0.12)",
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
                AI is reading Lightnin Bull data…
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
              placeholder="Ask about stocks, signals, or strategies..."
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
                background: loading
                  ? "rgba(226,184,75,0.45)"
                  : "linear-gradient(135deg, #e2b84b, #f59e0b)",
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
