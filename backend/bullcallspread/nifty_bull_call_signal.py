from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

from datetime import datetime
import yaml
import pandas as pd
from kiteconnect import KiteConnect

# =========================================================
# ===================== Paths =============================
# =========================================================
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = BASE_DIR / "config"

CSV_PATH = DATA_DIR / "inst_zerodha_nfo.csv"
CRED_PATH = CONFIG_DIR / "cred.yml"

# =========================================================
# ===================== Config / Kite =====================
# =========================================================
def load_creds() -> dict:
    with open(CRED_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_instrument_csv() -> pd.DataFrame:
    return pd.read_csv(CSV_PATH)


def _parse_expiry_date(value) -> datetime.date:
    """
    Supports:
    - datetime.date
    - datetime.datetime
    - 'YYYY-MM-DD'
    """
    if hasattr(value, "date"):
        return value.date()
    return pd.to_datetime(value).date()


cred = load_creds()

kite = KiteConnect(api_key=cred["z_api_key"])
kite.set_access_token(cred["z_access_token"])

nfo_data: Optional[pd.DataFrame] = None


# =========================================================
# ===================== Generic Helpers ===================
# =========================================================
def round_to_multiple(number: float, multiple: int = 100) -> int:
    return int(multiple * round(number / multiple))


def nearest_strike(x: float) -> int:
    return int(round(round(x), -2))


def _filter_nfo_data_for_expiry(inst_name: str, expiry_key: str) -> pd.DataFrame:
    """
    Common loader for instrument master filtering by expiry date and index name.
    """
    df_inst = load_instrument_csv().copy()
    expiry_date = _parse_expiry_date(cred[expiry_key])

    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%Y-%m-%d", errors="coerce")
    filtered = df_inst[df_inst["InsertedDates"].dt.date == expiry_date].copy()

    name_map = {
        "BN": "BANKNIFTY",
        "FN": "FINNIFTY",
        "N": "NIFTY",
        "BX": "BANKEX",
        "S": "SENSEX",
        "C": "CRUDEOIL",
        "GP": "GOLDPETAL",
    }

    actual_name = name_map.get(inst_name)
    if actual_name is None:
        raise ValueError(f"Unsupported instrument name code: {inst_name}")

    return filtered[filtered["name"] == actual_name].copy()


def get_nfo_file_data_nifty(inst_name: str):
    global nfo_data
    nfo_data = _filter_nfo_data_for_expiry(inst_name, "i_expiry_date_nifty")


def get_nfo_file_data_banknifty(inst_name: str):
    global nfo_data
    nfo_data = _filter_nfo_data_for_expiry(inst_name, "i_expiry_date_banknifty")


def get_nfo_file_data_sensex(inst_name: str):
    global nfo_data
    nfo_data = _filter_nfo_data_for_expiry(inst_name, "i_expiry_date_sensex")


def get_nfo_file_data_crude_oil(inst_name: str):
    global nfo_data
    nfo_data = _filter_nfo_data_for_expiry(inst_name, "i_expiry_date_crude_oil")


def _ensure_nfo_loaded(loader_func, inst_name: str) -> None:
    global nfo_data
    if nfo_data is None or len(nfo_data) == 0:
        loader_func(inst_name)


def _get_instrument_tokens_by_type(loader_func, inst_name: str, option_type: str) -> Optional[list[int]]:
    _ensure_nfo_loaded(loader_func, inst_name)
    df = nfo_data[nfo_data["instrument_type"] == option_type]
    if len(df) > 0:
        return df["instrument_token"].astype(int).tolist()
    return None


# =========================================================
# ===================== Token Getters =====================
# =========================================================
def get_instrument_tokens_ce_nifty():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_nifty,
        cred["i_inst_name_nifty"],
        "CE",
    )


def get_instrument_tokens_pe_nifty():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_nifty,
        cred["i_inst_name_nifty"],
        "PE",
    )


def get_instrument_tokens_ce_banknifty():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_banknifty,
        cred["i_inst_name_banknifty"],
        "CE",
    )


def get_instrument_tokens_pe_banknifty():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_banknifty,
        cred["i_inst_name_banknifty"],
        "PE",
    )


def get_instrument_tokens_ce_sensex():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_sensex,
        cred["i_inst_name_sensex"],
        "CE",
    )


def get_instrument_tokens_pe_sensex():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_sensex,
        cred["i_inst_name_sensex"],
        "PE",
    )


def get_instrument_tokens_ce_crude_oil():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_crude_oil,
        cred["i_inst_name_crude_oil"],
        "CE",
    )


def get_instrument_tokens_pe_crude_oil():
    return _get_instrument_tokens_by_type(
        get_nfo_file_data_crude_oil,
        cred["i_inst_name_crude_oil"],
        "PE",
    )


