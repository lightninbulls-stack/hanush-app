import React, { useEffect, useState } from "react";

interface SidebarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  starredCount: number;
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
}) => {
  const [shockItem, setShockItem] = useState<string | null>(null);

  const triggerCategory = (category: string) => {
    setActiveCategory(category);
    setShockItem(category);
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
      ],
    },
    {
      title: "Home",
      items: [
        { name: "Momentum", icon: "⚡" },
        { name: "Low Vol", icon: "🌀" },
        { name: "Value", icon: "💎" },
        { name: "Quality", icon: "🛡️" },
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
      title: "Derivative Demand",
      items: [
        { name: "Aggressive Call Option Stocks", icon: "📞" },
        { name: "Aggressive Put Option Stocks", icon: "🧲" },
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
      items: [{ name: "Guide", icon: "📘" }],
    },
    {
      title: "System",
      items: [{ name: "Profile / Settings", icon: "⚙️" }],
    },
  ];

  return (
    <aside
      style={{
        width: "280px",
        minWidth: "280px",
        background:
          "linear-gradient(180deg, rgba(10,15,27,0.98), rgba(15,23,42,0.98))",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        minHeight: "100vh",
        padding: "18px 14px",
        position: "sticky",
        top: 0,
      }}
    >
      <button
        onClick={() => triggerCategory("Momentum")}
        aria-label="Lightninbull Home"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "18px",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "14px",
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(135deg, rgba(250,204,21,0.25), rgba(234,179,8,0.1))",
            fontSize: "22px",
          }}
        >
          ⚡
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: "20px" }}>
            Lightninbull
          </div>
          <div style={{ color: "#94a3b8", fontSize: "12px" }}>
            Quant Dashboard
          </div>
        </div>
      </button>

      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: "18px" }}>
          <div
            style={{
              color: "#64748b",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "10px 8px",
            }}
          >
            {section.title}
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            {section.items.map((item) => {
              const isActive = activeCategory === item.name;
              const isShock = shockItem === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => triggerCategory(item.name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: isActive
                      ? "1px solid rgba(250,204,21,0.35)"
                      : "1px solid transparent",
                    background: isActive
                      ? "linear-gradient(90deg, rgba(250,204,21,0.16), rgba(255,255,255,0.04))"
                      : "rgba(255,255,255,0.02)",
                    color: isActive ? "#f8fafc" : "#cbd5e1",
                    cursor: "pointer",
                    transform: isShock ? "scale(1.01)" : "scale(1)",
                    transition: "all 0.2s ease",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span>{item.icon}</span>
                    <span style={{ fontWeight: isActive ? 700 : 500 }}>{item.name}</span>
                  </span>

                  {item.badge !== undefined && item.badge !== null && (
                    <span
                      style={{
                        minWidth: "22px",
                        height: "22px",
                        borderRadius: "999px",
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(250,204,21,0.2)",
                        color: "#fde68a",
                        fontSize: "12px",
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
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
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
    if (!
