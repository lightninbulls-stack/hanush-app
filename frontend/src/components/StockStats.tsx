import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface StockInfo {
    symbol: string;
    name?: string;
    sector?: string;
    market_cap?: number;
    pe_ratio?: number;
    high_52w?: number;
    low_52w?: number;
    summary?: string;
    price?: number;
    change_pct?: number;
}

const StockStats: React.FC<{ symbol: string }> = ({ symbol }) => {
    const [info, setInfo] = useState<StockInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    useEffect(() => {
        const fetchInfo = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/stocks/info/${symbol}`);
                setInfo(response.data);
            } catch (error) {
                console.error("Error fetching stock info:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInfo();
    }, [symbol]);

    if (loading) return (
        <div className="loader-container">
            <span className="loader"></span>
            <p style={{ marginTop: '20px', color: 'var(--text-dim)' }}>Analyzing fundamentals...</p>
        </div>
    );
    if (!info) return null;

    const formatCurrency = (val?: number) => {
        if (!val) return 'N/A';
        // Market cap in Cr if large
        if (val > 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
    };

    const formatNumber = (val?: number) => {
        if (val === undefined || val === null) return 'N/A';
        return val.toFixed(2);
    };

    return (
        <div className="detail-container">
            <div className="stats-header">
                <div className="title-area">
                    <h3 className="glow-text">{info.name}</h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                        <span className="symbol-tag" style={{ color: 'var(--primary-gold)', fontWeight: 800 }}>{info.symbol}</span>
                        <span className="sector-tag">{info.sector}</span>
                    </div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-tile glass-card">
                    <span className="stat-label">Market Cap</span>
                    <span className="stat-value">{formatCurrency(info.market_cap)}</span>
                </div>
                <div className="stat-tile glass-card">
                    <span className="stat-label">P/E Ratio</span>
                    <span className="stat-value">{formatNumber(info.pe_ratio)}</span>
                </div>
                <div className="stat-tile glass-card">
                    <span className="stat-label">52W High</span>
                    <span className="stat-value" style={{ color: 'var(--green-accent)' }}>{formatCurrency(info.high_52w)}</span>
                </div>
                <div className="stat-tile glass-card">
                    <span className="stat-label">52W Low</span>
                    <span className="stat-value" style={{ color: 'var(--red-accent)' }}>{formatCurrency(info.low_52w)}</span>
                </div>
            </div>

            {info.summary && (
                <div className="stats-summary glass-card" style={{ marginTop: '30px', padding: '30px' }}>
                    <h4 style={{ color: 'var(--primary-gold)', marginBottom: '15px', fontSize: '1.1rem' }}>Business Overview</h4>
                    <p style={{ color: 'var(--text-dim)', lineHeight: '1.8' }}>
                        {info.summary.length > 500 ? info.summary.substring(0, 500) + '...' : info.summary}
                    </p>
                </div>
            )}
        </div>
    );
};

export default StockStats;
