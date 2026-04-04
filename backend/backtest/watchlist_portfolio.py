from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

ANNUALIZATION_FACTOR = 252


def normalize_symbol(value: str) -> str:
    return str(value or "").strip().upper()


def symbol_aliases(symbol: str) -> List[str]:
    """
    Generate a few safe aliases so matching works whether the CSV columns are:
    - RELIANCE
    - RELIANCE.NS
    """
    s = normalize_symbol(symbol)
    aliases = {s}

    if s.endswith(".NS"):
        aliases.add(s[:-3])
    else:
        aliases.add(f"{s}.NS")

    return [a for a in aliases if a]


def load_close_prices(close_prices_path: Path) -> pd.DataFrame:
    close = pd.read_csv(close_prices_path, index_col=0)
    close.index = pd.to_datetime(close.index, errors="coerce")
    close = close[~close.index.isna()].sort_index()

    close.columns = [str(c).strip() for c in close.columns]
    close = close.apply(pd.to_numeric, errors="coerce")

    return close.dropna(axis=0, how="all").dropna(axis=1, how="all")


def build_column_lookup(columns: List[str]) -> Dict[str, str]:
    """
    Maps normalized symbol aliases to the actual CSV column name.
    Example:
    RELIANCE -> RELIANCE
    RELIANCE.NS -> RELIANCE.NS
    RELIANCE -> RELIANCE.NS (fallback alias)
    """
    lookup: Dict[str, str] = {}

    for col in columns:
        raw = str(col).strip()
        norm = normalize_symbol(raw)

        if norm not in lookup:
            lookup[norm] = raw

        if norm.endswith(".NS"):
            base = norm[:-3]
            if base and base not in lookup:
                lookup[base] = raw
        else:
            ns_alias = f"{norm}.NS"
            if ns_alias not in lookup:
                lookup[ns_alias] = raw

    return lookup


def period_return(nav: pd.Series, window: int):
    if len(nav) <= window:
        return None
    return float((nav.iloc[-1] / nav.iloc[-window - 1] - 1.0) * 100.0)


def compute_metrics(portfolio_ret: pd.Series, nav: pd.Series) -> dict:
    cumulative_return = float((nav.iloc[-1] - 1.0) * 100.0)

    years = len(portfolio_ret) / ANNUALIZATION_FACTOR
    cagr = (
        float((nav.iloc[-1] ** (1.0 / years) - 1.0) * 100.0)
        if years > 0
        else 0.0
    )

    vol = float(portfolio_ret.std() * np.sqrt(ANNUALIZATION_FACTOR) * 100.0)

    sharpe = (
        float((portfolio_ret.mean() / portfolio_ret.std()) * np.sqrt(ANNUALIZATION_FACTOR))
        if portfolio_ret.std() > 0
        else 0.0
    )

    running_max = nav.cummax()
    drawdown = nav / running_max - 1.0
    mdd = float(drawdown.min() * 100.0)

    r1m = period_return(nav, 21)
    r3m = period_return(nav, 63)
    r6m = period_return(nav, 126)

    return {
        "cumulative_return_pct": round(cumulative_return, 2),
        "cagr_pct": round(cagr, 2),
        "annualized_volatility_pct": round(vol, 2),
        "sharpe": round(sharpe, 2),
        "max_drawdown_pct": round(mdd, 2),
        "return_1m_pct": round(r1m, 2) if r1m is not None else None,
        "return_3m_pct": round(r3m, 2) if r3m is not None else None,
        "return_6m_pct": round(r6m, 2) if r6m is not None else None,
    }


def run_watchlist_backtest(
    user_symbols: List[str],
    close_prices_path: Path,
    lookback_days: int = 252,
) -> Tuple[dict, pd.DataFrame, pd.DataFrame]:
    if not user_symbols:
        raise ValueError("Watchlist is empty.")

    close = load_close_prices(close_prices_path)
    column_lookup = build_column_lookup(close.columns.tolist())

    matched_pairs: List[Tuple[str, str]] = []
    seen_requested = set()

    for raw_symbol in user_symbols:
        requested_symbol = normalize_symbol(raw_symbol)

        if not requested_symbol or requested_symbol in seen_requested:
            continue

        seen_requested.add(requested_symbol)

        matched_column = None
        for alias in symbol_aliases(requested_symbol):
            if alias in column_lookup:
                matched_column = column_lookup[alias]
                break

        if matched_column:
            matched_pairs.append((requested_symbol, matched_column))

    if not matched_pairs:
        raise ValueError("None of the watchlist symbols matched close_prices_wide.csv.")

    requested_to_column = dict(matched_pairs)
    selected_columns = list(requested_to_column.values())

    close_subset = close[selected_columns].copy().tail(lookback_days + 1)
    close_subset = close_subset.ffill().dropna(axis=1, how="any")

    if close_subset.shape[1] == 0:
        raise ValueError("No matched symbols had sufficient price history for backtest.")

    surviving_columns = close_subset.columns.tolist()

    # Reverse map actual CSV column -> user requested symbol
    column_to_requested: Dict[str, str] = {}
    for requested_symbol, actual_column in matched_pairs:
        if actual_column in surviving_columns:
            column_to_requested[actual_column] = requested_symbol

    if not column_to_requested:
        raise ValueError("Matched symbols were found, but none survived after price-history filtering.")

    daily_ret = close_subset.pct_change().dropna()

    n = daily_ret.shape[1]
    weights = np.repeat(1.0 / n, n)

    portfolio_ret = daily_ret.dot(weights)
    nav = (1.0 + portfolio_ret).cumprod()

    metrics = compute_metrics(portfolio_ret, nav)

    curve = pd.DataFrame(
        {
            "date": nav.index.strftime("%Y-%m-%d"),
            "nav": nav.round(6).values,
        }
    )

    start_prices = close_subset.iloc[0]
    end_prices = close_subset.iloc[-1]

    holdings = pd.DataFrame(
        {
            "Symbol": [column_to_requested[col] for col in surviving_columns],
            "weight": weights,
            "start_price": start_prices.values,
            "end_price": end_prices.values,
            "total_return_pct": (
                (end_prices / start_prices - 1.0) * 100.0
            ).round(2).values,
        }
    )

    holdings = holdings.sort_values("Symbol").reset_index(drop=True)

    return metrics, curve, holdings
