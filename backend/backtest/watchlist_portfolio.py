from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Set, Tuple
import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

ANNUALIZATION_FACTOR = 252
UNIVERSE_FILE_NAME = "yahoo_finance_ticker_universe_with_sector_business_model.xlsx"
UNIVERSE_SHEET = "Yahoo_Ticker_Map"


def normalize_symbol(value: str) -> str:
    return str(value or "").strip().upper()


def canonical_symbol(value: str) -> str:
    s = normalize_symbol(value)

    if not s:
        return ""

    for prefix in ("NSE:", "BSE:"):
        if s.startswith(prefix):
            s = s[len(prefix):]

    for suffix in (".NS", ".BO", "-EQ"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]

    return "".join(ch for ch in s if ch.isalnum())


def ordered_unique(values: List[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []

    for value in values:
        normalized = normalize_symbol(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            out.append(normalized)

    return out


def symbol_aliases(symbol: str) -> List[str]:
    raw = normalize_symbol(symbol)
    canon = canonical_symbol(symbol)

    aliases: List[str] = []

    if raw:
        aliases.append(raw)

    if canon:
        aliases.extend(
            [
                canon,
                f"{canon}.NS",
                f"{canon}.BO",
                f"{canon}-EQ",
                f"NSE:{canon}",
                f"BSE:{canon}",
                f"NSE:{canon}-EQ",
                f"BSE:{canon}-EQ",
            ]
        )

    return ordered_unique(aliases)


def load_close_prices(close_prices_path: Path) -> pd.DataFrame:
    close = pd.read_csv(close_prices_path, index_col=0)
    close.index = pd.to_datetime(close.index, errors="coerce")
    close = close[~close.index.isna()].sort_index()

    close.columns = [str(c).strip() for c in close.columns]
    close = close.apply(pd.to_numeric, errors="coerce")

    close = close.dropna(axis=0, how="all").dropna(axis=1, how="all")

    if close.empty:
        raise ValueError("close_prices_wide.csv loaded but contains no valid data.")

    return close


def build_normalized_column_lookup(columns: List[str]) -> Dict[str, str]:
    lookup: Dict[str, str] = {}

    for col in columns:
        raw = str(col).strip()
        if not raw:
            continue

        for alias in symbol_aliases(raw):
            lookup.setdefault(alias, raw)

    return lookup


def build_canonical_column_lookup(columns: List[str]) -> Dict[str, str]:
    lookup: Dict[str, str] = {}

    for col in columns:
        raw = str(col).strip()
        canon = canonical_symbol(raw)
        if canon and canon not in lookup:
            lookup[canon] = raw

    return lookup


def load_universe_symbol_map(close_prices_path: Path) -> Dict[str, str]:
    universe_path = close_prices_path.parent / UNIVERSE_FILE_NAME
    if not universe_path.exists():
        logger.warning("Universe workbook not found: %s", universe_path)
        return {}

    try:
        universe = pd.read_excel(universe_path, sheet_name=UNIVERSE_SHEET)
    except Exception as exc:
        logger.warning("Failed to read universe workbook: %s", exc)
        return {}

    col_map = {str(c).strip(): c for c in universe.columns}
    nse_col = col_map.get("NSE Symbol")
    yahoo_col = col_map.get("Yahoo Finance Ticker")
    underlying_col = col_map.get("Underlying")

    if yahoo_col is None:
        logger.warning("Yahoo Finance Ticker column not found in universe workbook.")
        return {}

    symbol_map: Dict[str, str] = {}

    def register(key: str, ticker: str) -> None:
        nkey = normalize_symbol(key)
        ckey = canonical_symbol(key)
        nticker = normalize_symbol(ticker)

        if not nticker:
            return

        if nkey:
            symbol_map[nkey] = nticker
        if ckey:
            symbol_map[ckey] = nticker

    for _, row in universe.iterrows():
        yahoo_ticker = str(row[yahoo_col]).strip() if pd.notna(row[yahoo_col]) else ""
        if not yahoo_ticker:
            continue

        if nse_col is not None and pd.notna(row[nse_col]):
            register(str(row[nse_col]), yahoo_ticker)

        if underlying_col is not None and pd.notna(row[underlying_col]):
            register(str(row[underlying_col]), yahoo_ticker)

        register(yahoo_ticker, yahoo_ticker)

    return symbol_map


def resolve_symbol_to_column(
    requested_symbol: str,
    normalized_column_lookup: Dict[str, str],
    canonical_column_lookup: Dict[str, str],
    universe_symbol_map: Dict[str, str],
    all_columns: List[str],
) -> str | None:
    requested_norm = normalize_symbol(requested_symbol)
    requested_canon = canonical_symbol(requested_symbol)

    candidates: List[str] = []
    candidates.extend(symbol_aliases(requested_symbol))

    mapped_ticker = universe_symbol_map.get(requested_norm) or universe_symbol_map.get(
        requested_canon
    )
    if mapped_ticker:
        candidates.extend(symbol_aliases(mapped_ticker))

    candidates = ordered_unique(candidates)

    # Pass 1: normalized exact match
    for candidate in candidates:
        if candidate in normalized_column_lookup:
            return normalized_column_lookup[candidate]

    # Pass 2: canonical exact match
    for candidate in candidates:
        candidate_canon = canonical_symbol(candidate)
        if candidate_canon and candidate_canon in canonical_column_lookup:
            return canonical_column_lookup[candidate_canon]

    # Pass 3: unique fuzzy contains match
    candidate_canons = ordered_unique([canonical_symbol(c) for c in candidates if canonical_symbol(c)])
    if candidate_canons:
        fuzzy_matches: List[str] = []

        for col in all_columns:
            col_canon = canonical_symbol(col)
            if any(
                cand in col_canon or col_canon in cand
                for cand in candidate_canons
                if cand
            ):
                fuzzy_matches.append(col)

        fuzzy_matches = list(dict.fromkeys(fuzzy_matches))
        if len(fuzzy_matches) == 1:
            return fuzzy_matches[0]

    return None


def period_return(nav: pd.Series, window: int):
    if len(nav) <= window:
        return None
    return float((nav.iloc[-1] / nav.iloc[-window - 1] - 1.0) * 100.0)


def historical_var_pct(returns: pd.Series, confidence: float = 0.95):
    clean = returns.dropna()
    if clean.empty:
        return None

    alpha = 1.0 - confidence
    cutoff = np.quantile(clean, alpha)
    return abs(float(cutoff) * 100.0)


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

    r1w = period_return(nav, 5)
    r1m = period_return(nav, 21)
    r3m = period_return(nav, 63)
    r6m = period_return(nav, 126)

    var_95 = historical_var_pct(portfolio_ret, confidence=0.95)

    return {
        "cumulative_return_pct": round(cumulative_return, 2),
        "cagr_pct": round(cagr, 2),
        "annualized_volatility_pct": round(vol, 2),
        "sharpe": round(sharpe, 2),
        "max_drawdown_pct": round(mdd, 2),
        "return_1w_pct": round(r1w, 2) if r1w is not None else None,
        "return_1m_pct": round(r1m, 2) if r1m is not None else None,
        "return_3m_pct": round(r3m, 2) if r3m is not None else None,
        "return_6m_pct": round(r6m, 2) if r6m is not None else None,
        "var_95_pct": round(var_95, 2) if var_95 is not None else None,
    }


def run_watchlist_backtest(
    user_symbols: List[str],
    close_prices_path: Path,
    lookback_days: int = 252,
) -> Tuple[dict, pd.DataFrame, pd.DataFrame]:
    if not user_symbols:
        raise ValueError("Watchlist is empty.")

    close = load_close_prices(close_prices_path)
    all_columns = close.columns.tolist()

    normalized_column_lookup = build_normalized_column_lookup(all_columns)
    canonical_column_lookup = build_canonical_column_lookup(all_columns)
    universe_symbol_map = load_universe_symbol_map(close_prices_path)

    matched_pairs: List[Tuple[str, str]] = []
    unmatched_symbols: List[str] = []
    seen_requested: Set[str] = set()

    for raw_symbol in user_symbols:
        requested_symbol = normalize_symbol(raw_symbol)

        if not requested_symbol or requested_symbol in seen_requested:
            continue

        seen_requested.add(requested_symbol)

        matched_column = resolve_symbol_to_column(
            requested_symbol=requested_symbol,
            normalized_column_lookup=normalized_column_lookup,
            canonical_column_lookup=canonical_column_lookup,
            universe_symbol_map=universe_symbol_map,
            all_columns=all_columns,
        )

        if matched_column:
            matched_pairs.append((requested_symbol, matched_column))
        else:
            unmatched_symbols.append(requested_symbol)

    logger.info("Matched watchlist pairs: %s", matched_pairs)
    if unmatched_symbols:
        logger.warning("Unmatched watchlist symbols: %s", unmatched_symbols)
        logger.warning("Sample close_prices_wide columns: %s", all_columns[:50])

    if not matched_pairs:
        raise ValueError("None of the watchlist symbols matched close_prices_wide.csv.")

    requested_to_column = dict(matched_pairs)
    selected_columns = list(dict.fromkeys(requested_to_column.values()))

    close_subset = close[selected_columns].copy().tail(lookback_days + 1)
    close_subset = close_subset.ffill().dropna(axis=1, how="all")

    if close_subset.shape[1] == 0:
        raise ValueError("No matched symbols had sufficient price history for backtest.")

    valid_columns = [
        col for col in close_subset.columns
        if close_subset[col].dropna().shape[0] >= 2
    ]
    close_subset = close_subset[valid_columns]

    if close_subset.shape[1] == 0:
        raise ValueError("Matched symbols were found, but none survived after price-history filtering.")

    close_subset = close_subset.dropna(axis=0, how="all").ffill()

    surviving_columns = close_subset.columns.tolist()

    column_to_requested: Dict[str, str] = {}
    for requested_symbol, actual_column in matched_pairs:
        if actual_column in surviving_columns:
            column_to_requested[actual_column] = requested_symbol

    if not column_to_requested:
        raise ValueError("Matched symbols were found, but none survived after price-history filtering.")

    close_subset = close_subset[surviving_columns].dropna(axis=0, how="any")

    if close_subset.shape[0] < 2:
        raise ValueError("Not enough overlapping price history to run backtest.")

    daily_ret = close_subset.pct_change().dropna()

    if daily_ret.empty:
        raise ValueError("Could not compute daily returns for the matched symbols.")

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
