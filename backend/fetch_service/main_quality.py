import os
from typing import Dict, List

import pandas as pd


def fetch_from_quality_csv() -> List[Dict]:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "..", "data", "quality_latest.csv")

    try:
        if not os.path.exists(csv_path):
            print(f"Quality CSV not found at {csv_path}")
            return []

        df = pd.read_csv(csv_path)
        print(f"Successfully read quality CSV. Found {len(df)} rows.")

        stocks: List[Dict] = []

        for i, row in df.iterrows():
            symbol = row.get("Symbol")
            if pd.isna(symbol):
                continue

            sector = row.get("Sector", "N/A")
            score = row.get("Score", 0)
            ret1w = row.get("1W Return", 0)
            ret1m = row.get("1M Return", 0)
            ret3m = row.get("3M Return", 0)
            ret6m = row.get("6M Return", 0)
            vol6m = row.get("6M Volatility", 0)
            vol_bucket = row.get("Volatility Bucket", "N/A")

            stocks.append(
                {
                    "rank": int(row.get("Rank", i + 1)),
                    "symbol": str(symbol),
                    "sector": str(sector) if not pd.isna(sector) else "N/A",
                    "score": int(float(score)) if not pd.isna(score) else 0,
                    "return_1w": float(ret1w) if not pd.isna(ret1w) else 0.0,
                    "return_1m": float(ret1m) if not pd.isna(ret1m) else 0.0,
                    "return_3m": float(ret3m) if not pd.isna(ret3m) else 0.0,
                    "return_6m": float(ret6m) if not pd.isna(ret6m) else 0.0,
                    "volatility_6m": float(vol6m) if not pd.isna(vol6m) else 0.0,
                    "volatility_bucket": str(vol_bucket) if not pd.isna(vol_bucket) else "N/A",
                }
            )

        print(f"Mapped {len(stocks)} quality CSV records")
        return stocks

    except Exception as e:
        print(f"Error reading quality CSV {csv_path}: {e}")
        return []
