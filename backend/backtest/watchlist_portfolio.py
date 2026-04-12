from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Set, Tuple
import logging
import math

import numpy as np
import pandas as pd
from scipy.optimize import minimize

logger = logging.getLogger(__name__)

ANNUALIZATION_FACTOR = 252
UNIVERSE_FILE_NAME = "yahoo_finance_ticker_universe_with_sector_business_model.xlsx"
UNIVERSE_SHEET = "Yahoo_Ticker_Map"

BENCHMARK_CANDIDATES = [
    "NIFTY 50",
    "NIFTY50",
    "NIFTY_50",
    "NIFTY-50",
    "^NSEI",
    "NSEI",
    "NIFTY50.NS",
]


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


def _looks_like_broken_header(columns: List[str]) -> bool:
    if not columns:
        return False

    unnamed_count = sum(
        1 for c in columns if str(c).strip().upper().startswith("UNNAMED:")
    )
    return unnamed_count >= max(3, len(columns) // 2)


def _promote_first_row_as_header(raw_df: pd.DataFrame) -> pd.DataFrame:
    if raw_df.empty:
        return raw_df

    first_row = raw_df.iloc[0].tolist()
    promoted_columns = [str(x).strip() for x in first_row]

    fixed = raw_df.iloc[1:].copy()
    fixed.columns = promoted_columns
    return fixed


def parse_existing_date_index(index_like: pd.Index) -> pd.DatetimeIndex:
    """
    Safely parse mixed legacy date strings from close_prices_wide.csv.

    Supports:
    - DD/MM/YY
    - DD-MM-YY
    - DD/MM/YYYY
    - DD-MM-YYYY
    - YYYY-MM-DD
    - YYYY/MM/DD
    """
    raw_index = pd.Index(index_like).astype(str).str.strip()

    parsed = pd.Series(pd.NaT, index=range(len(raw_index)), dtype="datetime64[ns]")

    known_formats = [
        "%d/%m/%y",
        "%d-%m-%y",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]

    for fmt in known_formats:
        remaining_mask = parsed.isna().to_numpy()
        if not remaining_mask.any():
            break

        candidate = pd.to_datetime(
            raw_index[remaining_mask],
            format=fmt,
            errors="coerce",
        )
        parsed.loc[parsed.isna()] = candidate.to_numpy()

    if parsed.isna().any():
        remaining_mask = parsed.isna().to_numpy()
        parsed.loc[remaining_mask] = pd.to_datetime(
            raw_index[remaining_mask],
            errors="coerce",
            dayfirst=True,
        ).to_numpy()

    return pd.DatetimeIndex(parsed).normalize()


def load_close_prices(close_prices_path: Path) -> pd.DataFrame:
    close = pd.read_csv(close_prices_path, index_col=0)

    if _looks_like_broken_header(close.columns.tolist()):
        logger.warning(
            "Detected broken CSV header in close_prices_wide.csv. Attempting header repair."
        )

        raw = pd.read_csv(close_prices_path, header=0)
        raw = _promote_first_row_as_header(raw)

        first_col = raw.columns[0]
        raw = raw.rename(columns={first_col: "Date"})
        raw = raw.set_index("Date")

        close = raw.copy()

    # FIX: robust parsing instead of generic pd.to_datetime(..., dayfirst=True)
    close.index = parse_existing_date_index(close.index)
    close = close[~close.index.isna()].copy()

    # Remove future rows created by bad legacy parsing
    today = pd.Timestamp.utcnow().tz_localize(None).normalize()
    close = close[close.index <= today].copy()

    # Keep last record if duplicate dates exist
    close = close[~close.index.duplicated(keep="last")].copy()
    close = close.sort_index()

    close.columns = [str(c).strip() for c in close.columns]
    close = close.apply(pd.to_numeric, errors="coerce")

    close = close.dropna(axis=0, how="all").dropna(axis=1, how="all")

    if close.empty:
        raise ValueError("close_prices_wide.csv loaded but contains no valid data.")

    logger.warning(
        "BACKTEST DATE RANGE | rows=%s | start=%s | end=%s",
        len(close),
        close.index.min().date(),
        close.index.max().date(),
    )
    logger.info("Final close_prices_wide columns sample: %s", close.columns[:20].tolist())
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


def load_universe_sheet(close_prices_path: Path) -> pd.DataFrame:
    universe_path = close_prices_path.parent / UNIVERSE_FILE_NAME
    if not universe_path.exists():
        logger.warning("Universe workbook not found: %s", universe_path)
        return pd.DataFrame()

    try:
        universe = pd.read_excel(universe_path, sheet_name=UNIVERSE_SHEET)
    except Exception as exc:
        logger.warning("Failed to read universe workbook: %s", exc)
        return pd.DataFrame()

    universe.columns = [str(c).strip() for c in universe.columns]
    return universe


def load_universe_symbol_map(close_prices_path: Path) -> Dict[str, str]:
    universe = load_universe_sheet(close_prices_path)
    if universe.empty:
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


def load_universe_sector_map(close_prices_path: Path) -> Dict[str, str]:
    universe = load_universe_sheet(close_prices_path)
    if universe.empty:
        return {}

    col_map = {str(c).strip(): c for c in universe.columns}
    yahoo_col = col_map.get("Yahoo Finance Ticker")
    nse_col = col_map.get("NSE Symbol")
    underlying_col = col_map.get("Underlying")

    sector_col = None
    for candidate in (
        "GICSSectorKey",
        "GICS Sector",
        "Sector",
        "Sector Name",
        "GICS Sector Name",
        "Business Model",
    ):
        if candidate in col_map:
            sector_col = col_map[candidate]
            break

    if yahoo_col is None or sector_col is None:
        logger.warning(
            "Could not find sector metadata columns in universe workbook. "
            "MVO sector constraints may be unavailable."
        )
        return {}

    sector_map: Dict[str, str] = {}

    def register(key: str, sector_value: str) -> None:
        nkey = normalize_symbol(key)
        ckey = canonical_symbol(key)
        sec = str(sector_value).strip()

        if not sec:
            return

        if nkey:
            sector_map[nkey] = sec
        if ckey:
            sector_map[ckey] = sec

    for _, row in universe.iterrows():
        if pd.isna(row[sector_col]):
            continue

        sector_value = str(row[sector_col]).strip()
        if not sector_value:
            continue

        if yahoo_col is not None and pd.notna(row[yahoo_col]):
            register(str(row[yahoo_col]), sector_value)

        if nse_col is not None and pd.notna(row[nse_col]):
            register(str(row[nse_col]), sector_value)

        if underlying_col is not None and pd.notna(row[underlying_col]):
            register(str(row[underlying_col]), sector_value)

    return sector_map


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

    for candidate in candidates:
        if candidate in normalized_column_lookup:
            return normalized_column_lookup[candidate]

    for candidate in candidates:
        candidate_canon = canonical_symbol(candidate)
        if candidate_canon and candidate_canon in canonical_column_lookup:
            return canonical_column_lookup[candidate_canon]

    candidate_canons = ordered_unique(
        [canonical_symbol(c) for c in candidates if canonical_symbol(c)]
    )

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


def resolve_benchmark_column(
    all_columns: List[str],
    normalized_column_lookup: Dict[str, str],
    canonical_column_lookup: Dict[str, str],
) -> str | None:
    for candidate in BENCHMARK_CANDIDATES:
        for alias in symbol_aliases(candidate):
            if alias in normalized_column_lookup:
                return normalized_column_lookup[alias]

            alias_canon = canonical_symbol(alias)
            if alias_canon and alias_canon in canonical_column_lookup:
                return canonical_column_lookup[alias_canon]

    benchmark_canonical_targets = {canonical_symbol(x) for x in BENCHMARK_CANDIDATES}

    for col in all_columns:
        if canonical_symbol(col) in benchmark_canonical_targets:
            return col

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


def compute_metrics(returns: pd.Series, nav: pd.Series) -> dict:
    cumulative_return = float((nav.iloc[-1] - 1.0) * 100.0)

    years = len(returns) / ANNUALIZATION_FACTOR
    cagr = (
        float((nav.iloc[-1] ** (1.0 / years) - 1.0) * 100.0)
        if years > 0
        else 0.0
    )

    vol = float(returns.std() * np.sqrt(ANNUALIZATION_FACTOR) * 100.0)

    sharpe = (
        float((returns.mean() / returns.std()) * np.sqrt(ANNUALIZATION_FACTOR))
        if returns.std() > 0
        else 0.0
    )

    running_max = nav.cummax()
    drawdown = nav / running_max - 1.0
    mdd = float(drawdown.min() * 100.0)

    r1w = period_return(nav, 5)
    r1m = period_return(nav, 21)
    r3m = period_return(nav, 63)
    r6m = period_return(nav, 126)

    var_95 = historical_var_pct(returns, confidence=0.95)

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


def build_curve(nav: pd.Series) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": nav.index.strftime("%Y-%m-%d"),
            "nav": nav.round(6).values,
        }
    )


