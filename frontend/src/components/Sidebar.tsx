import React, { useEffect, useState } from "react";

interface SidebarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  starredCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
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

const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  setActiveCategory,
  starredCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [logoBurst, setLogoBurst] = useState(0);
  const [flashItem, setFlashItem] = useState<string | null>(null);

  const triggerCategory = (category: string) => {
    setActiveCategory(category);
    setLogoBurst((prev) => prev + 1);
    setFlashItem(category);
    if (onCloseMobile) onCloseMobile();
  };

  useEffect(() => {
    if (!flashItem) return;
    const timer = window.setTimeout(() => setFlashItem(null), 850);
    return () => window.clearTimeout(timer);
  }, [flashItem]);

  const sections: NavSection[] = [
    {
      title: "Navigation",
      items: [
        { name: "Watchlist", icon: "⭐", badge: starredCount > 0 ? starredCount : null },
        { name: "Portfolio Backtest", icon: "📊" },
      ],
    },
    {
      title: "Factors",
      items: [
        { name: "Consistent Trending", icon: "⚡" },
        { name: "Slow Movement", icon: "📉" },
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
        aria-label="Main navigation"
      >
        {/* Logo */}
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
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <img
              src="/lightninbull-bull.png"
              alt="LightninBull"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                objectFit: "cover",
                border: "1px solid rgba(250,204,21,0.3)",
                boxShadow: "0 0 14px rgba(250,204,21,0.2)",
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

        {/* Nav sections */}
        {sections.map((section) => (
          <div key={section.title} className="lb-nav-section">
            <div className="lb-nav-section-title">{section.title}</div>

            {section.items.map((item) => {
              const isActive = activeCategory === item.name;
              const isFlash = flashItem === item.name;

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
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.name}</span>

                  {item.badge != null && (
                    <span className="lb-nav-badge">{item.badge}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Bottom padding */}
        <div style={{ height: 32 }} />
      </nav>
    </>
  );
};

export default Sidebar;
