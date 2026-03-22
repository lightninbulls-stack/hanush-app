import React from 'react';

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

const Sidebar: React.FC<SidebarProps> = ({ activeCategory, setActiveCategory, starredCount }) => {
  const sections: NavSection[] = [
    {
      title: 'Navigation',
      items: [
        { name: 'Watchlist', icon: '⭐', badge: starredCount > 0 ? starredCount : null },
      ]
    },
    {
      title: 'Home',
      items: [
        { name: 'Momentum', icon: '⚡' },
        { name: 'Low Vol', icon: '📉' },
        { name: 'Value', icon: '💰' },
        { name: 'Quality', icon: '💎' },
      ]
    },
    {
      title: 'Regime',
      items: [
        { name: 'Regime Upside', icon: '📈' },
        { name: 'Regime Downside', icon: '📉' },
      ]
    },
    {
      title: 'Derivative Demand',
      items: [
        { name: 'Aggressive Call Option Stocks', icon: '🟢' },
        { name: 'Aggressive Put Option Stocks', icon: '🔴' },
      ]
    },
    {
      title: 'Support',
      items: [
        { name: 'Guide', icon: '📚' },
      ]
    },
    {
      title: 'System',
      items: [
        { name: 'Profile / Settings', icon: '👤' },
      ]
    }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <img src="/assets/bull_logo.png" alt="Logo" style={{ borderRadius: '8px' }} />
        <h1>lightninbulls</h1>
      </div>

      {sections.map(section => (
        <div key={section.title} className="nav-section">
          <div className="nav-section-title">{section.title}</div>
          {section.items.map(item => (
            <div
              key={item.name}
              className={`nav-item-link ${activeCategory === item.name ? 'active' : ''}`}
              onClick={() => setActiveCategory(item.name)}
            >
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
  );
};

export default Sidebar;