# =========================================================
# ===================== Chain Builders ====================
# =========================================================
def _build_option_chain_with_ltp(
    *,
    loader_func,
    inst_name: str,
    option_type: str,
    spot_token: int,
    strike_step: int,
    range_down_steps: int,
    range_up_steps: int,
    label: str,
) -> pd.DataFrame:
    """
    Generic option chain builder.

    Returns a DataFrame with live LTP merged into the instrument master.
    """
    _ensure_nfo_loaded(loader_func, inst_name)

    df_opt = nfo_data[nfo_data["instrument_type"] == option_type].copy()
    df_opt["expiry"] = pd.to_datetime(df_opt["expiry"], errors="coerce")

    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_opt[df_opt["expiry"] >= current_date]["expiry"].min()
    df_opt = df_opt[df_opt["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | {option_type} contracts: {len(df_opt)}")

    spot_data = kite.ltp(spot_token)
    spot_price = spot_data[str(spot_token)]["last_price"]
    print(f"Current {label} Spot: {spot_price:.2f}")

    atm_strike = round_to_multiple(spot_price, strike_step)
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (range_down_steps * strike_step)
    strike_max = atm_strike + (range_up_steps * strike_step)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_opt = df_opt[
        (df_opt["strike"] >= strike_min)
        & (df_opt["strike"] <= strike_max)
        & (df_opt["strike"] % strike_step == 0)
    ].copy()

    option_tokens = df_opt["instrument_token"].astype(int).tolist()
    quote_details = kite.ltp(option_tokens)
    df_ltp = pd.DataFrame(quote_details).T.reset_index(drop=True)

    df_opt = df_opt.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left",
    )

    df_opt = df_opt.sort_values("strike").reset_index(drop=True)

    print(f"\n=== {label} {option_type} Option Chain ===")
    print(
        df_opt[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_opt


# -------------------- NIFTY --------------------
def build_nifty_ce_chain_100_strike_with_ltp():
    return _build_option_chain_with_ltp(
        loader_func=get_nfo_file_data_nifty,
        inst_name=cred["i_inst_name_nifty"],
        option_type="CE",
        spot_token=int(cred.get("nifty_spot_token", 256265)),
        strike_step=100,
        range_down_steps=4,
        range_up_steps=6,
        label="NIFTY",
    )


def build_nifty_pe_chain_100_strike_with_ltp():
    return _build_option_chain_with_ltp(
        loader_func=get_nfo_file_data_nifty,
        inst_name=cred["i_inst_name_nifty"],
        option_type="PE",
        spot_token=int(cred.get("nifty_spot_token", 256265)),
        strike_step=100,
        range_down_steps=4,
        range_up_steps=6,
        label="NIFTY",
    )


# Optional older helper if you still need 50-step view
def build_nifty_ce_chain_50_strike_with_ltp():
    return _build_option_chain_with_ltp(
        loader_func=get_nfo_file_data_nifty,
        inst_name=cred["i_inst_name_nifty"],
        option_type="CE",
        spot_token=int(cred.get("nifty_spot_token", 256265)),
        strike_step=50,
        range_down_steps=6,
        range_up_steps=6,
        label="NIFTY",
    )


# -------------------- BANKNIFTY --------------------
def build_banknifty_ce_chain_100_strike_with_ltp():
    return _build_option_chain_with_ltp(
        loader_func=get_nfo_file_data_banknifty,
        inst_name=cred["i_inst_name_banknifty"],
        option_type="CE",
        spot_token=int(cred.get("banknifty_spot_token", 260105)),
        strike_step=100,
        range_down_steps=4,
        range_up_steps=6,
        label="BANKNIFTY",
    )


def build_banknifty_pe_chain_100_strike_with_ltp():
    return _build_option_chain_with_ltp(
        loader_func=get_nfo_file_data_banknifty,
        inst_name=cred["i_inst_name_banknifty"],
        option_type="PE",
        spot_token=int(cred.get("banknifty_spot_token", 260105)),
        strike_step=100,
        range_down_steps=4,
        range_up_steps=6,
        label="BANKNIFTY",
    )


# -------------------- SENSEX --------------------
def build_sensex_ce_chain_100_strike_with_ltp():
    return _build_option_chain_with_ltp(
        loader_func=get_nfo_file_data_sensex,
        inst_name=cred["i_inst_name_sensex"],
        option_type="CE",
        spot_token=int(cred.get("sensex_spot_token", 265)),
        strike_step=100,
        range_down_steps=4,
        range_up_steps=6,
        label="SENSEX",
    )


def build_sensex_pe_chain_100_strike_with_ltp():
    return _build_option_chain_with_ltp(
        loader_func=get_nfo_file_data_sensex,
        inst_name=cred["i_inst_name_sensex"],
        option_type="PE",
        spot_token=int(cred.get("sensex_spot_token", 265)),
        strike_step=100,
        range_down_steps=4,
        range_up_steps=6,
        label="SENSEX",
    )


# =========================================================
# ===================== Spread Builders ===================
# =========================================================
def _prepare_spread_df(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[float, float], int]:
    required = {"strike", "last_price_y", "lot_size"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (
        df.rename(columns={"last_price_y": "ltp"})
        .loc[:, ["strike", "ltp", "lot_size"]]
        .dropna()
        .copy()
    )
    d["strike"] = d["strike"].astype(float)
    d["ltp"] = d["ltp"].astype(float)
    d = d.sort_values("strike").reset_index(drop=True)

    ltp_map = d.set_index("strike")["ltp"].to_dict()
    lot_size = int(d["lot_size"].iloc[0])
    return d, ltp_map, lot_size


def _get_buy_candidates(d: pd.DataFrame, atm_only: bool, spot: Optional[float]) -> list[float]:
    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d["strike"] - float(spot)).abs().argmin()
        return [float(d.loc[atm_idx, "strike"])]
    return d["strike"].tolist()


def _sort_spreads(out: pd.DataFrame, rr_target: float) -> pd.DataFrame:
    if out.empty:
        return out
    out["rr_distance"] = (out["rr"] - rr_target).abs()
    return out.sort_values(["rr_distance", "rr"], ascending=[True, False]).reset_index(drop=True)


# -------------------- Bull Call --------------------
def bull_call_spreads_nifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (150, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    d, ltp_map, lot_size = _prepare_spread_df(df)
    buy_candidates = _get_buy_candidates(d, atm_only, spot)

    rows = []
    for buy_strike in buy_candidates:
        buy_ltp = ltp_map.get(buy_strike)
        if buy_ltp is None:
            continue

        for gap in gaps:
            sell_strike = buy_strike + gap
            sell_ltp = ltp_map.get(sell_strike)
            if sell_ltp is None:
                continue

            width = sell_strike - buy_strike
            net_debit = buy_ltp - sell_ltp
            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit
            rows.append(
                {
                    "buy_strike": buy_strike,
                    "buy_ltp": round(buy_ltp, 2),
                    "sell_strike": sell_strike,
                    "sell_ltp": round(sell_ltp, 2),
                    "gap": int(width),
                    "net_debit": round(net_debit, 2),
                    "max_profit": round(max_profit, 2),
                    "rr": round(rr, 3),
                    "breakeven": round(buy_strike + net_debit, 2),
                    "per_lot_debit": round(net_debit * lot_size, 2),
                    "per_lot_max_profit": round(max_profit * lot_size, 2),
                    "lot_size": lot_size,
                }
            )

    return _sort_spreads(pd.DataFrame(rows), rr_target)


def bull_call_spreads_banknifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    d, ltp_map, lot_size = _prepare_spread_df(df)
    buy_candidates = _get_buy_candidates(d, atm_only, spot)

    rows = []
    for buy_strike in buy_candidates:
        buy_ltp = ltp_map.get(buy_strike)
        if buy_ltp is None:
            continue

        for gap in gaps:
            sell_strike = buy_strike + gap
            sell_ltp = ltp_map.get(sell_strike)
            if sell_ltp is None:
                continue

            width = sell_strike - buy_strike
            net_debit = buy_ltp - sell_ltp
            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit
            rows.append(
                {
                    "buy_strike": buy_strike,
                    "buy_ltp": round(buy_ltp, 2),
                    "sell_strike": sell_strike,
                    "sell_ltp": round(sell_ltp, 2),
                    "gap": int(width),
                    "net_debit": round(net_debit, 2),
                    "max_profit": round(max_profit, 2),
                    "rr": round(rr, 3),
                    "breakeven": round(buy_strike + net_debit, 2),
                    "per_lot_debit": round(net_debit * lot_size, 2),
                    "per_lot_max_profit": round(max_profit * lot_size, 2),
                    "lot_size": lot_size,
                }
            )

    return _sort_spreads(pd.DataFrame(rows), rr_target)


def bull_call_spreads_sensex(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    d, ltp_map, lot_size = _prepare_spread_df(df)
    buy_candidates = _get_buy_candidates(d, atm_only, spot)

    rows = []
    for buy_strike in buy_candidates:
        buy_ltp = ltp_map.get(buy_strike)
        if buy_ltp is None:
            continue

        for gap in gaps:
            sell_strike = buy_strike + gap
            sell_ltp = ltp_map.get(sell_strike)
            if sell_ltp is None:
                continue

            width = sell_strike - buy_strike
            net_debit = buy_ltp - sell_ltp
            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit
            rows.append(
                {
                    "buy_strike": buy_strike,
                    "buy_ltp": round(buy_ltp, 2),
                    "sell_strike": sell_strike,
                    "sell_ltp": round(sell_ltp, 2),
                    "gap": int(width),
                    "net_debit": round(net_debit, 2),
                    "max_profit": round(max_profit, 2),
                    "rr": round(rr, 3),
                    "breakeven": round(buy_strike + net_debit, 2),
                    "per_lot_debit": round(net_debit * lot_size, 2),
                    "per_lot_max_profit": round(max_profit * lot_size, 2),
                    "lot_size": lot_size,
                }
            )

    return _sort_spreads(pd.DataFrame(rows), rr_target)


# -------------------- Bear Put --------------------
def bear_put_spreads_nifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (150, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    d, ltp_map, lot_size = _prepare_spread_df(df)
    buy_candidates = _get_buy_candidates(d, atm_only, spot)

    rows = []
    for buy_strike in buy_candidates:
        buy_ltp = ltp_map.get(buy_strike)
        if buy_ltp is None:
            continue

        for gap in gaps:
            sell_strike = buy_strike - gap
            sell_ltp = ltp_map.get(sell_strike)
            if sell_ltp is None:
                continue

            width = buy_strike - sell_strike
            net_debit = buy_ltp - sell_ltp
            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit
            rows.append(
                {
                    "buy_strike": buy_strike,
                    "buy_ltp": round(buy_ltp, 2),
                    "sell_strike": sell_strike,
                    "sell_ltp": round(sell_ltp, 2),
                    "gap": int(width),
                    "net_debit": round(net_debit, 2),
                    "max_profit": round(max_profit, 2),
                    "rr": round(rr, 3),
                    "breakeven": round(buy_strike - net_debit, 2),
                    "per_lot_debit": round(net_debit * lot_size, 2),
                    "per_lot_max_profit": round(max_profit * lot_size, 2),
                    "lot_size": lot_size,
                }
            )

    return _sort_spreads(pd.DataFrame(rows), rr_target)


def bear_put_spreads_banknifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    d, ltp_map, lot_size = _prepare_spread_df(df)
    buy_candidates = _get_buy_candidates(d, atm_only, spot)

    rows = []
    for buy_strike in buy_candidates:
        buy_ltp = ltp_map.get(buy_strike)
        if buy_ltp is None:
            continue

        for gap in gaps:
            sell_strike = buy_strike - gap
            sell_ltp = ltp_map.get(sell_strike)
            if sell_ltp is None:
                continue

            width = buy_strike - sell_strike
            net_debit = buy_ltp - sell_ltp
            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit
            rows.append(
                {
                    "buy_strike": buy_strike,
                    "buy_ltp": round(buy_ltp, 2),
                    "sell_strike": sell_strike,
                    "sell_ltp": round(sell_ltp, 2),
                    "gap": int(width),
                    "net_debit": round(net_debit, 2),
                    "max_profit": round(max_profit, 2),
                    "rr": round(rr, 3),
                    "breakeven": round(buy_strike - net_debit, 2),
                    "per_lot_debit": round(net_debit * lot_size, 2),
                    "per_lot_max_profit": round(max_profit * lot_size, 2),
                    "lot_size": lot_size,
                }
            )

    return _sort_spreads(pd.DataFrame(rows), rr_target)


def bear_put_spreads_sensex(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    d, ltp_map, lot_size = _prepare_spread_df(df)
    buy_candidates = _get_buy_candidates(d, atm_only, spot)

    rows = []
    for buy_strike in buy_candidates:
        buy_ltp = ltp_map.get(buy_strike)
        if buy_ltp is None:
            continue

        for gap in gaps:
            sell_strike = buy_strike - gap
            sell_ltp = ltp_map.get(sell_strike)
            if sell_ltp is None:
                continue

            width = buy_strike - sell_strike
            net_debit = buy_ltp - sell_ltp
            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit
            rows.append(
                {
                    "buy_strike": buy_strike,
                    "buy_ltp": round(buy_ltp, 2),
                    "sell_strike": sell_strike,
                    "sell_ltp": round(sell_ltp, 2),
                    "gap": int(width),
                    "net_debit": round(net_debit, 2),
                    "max_profit": round(max_profit, 2),
                    "rr": round(rr, 3),
                    "breakeven": round(buy_strike - net_debit, 2),
                    "per_lot_debit": round(net_debit * lot_size, 2),
                    "per_lot_max_profit": round(max_profit * lot_size, 2),
                    "lot_size": lot_size,
                }
            )

    return _sort_spreads(pd.DataFrame(rows), rr_target)
