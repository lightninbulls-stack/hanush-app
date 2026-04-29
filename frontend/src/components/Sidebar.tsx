import React, { useEffect, useState } from "react";

interface SidebarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  starredCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  sidebarWidth?: number;
  isPremium?: boolean;
  daysLeft?: number;
}

interface NavItem {
  name: string;
  icon: string;
  badge?: number | null;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Navigation",
    items: [
      { name: "Watchlist", icon: "⭐" },
      { name: "Portfolio Backtest", icon: "📊" },
    ],
  },
  {
    title: "Universe",
    items: [
      { name: "NSE TOP 200 F&O Universe", icon: "📊" },
      { name: "Sectoral Indices Performance", icon: "📈" },
    ],
  },
  {
    title: "Factors",
    items: [
      { name: "Consistent Trending", icon: "⚡" },
      { name: "Slow Movement", icon: "⚖️" },
      { name: "Cheap Value", icon: "💰" },
      { name: "Best Quality", icon: "💎" },
    ],
  },
  {
    title: "Regime",
    items: [
      { name: "Regime Upside", icon: "📈" },
      { name: "Regime Downside", icon: "📉" },
    ],
  },
  {
    title: "Range Bound",
    items: [
      { name: "Range Bound Upside", icon: "🟢" },
      { name: "Range Bound Downside", icon: "🔴" },
    ],
  },
  {
    title: "Derivative Demand",
    items: [
      { name: "Aggressive Call Option Stocks", icon: "🟢" },
      { name: "Aggressive Put Option Stocks", icon: "🔴" },
    ],
  },
  {
    title: "Intraday Index Option Spreads",
    items: [
      { name: "Bull Call Spreads", icon: "🟢" },
      { name: "Bear Put Spreads", icon: "🔴" },
    ],
  },
  {
    title: "Intraday Stock Signals",
    items: [
      { name: "Upside Trend Stocks", icon: "🟢" },
      { name: "Downside Trend Stocks", icon: "🔴" },
    ],
  },
  {
    title: "Support",
    items: [{ name: "Guide", icon: "📚" }],
  },
  {
    title: "System",
    items: [{ name: "Profile / Settings", icon: "👤" }],
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  setActiveCategory,
  starredCount,
  isMobileOpen = false,
  onCloseMobile,
  sidebarWidth,
  isPremium = false,
  daysLeft = 0,
}) => {
  const [flashItem, setFlashItem] = useState<string | null>(null);
  const [logoBurst, setLogoBurst] = useState(0);

  const triggerCategory = (cat: string) => {
    setActiveCategory(cat);
    setFlashItem(cat);
    setLogoBurst((n) => n + 1);
    onCloseMobile?.();
  };

  useEffect(() => {
    if (!flashItem) return;
    const t = window.setTimeout(() => setFlashItem(null), 750);
    return () => window.clearTimeout(t);
  }, [flashItem]);

  const sectionsWithBadges: NavSection[] = sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.name === "Watchlist"
        ? { ...item, badge: starredCount > 0 ? starredCount : null }
        : item
    ),
  }));

  const getPulseClass = (itemName: string) => {
    if (
      itemName === "Bull Call Spreads" ||
      itemName === "Upside Trend Stocks"
    ) {
      return "lb-sidebar-live-dot lb-sidebar-live-dot-green";
    }

    if (
      itemName === "Bear Put Spreads" ||
      itemName === "Downside Trend Stocks"
    ) {
      return "lb-sidebar-live-dot lb-sidebar-live-dot-red";
    }

    return "";
  };

  return (
    <>
      <div
        className={`lb-sidebar-backdrop${isMobileOpen ? " visible" : ""}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <nav
        className={`lb-sidebar${isMobileOpen ? " mobile-open" : ""}`}
        style={sidebarWidth ? { width: sidebarWidth } : undefined}
        aria-label="Main navigation"
      >
        <div className="lb-sidebar-logo">
          <button
            key={logoBurst}
            type="button"
            onClick={() => triggerCategory("")}
            aria-label="LightninBull Home"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <img
              src="/lightninbull-bull.png"
              alt="LightninBull"
              style={{
                width: 34,
                height: 34,
                borderRadius: 7,
                objectFit: "cover",
                border: "1px solid rgba(240,180,41,0.28)",
                boxShadow: "0 0 10px rgba(240,180,41,0.15)",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </button>

          <h1 className="lb-sidebar-brand">Lightninbull</h1>

          {isPremium && (
            <div className="lb-premium-badge">
              ⚡ PREMIUM
              <span className="lb-premium-days">{daysLeft}d left</span>
            </div>
          )}

          {onCloseMobile && (
            <button
              className="lb-sidebar-close"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          )}
        </div>

        {sectionsWithBadges.map((section) => (
          <div key={section.title} className="lb-nav-section">
            <div className="lb-nav-section-title">{section.title}</div>

            {section.items.map((item) => {
              const isActive = activeCategory === item.name;
              const isFlash = flashItem === item.name;
              const pulseClass = getPulseClass(item.name);

              return (
                <div
                  key={item.name}
                  role="button"
                  tabIndex={0}
                  className={[
                    "lb-nav-item",
                    isActive ? "active" : "",
                    isFlash ? "electric-flash" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => triggerCategory(item.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      triggerCategory(item.name);
                    }
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  {pulseClass ? (
                    <span className={pulseClass} aria-hidden="true" />
                  ) : (
                    <span className="nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}

                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </span>

                  {item.badge != null && (
                    <span className="lb-nav-badge">{item.badge}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{ height: 24 }} />
      </nav>

      <style>{`
        .lb-premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 3px;
          padding: 2px 8px;
          border-radius: 20px;
          background: linear-gradient(90deg, rgba(226,184,75,0.22), rgba(226,184,75,0.10));
          border: 1px solid rgba(226,184,75,0.45);
          color: #e2b84b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
          font-family: var(--font-mono, monospace);
          animation: lb-badge-glow 2.5s ease-in-out infinite;
        }
        .lb-premium-days {
          font-size: 9px;
          font-weight: 500;
          color: rgba(226,184,75,0.65);
        }
        @keyframes lb-badge-glow {
          0%, 100% { box-shadow: 0 0 6px rgba(226,184,75,0.20); }
          50%       { box-shadow: 0 0 14px rgba(226,184,75,0.50); }
        }

        .lb-sidebar-live-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 12px;
          flex-shrink: 0;
          animation: lbSidebarPulse 1.4s ease-in-out infinite;
        }

        .lb-sidebar-live-dot-green {
          background: #22c55e;
          box-shadow:
            0 0 12px rgba(34,197,94,0.85),
            0 0 24px rgba(34,197,94,0.55),
            0 0 42px rgba(34,197,94,0.28);
        }

        .lb-sidebar-live-dot-red {
          background: #ef4444;
          box-shadow:
            0 0 12px rgba(239,68,68,0.85),
            0 0 24px rgba(239,68,68,0.55),
            0 0 42px rgba(239,68,68,0.28);
        }

        @keyframes lbSidebarPulse {
          0%, 100% {
            opacity: 0.45;
            transform: scale(0.9);
          }

          50% {
            opacity: 1;
            transform: scale(1.18);
          }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
