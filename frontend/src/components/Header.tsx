import React from 'react';

const Header: React.FC = () => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="header">
      <div className="logo-section">
        <div className="logo-icon">
          <img src="/assets/logo.png" alt="Bullseye Quant" />
        </div>
        <h1 className="logo-text">Trading Ideas</h1>
      </div>
      <div className="user-avatar-section">
        {/* Placeholder for user avatar */}
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#333' }}></div>
      </div>
      <div className="welcome-section">
        <span className="welcome-text">Welcome,</span>
        <span className="user-name">Traders</span>
        <span className="date-text">{currentDate}</span>
      </div>
    </header>
  );
};

export default Header;
