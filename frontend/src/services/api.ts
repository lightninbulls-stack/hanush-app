import axios from "axios";

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "https://hanush-backend-service.onrender.com").replace(
    /\/+$/,
    ""
  );

export interface Stock {
  rank: number;
  symbol: string;
  sector: string;
  score: number;
  return_1w?: number | null;
  return_1m?: number | null;
  return_3m?: number | null;
  return_6m?: number | null;
  volatility_6m?: number | null;
  volatility_bucket?: string | null;
}

export const fetchStocksByCategory = async (category: string) => {
  const response = await axios.get(`${API_BASE_URL}/stocks/${encodeURIComponent(category)}`);
  return response.data;
};
