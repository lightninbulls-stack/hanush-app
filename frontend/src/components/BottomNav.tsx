import React from 'react';

const BottomNav: React.FC = () => {
    const navItems = [
        { name: 'Home', icon: '🏠' },
        { name: 'Technicals', icon: '📈' },
        { name: 'Derivative Demand', icon: '📊' },
        { name: 'Guide', icon: '📖' },
    ];

    return (
        <nav className="bottom-nav">
            {navItems.map((item) => (
                <div key={item.name} className={`nav-item ${item.name === 'Home' ? 'active' : ''}`}>
                    <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                    <span>{item.name}</span>
                </div>
            ))}
        </nav>
    );
};

export default BottomNav;
