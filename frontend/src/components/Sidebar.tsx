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
  const [shockItem, setShockItem] = useState<string | null>(null);

  const triggerCategory = (category: string) => {
    setActiveCategory(category);
    setLogoBurst((prev) => prev + 1);
    setShockItem(category);

    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  useEffect(() => {
    if (!shockItem) return;

    const timer = window.setTimeout(() => {
      setShockItem(null);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [shockItem]);

  const sections: NavSection[] = [
    {
      title: "Navigation",
      items: [
        {
          name: "Watchlist",
          icon: "⭐",
          badge: starredCount > 0 ? starredCount : null,
        },
        { name: "Portfolio Backtest", icon: "📊" },
      ],
    },
    {
      title: "Home",
      items: [
        { name: "Momentum", icon: "⚡" },
        { name: "Low Vol", icon: "📉" },
        { name: "Value", icon: "💰" },
        { name: "Quality", icon: "💎" },
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
      <div
        className={`sidebar-backdrop ${isMobileOpen ? "visible" : ""}`}
        onClick={onCloseMobile}
      />

      <div className={`sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
        <div
          className="sidebar-logo"
          style={{
            padding: "0 24px 34px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <button
            key={logoBurst}
            type="button"
            className="logo-trigger lightning-active"
            onClick={() => triggerCategory("Momentum")}
            aria-label="Lightninbull Home"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            <span className="logo-flash-ring ring-one"></span>
            <span className="logo-flash-ring ring-two"></span>
            <span className="logo-lightning-bolt bolt-one"></span>
            <span className="logo-lightning-bolt bolt-two"></span>
            <span className="logo-lightning-arc arc-left"></span>
            <span className="logo-lightning-arc arc-right"></span>

            <img
              src="/lightninbull-bull.png"
              alt="Lightninbull"
              className="logo-image"
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "10px",
                objectFit: "cover",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </button>

          <h1
            style={{
              fontSize: "1.3rem",
              fontWeight: 900,
              color: "#f4d06f",
              letterSpacing: "0.2px",
              margin: 0,
            }}
          >
            Lightninbull
          </h1>

          {onCloseMobile && (
            <button className="sidebar-close-btn" onClick={onCloseMobile}>
              ✕
            </button>
          )}
        </div>

        {sections.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="nav-section-title">{section.title}</div>

            {section.items.map((item) => (
              <div
                key={item.name}
                className={`nav-item-link ${activeCategory === item.name ? "active" : ""} ${
                  shockItem === item.name ? "electric-active" : ""
                }`}
                onClick={() => triggerCategory(item.name)}
              >
                <span className="nav-electric-line"></span>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.name}</span>

                {item.badge !== undefined && item.badge !== null && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

export default Sidebar;
