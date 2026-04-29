import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://hanush-backend-service1.onrender.com";

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
}

export interface StockCategoryResponse {
  category: string;
  stocks: Stock[];
}

export async function fetchStocksByCategory(
  category: string
): Promise<StockCategoryResponse> {
  if (category === "NSE TOP 200 F&O Universe") {
    const res = await axios.get(
      `${API_BASE_URL}/portfolio/universe/nse-top-200-fo`
    );
    return res.data;
  }

  if (category === "Sectoral Indices Performance") {
    const res = await axios.get(
      `${API_BASE_URL}/portfolio/universe/sectoral-indices-performance`
    );
    return res.data;
  }

  const res = await axios.get(
    `${API_BASE_URL}/stocks/${encodeURIComponent(category)}`
  );

  return res.data;
}

export function getCachedStocksByCategory() {
  return null;
}
