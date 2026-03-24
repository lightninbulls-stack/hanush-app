import React from 'react';

interface CategoryTabsProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ activeTab, setActiveTab }) => {
    const categories = [
        { name: 'Watchlist', icon: '⭐' },
        { name: 'Momentum', icon: '⚡' },
        { name: 'LowVol', icon: '📉' },
        { name: 'Value', icon: '💰' },
        { name: 'Quality', icon: '💎' },
    ];

    return (
        <div className="category-tabs">
            {categories.map((cat) => (
                <button
                    key={cat.name}
                    className={`category-tab ${activeTab === cat.name ? 'active' : ''}`}
                    onClick={() => setActiveTab(cat.name)}
                >
                    <span>{cat.icon}</span>
                    {cat.name}
                </button>
            ))}
        </div>
    );
};

export default CategoryTabs;
