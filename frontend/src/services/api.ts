import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Existing types (unchanged) ───────────────────────────────────────────────

export interface Stock {
    rank: number;
    symbol: string;
    sector: string;
    score: number;
    return_3m: number;
    return_6m: number;
}

// ─── Existing function (unchanged) ───────────────────────────────────────────

export const fetchStocksByCategory = async (category: string) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/stocks/${category}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching stocks:', error);
        return {
            category,
            stocks: [
                { rank: 1, symbol: "SHRIRAMFIN", sector: "Financial Services", score: 100, return_3m: 5.65, return_6m: 87.61 },
                { rank: 2, symbol: "VEDL",       sector: "Metals & Mining",     score: 86,  return_3m: 18.58, return_6m: 87.61 },
                { rank: 3, symbol: "CANBK",      sector: "Private Sector",      score: 86,  return_3m: 0.37,  return_6m: 70.71 },
            ]
        };
    }
};

// ─── New functions for Zerodha market data ────────────────────────────────────

export interface SymbolInfo {
    symbol: string;
    exchange: string;
    name?: string;
    sector?: string;
    instrument_token?: number;
}

export interface LivePrice {
    symbol: string;
    price: number;
    timestamp: string;
    timeframe: string;
}

/** Fetch all actively tracked symbols from DB */
export const fetchSymbols = async (): Promise<SymbolInfo[]> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/symbols`);
        return response.data.symbols ?? [];
    } catch (error) {
        console.error('Error fetching symbols:', error);
        return [];
    }
};

/** Fetch latest price for a single symbol from DB */
export const fetchLatestPrice = async (symbol: string): Promise<LivePrice | null> => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/price/${symbol.toUpperCase()}`);
        return response.data;
    } catch (error) {
        return null;
    }
};

/** Batch fetch latest prices for a list of symbols */
export const fetchBulkPrices = async (symbols: string[]): Promise<Record<string, LivePrice>> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/prices`, symbols);
        return response.data;
    } catch (error) {
        console.error('Error fetching bulk prices:', error);
        return {};
    }
};

/** Auth */
export const register = async (name: string, email: string, password: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, { name, email, password });
    return response.data;
};

export const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
    return response.data;
};