def compute_beta_and_correlation(
    portfolio_returns: pd.Series,
    benchmark_returns: pd.Series,
) -> Tuple[float | None, float | None]:
    common_index = portfolio_returns.index.intersection(benchmark_returns.index)
    if len(common_index) < 2:
        return None, None

    p = portfolio_returns.loc[common_index]
    b = benchmark_returns.loc[common_index]

    benchmark_var = float(b.var())
    beta = None
    if benchmark_var > 0:
        beta = float(p.cov(b) / benchmark_var)

    correlation = float(p.corr(b)) if b.std() > 0 and p.std() > 0 else None
    return beta, correlation


def prepare_watchlist_data(
    user_symbols: List[str],
    close_prices_path: Path,
    lookback_days: int = 252,
):
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

    if not matched_pairs:
        raise ValueError("None of the watchlist symbols matched close_prices_wide.csv.")

    requested_to_column = dict(matched_pairs)
    selected_columns = list(dict.fromkeys(requested_to_column.values()))

    close_subset = close[selected_columns].copy().tail(lookback_days + 1)
    close_subset = close_subset.ffill().dropna(axis=1, how="all")

    if close_subset.shape[1] == 0:
        raise ValueError("No matched symbols had sufficient price history for backtest.")

    valid_columns = [
        col for col in close_subset.columns if close_subset[col].dropna().shape[0] >= 2
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

    logger.warning(
        "BACKTEST WINDOW | lookback_days=%s | subset_start=%s | subset_end=%s | symbols=%s",
        lookback_days,
        close_subset.index.min().date(),
        close_subset.index.max().date(),
        close_subset.shape[1],
    )

    benchmark_column = resolve_benchmark_column(
        all_columns=all_columns,
        normalized_column_lookup=normalized_column_lookup,
        canonical_column_lookup=canonical_column_lookup,
    )

    return {
        "close": close,
        "close_subset": close_subset,
        "daily_ret": daily_ret,
        "all_columns": all_columns,
        "column_to_requested": column_to_requested,
        "benchmark_column": benchmark_column,
    }


def apply_benchmark_and_finalize(
    close: pd.DataFrame,
    close_subset: pd.DataFrame,
    weights_series: pd.Series,
    benchmark_column: str | None,
    column_to_requested: Dict[str, str],
):
    selected_cols = weights_series.index.tolist()
    close_subset = close_subset[selected_cols].copy()

    portfolio_returns = close_subset.pct_change().dropna().dot(weights_series.values)
    portfolio_nav = (1.0 + portfolio_returns).cumprod()

    metrics = compute_metrics(portfolio_returns, portfolio_nav)

    benchmark_name: str | None = None
    benchmark_curve_df: pd.DataFrame | None = None
    benchmark_metrics: dict | None = None

    if benchmark_column:
        benchmark_name = benchmark_column

        benchmark_prices = close[benchmark_column].copy()
        benchmark_prices = benchmark_prices.reindex(close_subset.index).ffill().dropna()

        common_price_index = close_subset.index.intersection(benchmark_prices.index)
        close_subset = close_subset.loc[common_price_index]
        benchmark_prices = benchmark_prices.loc[common_price_index]

        portfolio_returns = close_subset.pct_change().dropna().dot(weights_series.values)
        benchmark_returns = benchmark_prices.pct_change().dropna()

        common_return_index = portfolio_returns.index.intersection(benchmark_returns.index)
        portfolio_returns = portfolio_returns.loc[common_return_index]
        benchmark_returns = benchmark_returns.loc[common_return_index]

        portfolio_nav = (1.0 + portfolio_returns).cumprod()
        benchmark_nav = (1.0 + benchmark_returns).cumprod()

        metrics = compute_metrics(portfolio_returns, portfolio_nav)
        benchmark_metrics = compute_metrics(benchmark_returns, benchmark_nav)
        benchmark_curve_df = build_curve(benchmark_nav)

        beta, correlation = compute_beta_and_correlation(
            portfolio_returns=portfolio_returns,
            benchmark_returns=benchmark_returns,
        )
        metrics["beta_to_benchmark"] = round(beta, 4) if beta is not None else None
        metrics["correlation_to_benchmark"] = round(correlation, 4) if correlation is not None else None
    else:
        logger.warning("No benchmark column found for NIFTY 50 candidates.")
        metrics["beta_to_benchmark"] = None
        metrics["correlation_to_benchmark"] = None

    curve_df = build_curve(portfolio_nav)

    start_prices = close_subset.iloc[0]
    end_prices = close_subset.iloc[-1]

    holdings = pd.DataFrame(
        {
            "Symbol": [column_to_requested[col] for col in close_subset.columns],
            "weight": [float(weights_series.loc[col]) for col in close_subset.columns],
            "start_price": start_prices.values,
            "end_price": end_prices.values,
            "total_return_pct": ((end_prices / start_prices - 1.0) * 100.0).round(2).values,
        }
    )

    holdings = holdings.sort_values("Symbol").reset_index(drop=True)

    return metrics, curve_df, holdings, benchmark_name, benchmark_curve_df, benchmark_metrics


def solve_mvo_weights(
    daily_ret: pd.DataFrame,
    sector_map: pd.Series,
    max_stocks: int | None = None,
    min_weight_threshold: float = 0.001,
    risk_aversion: float = 5.0,
) -> pd.Series:
    def _get_dynamic_stock_constraints(watchlist_count: int) -> tuple[int, float]:
        if watchlist_count <= 10:
            max_stock_weight = 0.25
        elif watchlist_count <= 20:
            max_stock_weight = 0.10
        elif watchlist_count <= 30:
            max_stock_weight = 0.08
        else:
            max_stock_weight = 0.05

        min_required_holdings = math.ceil(1.0 / max_stock_weight)
        min_required_holdings = min(watchlist_count, min_required_holdings)

        return min_required_holdings, max_stock_weight

    def _get_dynamic_sector_cap(watchlist_count: int, sector_count: int) -> float:
        if watchlist_count <= 10:
            target_sector_cap = 0.50
        elif watchlist_count <= 20:
            target_sector_cap = 0.35
        elif watchlist_count <= 30:
            target_sector_cap = 0.25
        else:
            target_sector_cap = 0.20

        if sector_count <= 0:
            raise ValueError("No valid sectors available for sector constraints.")

        feasible_floor = (1.0 / sector_count) + 1e-6
        return max(target_sector_cap, feasible_floor)

    def _build_initial_guess(
        selected_names: list[str],
        selected_sector_map: pd.Series,
        target_holdings: int,
        max_stock_weight: float,
        max_sector_weight: float,
    ) -> pd.Series:
        n = len(selected_names)
        x0 = pd.Series(0.0, index=selected_names, dtype=float)

        if n == 0:
            return x0

        target_holdings = min(target_holdings, n)
        if target_holdings <= 0:
            x0[:] = 1.0 / n
            return x0

        equal_weight = 1.0 / target_holdings
        max_names_per_sector = max(1, int(np.floor(max_sector_weight / equal_weight + 1e-12)))

        sector_buckets: dict[str, list[str]] = {}
        for name in selected_names:
            sec = str(selected_sector_map.loc[name]).strip()
            sector_buckets.setdefault(sec, []).append(name)

        sector_keys = list(sector_buckets.keys())
        sector_ptr = {sec: 0 for sec in sector_keys}
        sector_used = {sec: 0 for sec in sector_keys}

        chosen: list[str] = []
        chosen_set: set[str] = set()

        progress = True
        while len(chosen) < target_holdings and progress:
            progress = False
            for sec in sector_keys:
                if sector_used[sec] >= max_names_per_sector:
                    continue

                ptr = sector_ptr[sec]
                bucket = sector_buckets[sec]

                if ptr < len(bucket):
                    name = bucket[ptr]
                    sector_ptr[sec] += 1

                    if name not in chosen_set:
                        chosen.append(name)
                        chosen_set.add(name)
                        sector_used[sec] += 1
                        progress = True

                    if len(chosen) == target_holdings:
                        break

        if len(chosen) < target_holdings:
            for name in selected_names:
                if name not in chosen_set:
                    chosen.append(name)
                    chosen_set.add(name)
                    if len(chosen) == target_holdings:
                        break

        if not chosen:
            x0[:] = 1.0 / n
            return x0 / x0.sum()

        x0.loc[chosen] = 1.0 / len(chosen)
        x0 = x0.clip(lower=0.0, upper=max_stock_weight)

        if x0.sum() <= 0:
            x0[:] = 1.0 / n

        return x0 / x0.sum()

    daily_ret = daily_ret.copy()

    if daily_ret.empty or daily_ret.shape[1] == 0:
        raise ValueError("No stocks available for MVO.")

    watchlist_count = daily_ret.shape[1]
    dynamic_min_holdings, max_stock_weight = _get_dynamic_stock_constraints(watchlist_count)

    mu = daily_ret.mean() * ANNUALIZATION_FACTOR
    vol = daily_ret.std().replace(0, np.nan)

    score = (
        (mu / vol)
        .replace([np.inf, -np.inf], np.nan)
        .dropna()
        .sort_values(ascending=False)
    )

    if score.empty:
        raise ValueError("No valid watchlist candidates after return/volatility screening.")

    effective_max_stocks = len(score) if max_stocks is None else max(max_stocks, dynamic_min_holdings)
    selected = score.index.tolist()[: min(len(score), effective_max_stocks)]

    if len(selected) < dynamic_min_holdings:
        raise ValueError(
            f"Not enough valid watchlist candidates after ranking. "
            f"Got {len(selected)}, required at least {dynamic_min_holdings}."
        )

    mu = mu.loc[selected]
    cov = daily_ret[selected].cov() * ANNUALIZATION_FACTOR
    cov = cov + np.eye(len(selected)) * 1e-8

    sector_map = sector_map.loc[selected].copy()

    for name in selected:
        val = sector_map.loc[name]
        if pd.isna(val) or not str(val).strip():
            sector_map.loc[name] = f"UNKNOWN_{name}"

    sector_map = sector_map.astype(str).str.strip()
    sector_count = sector_map.nunique()

    if sector_count == 0:
        raise ValueError("No valid sectors found for selected stocks.")

    max_sector_weight = _get_dynamic_sector_cap(
        watchlist_count=watchlist_count,
        sector_count=sector_count,
    )

    logger.warning(
        "MVO DEBUG | watchlist_count=%s | selected=%s | dynamic_min_holdings=%s | "
        "max_stock_weight=%.4f | sector_count=%s | max_sector_weight=%.4f",
        watchlist_count,
        len(selected),
        dynamic_min_holdings,
        max_stock_weight,
        sector_count,
        max_sector_weight,
    )

    n = len(selected)

    def objective(w: np.ndarray) -> float:
        return 0.5 * risk_aversion * float(w @ cov.values @ w) - float(mu.values @ w)

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    for sector in sector_map.unique():
        idx = np.where(sector_map.values == sector)[0]
        constraints.append(
            {
                "type": "ineq",
                "fun": lambda w, idx=idx: max_sector_weight - np.sum(w[idx]),
            }
        )

    bounds = [(0.0, max_stock_weight) for _ in range(n)]

    x0 = _build_initial_guess(
        selected_names=selected,
        selected_sector_map=sector_map,
        target_holdings=dynamic_min_holdings,
        max_stock_weight=max_stock_weight,
        max_sector_weight=max_sector_weight,
    )

    result = minimize(
        objective,
        x0=x0.values,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 500, "ftol": 1e-9, "disp": False},
    )

    if not result.success:
        raise ValueError(f"MVO optimization failed: {result.message}")

    raw_weights = pd.Series(result.x, index=selected).clip(lower=0.0)

    if raw_weights.sum() <= 0:
        raise ValueError("MVO optimizer returned non-positive weights.")

    raw_weights = raw_weights / raw_weights.sum()

    filtered_weights = raw_weights.copy()
    filtered_weights[filtered_weights < min_weight_threshold] = 0.0
    filtered_weights = filtered_weights[filtered_weights > 0.0]

    if not filtered_weights.empty:
        filtered_weights = filtered_weights / filtered_weights.sum()

    if (
        filtered_weights.empty
        or len(filtered_weights) < dynamic_min_holdings
        or (filtered_weights > max_stock_weight + 1e-6).any()
    ):
        weights = raw_weights[raw_weights > 0.0].copy()
    else:
        weights = filtered_weights.copy()

    weights = weights / weights.sum()

    logger.warning(
        "MVO DEBUG | optimized_holdings_count=%s | top_weights=%s",
        len(weights),
        weights.sort_values(ascending=False).head(10).to_dict(),
    )

    return weights.sort_values(ascending=False)


