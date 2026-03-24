import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Stock {
    rank: number;
    symbol: string;
    sector: string;
    score: number;
    return_3m: number;
    return_6m: number;
}

export const fetchStocksByCategory = async (category: string) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/stocks/${category}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching stocks:', error);
        // Return mock data for development if backend is not running
        return {
            category,
            stocks: [
                { rank: 1, symbol: "SHRIRAMFIN", sector: "Financial Services", score: 100, return_3m: 5.65, return_6m: 87.61 },
                { rank: 2, symbol: "VEDL", sector: "Metals & Mining", score: 86, return_3m: 18.58, return_6m: 87.61 },
                { rank: 3, symbol: "CANBK", sector: "Private Sector", score: 86, return_3m: 0.37, return_6m: 70.71 },
            ]
        };
    }
};
