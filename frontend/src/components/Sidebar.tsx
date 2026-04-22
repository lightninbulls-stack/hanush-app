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
        {
          name: "Portfolio Backtest",
          icon: "",
        },
      ],
    },
    {
      title: "Home",
      items: [
        { name: "Momentum", icon: "⚡" },
        { name: "Low Vol", icon: "" },
        { name: "Value", icon: "" },
        { name: "Quality", icon: "" },
      ],
    },
    {
      title: "Regime",
      items: [
        { name: "Regime Upside", icon: "" },
        { name: "Regime Downside", icon: "" },
      ],
    },
    {
      title: "Range Bound",
      items: [
        { name: "Range Bound Upside", icon: "" },
        { name: "Range Bound Downside", icon: "" },
      ],
    },
    {
      title: "Derivative Demand",
      items: [
        { name: "Aggressive Call Option Stocks", icon: "" },
        { name: "Aggressive Put Option Stocks", icon: "" },
      ],
    },
    {
      title: "Intraday Index Option Spreads",
      items: [
        { name: "Bull Call Spreads", icon: "" },
        { name: "Bear Put Spreads", icon: "" },
      ],
    },
    {
      title: "Intraday Stock Signals",
      items: [
        { name: "Upside Trend Stocks", icon: "" },
        { name: "Downside Trend Stocks", icon: "" },
      ],
    },
    {
      title: "Support",
      items: [{ name: "Guide", icon: "" }],
    },
    {
      title: "System",
      items: [{ name: "Profile / Settings", icon: "" }],
    },
  ];

  return (
    <>
      <aside
        className={`sidebar ${isMobileOpen ? "open" : ""}`}
        style={{
          width: "100%",
          height: "100%",
          overflowY: "auto",
          padding: "18px 14px 28px 14px",
          background:
            "linear-gradient(180deg, rgba(7,15,33,0.98) 0%, rgba(9,20,43,0.98) 100%)",
          borderRight: "1px solid rgba(148,163,184,0.08)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <button
            onClick={() => triggerCategory("Momentum")}
            aria-label="Lightninbull Home"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <img
              key={logoBurst}
              src="/lightninbull-logo.png"
              alt="Lightninbull"
              style={{
                width: 160,
                marginBottom: 10,
                display: "block",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />

            <div
              style={{
                color: "#ffffff",
                fontSize: 22,
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              Lightninbull
            </div>
          </button>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              style={{
                background: "transparent",
                border: "1px solid rgba(148,163,184,0.2)",
                color: "#e5e7eb",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 22 }}>
            <div
              style={{
                color: "#6b7280",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              {section.title}
            </div>

            {section.items.map((item) => {
              const active = activeCategory === item.name;
              const shocked = shockItem === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => triggerCategory(item.name)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    background: active ? "rgba(245,158,11,0.14)" : "transparent",
                    border: active
                      ? "1px solid rgba(245,158,11,0.35)"
                      : "1px solid transparent",
                    color: active ? "#fbbf24" : "#e5e7eb",
                    borderRadius: 14,
                    padding: "12px 14px",
                    marginBottom: 6,
                    cursor: "pointer",
                    transform: shocked ? "scale(1.02)" : "scale(1)",
                    transition: "all 0.2s ease",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                  </span>

                  {item.badge !== undefined && item.badge !== null && (
                    <span
                      style={{
                        background: "#111827",
                        color: "#fbbf24",
                        minWidth: 22,
                        height: 22,
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "0 6px",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </aside>
    </>
  );
};

export default Sidebar;