def run_watchlist_backtest(
    user_symbols: List[str],
    close_prices_path: Path,
    lookback_days: int = 252,
):
    prepared = prepare_watchlist_data(
        user_symbols=user_symbols,
        close_prices_path=close_prices_path,
        lookback_days=lookback_days,
    )

    close = prepared["close"]
    close_subset = prepared["close_subset"]
    daily_ret = prepared["daily_ret"]
    column_to_requested = prepared["column_to_requested"]
    benchmark_column = prepared["benchmark_column"]

    n = daily_ret.shape[1]
    weights_series = pd.Series(
        np.repeat(1.0 / n, n),
        index=daily_ret.columns,
        dtype=float,
    )

    return apply_benchmark_and_finalize(
        close=close,
        close_subset=close_subset,
        weights_series=weights_series,
        benchmark_column=benchmark_column,
        column_to_requested=column_to_requested,
    )


def run_watchlist_mvo_backtest(
    user_symbols: List[str],
    close_prices_path: Path,
    lookback_days: int = 252,
):
    prepared = prepare_watchlist_data(
        user_symbols=user_symbols,
        close_prices_path=close_prices_path,
        lookback_days=lookback_days,
    )

    close = prepared["close"]
    close_subset = prepared["close_subset"]
    daily_ret = prepared["daily_ret"]
    column_to_requested = prepared["column_to_requested"]
    benchmark_column = prepared["benchmark_column"]

    sector_map_raw = load_universe_sector_map(close_prices_path)

    sector_map: Dict[str, str] = {}
    for col in daily_ret.columns:
        requested_symbol = column_to_requested.get(col, col)
        key_candidates = [
            normalize_symbol(requested_symbol),
            canonical_symbol(requested_symbol),
            normalize_symbol(col),
            canonical_symbol(col),
        ]

        assigned = None
        for key in key_candidates:
            if key and key in sector_map_raw:
                assigned = sector_map_raw[key]
                break

        if assigned is None:
            assigned = f"UNKNOWN_{requested_symbol}"

        sector_map[col] = str(assigned)

    sector_series = pd.Series(sector_map).loc[daily_ret.columns]

    weights_series = solve_mvo_weights(
        daily_ret=daily_ret,
        sector_map=sector_series,
        max_stocks=None,
        min_weight_threshold=0.001,
        risk_aversion=5.0,
    )

    close_subset = close_subset[weights_series.index].copy()
    reduced_column_to_requested = {
        col: column_to_requested[col]
        for col in weights_series.index
        if col in column_to_requested
    }

    return apply_benchmark_and_finalize(
        close=close,
        close_subset=close_subset,
        weights_series=weights_series,
        benchmark_column=benchmark_column,
        column_to_requested=reduced_column_to_requested,
    )
