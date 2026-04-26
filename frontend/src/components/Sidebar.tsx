import React, { useEffect, useState } from "react";

interface SidebarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  starredCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  sidebarWidth?: number;
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

  const getIconGlowClass = (itemName: string) => {
    if (
      itemName === "Bull Call Spreads" ||
      itemName === "Upside Trend Stocks"
    ) {
      return "glow-green";
    }

    if (
      itemName === "Bear Put Spreads" ||
      itemName === "Downside Trend Stocks"
    ) {
      return "glow-red";
    }

    return "";
  };

  return (
    <>
      {/* Mobile backdrop */}
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
        {/* Logo row */}
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

        {/* Nav */}
        {sectionsWithBadges.map((section) => (
          <div key={section.title} className="lb-nav-section">
            <div className="lb-nav-section-title">{section.title}</div>

            {section.items.map((item) => {
              const isActive = activeCategory === item.name;
              const isFlash = flashItem === item.name;
              const glowClass = getIconGlowClass(item.name);

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
                  <span
                    className={["nav-icon", glowClass]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

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
    </>
  );
};

export default Sidebar;
