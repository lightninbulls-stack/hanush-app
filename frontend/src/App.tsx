import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StockTable from './components/StockTable';
import TradingViewChart from './components/TradingViewChart';
import StockStats from './components/StockStats';
import { fetchStocksByCategory, type Stock } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Momentum');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [starredSymbols, setStarredSymbols] = useState<string[]>(() => {
    const saved = localStorage.getItem('starredStocks');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('starredStocks', JSON.stringify(starredSymbols));
  }, [starredSymbols]);

  useEffect(() => {
    const getStocks = async () => {
      setLoading(true);
      if (activeTab === 'Watchlist') {
        const data = await fetchStocksByCategory('Momentum');
        setStocks(data.stocks.filter((s: Stock) => starredSymbols.includes(s.symbol)));
      } else {
        const data = await fetchStocksByCategory(activeTab);
        setStocks(data.stocks || []);
      }
      setLoading(false);
    };
    getStocks();
  }, [activeTab, starredSymbols]);

  const handleStarClick = (symbol: string) => {
    setStarredSymbols(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  const handleStockClick = (symbol: string) => {
    setSelectedStock(symbol);
  };

  return (
    <div className="main-layout">
      <Sidebar 
        activeCategory={activeTab} 
        setActiveCategory={setActiveTab} 
        starredCount={starredSymbols.length} 
      />
      
      <div className="content-area">
        {selectedStock ? (
          <div className="detail-container">
            <button className="back-btn" onClick={() => setSelectedStock(null)}>
              <span>←</span> Back to Dashboard
            </button>
            <TradingViewChart symbol={selectedStock} />
            <StockStats symbol={selectedStock} />
          </div>
        ) : activeTab === 'Guide' ? (
          <div className="glass-card" style={{ padding: '40px', margin: '40px' }}>
            <h2 className="glow-text">User Guide</h2>
            <p style={{ marginTop: '20px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
              Welcome to the BullsEye Quant User Guide. This section will help you understand the various metrics and strategies used in the platform.
            </p>
            <ul style={{ marginTop: '20px', color: 'var(--text-dim)', paddingLeft: '20px' }}>
              <li><strong>Momentum:</strong> Stocks showing strong price trends.</li>
              <li><strong>Low Vol:</strong> Stocks with lower price fluctuations.</li>
              <li><strong>Technicals:</strong> Advanced trend analysis using EMA and RSI.</li>
            </ul>
          </div>
        ) : activeTab === 'Profile / Settings' ? (
          <div className="glass-card" style={{ padding: '40px', margin: '40px' }}>
            <h2 className="glow-text">Profile & Settings</h2>
            <p style={{ marginTop: '20px', color: 'var(--text-dim)' }}>Manage your account preferences and application settings here.</p>
            <div style={{ marginTop: '30px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--primary-gold)' }}>Theme</label>
                <select className="glass-card" style={{ background: '#111', color: '#fff', border: 'none', padding: '8px' }}>
                  <option>Elite Dark (Default)</option>
                  <option>Neon Night</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="screener-header">
              <h2 className="glow-text">
                {activeTab} <span style={{ color: 'var(--primary-gold)' }}>Screener</span>
              </h2>
              <p className="screener-subtitle">
                Live insights and professional quantitative metrics for {activeTab}
              </p>
            </div>
            
            <div className="table-view-container">
              {loading ? (
                <div className="loader-container">
                  <div className="loader"></div>
                  <p style={{ marginTop: '20px', color: 'var(--text-dim)', fontWeight: 500 }}>
                    Scanning Excel data for {activeTab}...
                  </p>
                </div>
              ) : (
                <StockTable
                  stocks={stocks}
                  starredSymbols={starredSymbols}
                  onStockClick={handleStockClick}
                  onStarClick={handleStarClick}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
