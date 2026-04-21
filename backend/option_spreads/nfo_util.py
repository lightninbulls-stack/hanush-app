import yaml
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta
from kiteconnect import KiteConnect
from typing import Iterable, Optional
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "inst_zerodha_nfo.csv"
CRED_PATH = Path.cwd() / "cred.yml"

nfo_data = None
i_inst_name = "N"
expiry_date = None


def _read_cred():
    with open(CRED_PATH, "r", encoding="utf-8") as f:
        return yaml.load(f, Loader=yaml.FullLoader)


def _write_cred(cred: dict):
    with open(CRED_PATH, "w", encoding="utf-8") as fp:
        yaml.dump(cred, fp)


def _read_inst_csv():
    return pd.read_csv(CSV_PATH)

def _parse_csv_expiry_series(series: pd.Series) -> pd.Series:
    """
    Parse expiry values from instrument CSV safely.
    Handles values like 21/04/26.
    """
    s = series.astype(str).str.strip()
    parsed = pd.to_datetime(s, dayfirst=True, errors="coerce")
    return parsed


def _parse_target_expiry(expiry_value):
    """
    Parse target expiry from cred safely.
    Handles:
    - 20260421
    - "20260421"
    - datetime/date objects
    """
    if expiry_value is None:
        return None

    if isinstance(expiry_value, str):
        expiry_value = expiry_value.strip()
        if len(expiry_value) == 8 and expiry_value.isdigit():
            parsed = pd.to_datetime(expiry_value, format="%Y%m%d", errors="coerce")
        else:
            parsed = pd.to_datetime(expiry_value, errors="coerce")
    elif isinstance(expiry_value, (int, np.integer)):
        parsed = pd.to_datetime(str(int(expiry_value)), format="%Y%m%d", errors="coerce")
    else:
        parsed = pd.to_datetime(expiry_value, errors="coerce")

    if pd.isna(parsed):
        return None

    return pd.Timestamp(parsed).date()


def _get_kite():
    cred = _read_cred()
    kite = KiteConnect(api_key=cred["z_api_key"])
    kite.set_access_token(str(cred["z_access_token"]).strip())
    return kite


def _safe_ltp_response(payload):
    if payload is None:
        return {}
    if isinstance(payload, dict):
        return payload
    return {}


def _get_last_price_from_ltp(payload, token: int) -> float:
    payload = _safe_ltp_response(payload)

    key1 = str(token)
    key2 = token

    if key1 in payload and isinstance(payload[key1], dict):
        return float(payload[key1].get("last_price", 0.0) or 0.0)

    if key2 in payload and isinstance(payload[key2], dict):
        return float(payload[key2].get("last_price", 0.0) or 0.0)

    raise ValueError(f"LTP not found for token {token}. Response keys: {list(payload.keys())[:10]}")


def _build_ltp_df(quote_details):
    payload = _safe_ltp_response(quote_details)
    if not payload:
        raise ValueError("Empty LTP response received from Kite.")

    rows = []
    for key, value in payload.items():
        if not isinstance(value, dict):
            continue

        instrument_token = value.get("instrument_token")
        last_price = value.get("last_price")

        if instrument_token is None:
            try:
                instrument_token = int(str(key).split(":")[-1])
            except Exception:
                continue

        rows.append(
            {
                "instrument_token": int(instrument_token),
                "last_price_y": float(last_price or 0.0),
            }
        )

    df_ltp = pd.DataFrame(rows)
    if df_ltp.empty:
        raise ValueError("Could not build LTP dataframe from Kite response.")

    return df_ltp


def get_zerodha_inst_file():
    url = "https://api.kite.trade/instruments"
    r = requests.get(url, allow_redirects=True)
    with open(CSV_PATH, "wb") as f:
        f.write(r.content)


def insert_data_rec(iterable, search_key, data):
    if isinstance(iterable, dict):
        for k, v in iterable.items():
            if k == search_key:
                iterable[k] = data


def nearest_strike(x):
    return round(round(x), -2)


def round_to_multiple(number, multiple=100):
    return multiple * round(number / multiple)


def get_nfo_file_data_nifty(inst_name):
    global nfo_data

    cred = _read_cred()
    df_inst = _read_inst_csv()

    print("DEBUG NIFTY LOAD 1 | entered get_nfo_file_data_nifty()")
    print(f"DEBUG NIFTY LOAD 2 | raw inst_name = {inst_name}")
    print(f"DEBUG NIFTY LOAD 3 | raw expiry from cred = {cred.get('i_expiry_date_nifty')}")
    print(f"DEBUG NIFTY LOAD 4 | total rows in CSV = {len(df_inst)}")
    print(f"DEBUG NIFTY LOAD 5 | columns = {list(df_inst.columns)}")

    df_inst["InsertedDates"] = _parse_csv_expiry_series(df_inst["expiry"])

    expiry_value = _parse_target_expiry(cred.get("i_expiry_date_nifty"))
    print(f"DEBUG NIFTY LOAD 7 | parsed expiry_value = {expiry_value}")

    valid_expiry_rows = df_inst[df_inst["InsertedDates"].notna()].copy()
    print(f"DEBUG NIFTY LOAD 8 | rows with valid parsed expiry = {len(valid_expiry_rows)}")

    if len(valid_expiry_rows) > 0:
        unique_expiries = sorted(valid_expiry_rows["InsertedDates"].dt.date.drop_duplicates().tolist())
        print(f"DEBUG NIFTY LOAD 9 | unique parsed expiries sample = {unique_expiries[:20]}")

    if expiry_value is None:
        print("DEBUG NIFTY LOAD 10 | target expiry could not be parsed")
        nfo_data = pd.DataFrame()
        return

    a = valid_expiry_rows[valid_expiry_rows["InsertedDates"].dt.date == expiry_value].copy()
    print(f"DEBUG NIFTY LOAD 10 | rows after expiry filter = {len(a)}")

    inst_name = str(inst_name).strip().upper()

    if inst_name in {"BN", "BANKNIFTY"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "BANKNIFTY"].copy()
    elif inst_name in {"FN", "FINNIFTY"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "FINNIFTY"].copy()
    elif inst_name in {"N", "NIFTY"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "NIFTY"].copy()
    elif inst_name in {"BX", "BANKEX"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "BANKEX"].copy()
    elif inst_name in {"S", "SENSEX"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "SENSEX"].copy()
    elif inst_name in {"C", "CRUDEOIL"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "CRUDEOIL"].copy()
    elif inst_name in {"GP", "GOLDPETAL"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "GOLDPETAL"].copy()
    else:
        nfo_data = pd.DataFrame()

    print(f"DEBUG NIFTY LOAD 11 | rows after name filter = {len(nfo_data)}")

    if len(nfo_data) > 0:
        print("DEBUG NIFTY LOAD 12 | filtered dataframe sample:")
        print(nfo_data.head(10).to_string(index=False))
    else:
        print("DEBUG NIFTY LOAD 12 | filtered dataframe is empty")


def get_nfo_file_data_crude_oil(inst_name):
    global nfo_data
    cred = _read_cred()
    df_inst = _read_inst_csv()
    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%d/%m/%y", errors="coerce")
    a = df_inst[df_inst["InsertedDates"].dt.date == cred["i_expiry_date_crude_oil"]]
    if inst_name == "BN":
        nfo_data = a[a["name"] == "BANKNIFTY"]
    if inst_name == "FN":
        nfo_data = a[a["name"] == "FINNIFTY"]
    if inst_name == "N":
        nfo_data = a[a["name"] == "NIFTY"]
    if inst_name == "BX":
        nfo_data = a[a["name"] == "BANKEX"]
    if inst_name == "S":
        nfo_data = a[a["name"] == "SENSEX"]
    if inst_name == "C":
        nfo_data = a[a["name"] == "CRUDEOIL"]
    if inst_name == "GP":
        nfo_data = a[a["name"] == "GOLDPETAL"]

def get_nfo_file_data_sensex(inst_name):
    global nfo_data

    cred = _read_cred()
    df_inst = _read_inst_csv()

    print("DEBUG SENSEX LOAD 1 | entered get_nfo_file_data_sensex()")
    print(f"DEBUG SENSEX LOAD 2 | raw inst_name = {inst_name}")
    print(f"DEBUG SENSEX LOAD 3 | raw expiry from cred = {cred.get('i_expiry_date_sensex')}")
    print(f"DEBUG SENSEX LOAD 4 | total rows in CSV = {len(df_inst)}")

    # --- SAFE CSV EXPIRY PARSING ---
    df_inst["InsertedDates"] = pd.to_datetime(
        df_inst["expiry"].astype(str).str.strip(),
        dayfirst=True,
        errors="coerce"
    )

    # --- SAFE TARGET EXPIRY PARSING ---
    expiry_value = cred.get("i_expiry_date_sensex")

    if isinstance(expiry_value, str):
        expiry_value = expiry_value.strip()
        if len(expiry_value) == 8 and expiry_value.isdigit():
            expiry_value = pd.to_datetime(expiry_value, format="%Y%m%d", errors="coerce")
        else:
            expiry_value = pd.to_datetime(expiry_value, errors="coerce")
    elif isinstance(expiry_value, (int, np.integer)):
        expiry_value = pd.to_datetime(str(int(expiry_value)), format="%Y%m%d", errors="coerce")
    else:
        expiry_value = pd.to_datetime(expiry_value, errors="coerce")

    if pd.isna(expiry_value):
        print("DEBUG SENSEX LOAD 5 | expiry parsing failed")
        nfo_data = pd.DataFrame()
        return

    expiry_value = pd.Timestamp(expiry_value).date()
    print(f"DEBUG SENSEX LOAD 6 | parsed expiry_value = {expiry_value}")

    valid_rows = df_inst[df_inst["InsertedDates"].notna()].copy()
    print(f"DEBUG SENSEX LOAD 7 | valid expiry rows = {len(valid_rows)}")

    if len(valid_rows) > 0:
        expiries = sorted(valid_rows["InsertedDates"].dt.date.drop_duplicates().tolist())
        print(f"DEBUG SENSEX LOAD 8 | available expiries sample = {expiries[:10]}")

    a = valid_rows[valid_rows["InsertedDates"].dt.date == expiry_value].copy()
    print(f"DEBUG SENSEX LOAD 9 | rows after expiry filter = {len(a)}")

    inst_name = str(inst_name).strip().upper()

    if inst_name in {"S", "SENSEX"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "SENSEX"].copy()
    else:
        nfo_data = pd.DataFrame()

    print(f"DEBUG SENSEX LOAD 10 | rows after name filter = {len(nfo_data)}")

    if len(nfo_data) > 0:
        print("DEBUG SENSEX LOAD 11 | sample:")
        print(nfo_data.head(10).to_string(index=False))
    else:
        print("DEBUG SENSEX LOAD 11 | dataframe empty")

def get_nfo_file_data_banknifty(inst_name):
    global nfo_data

    cred = _read_cred()
    df_inst = _read_inst_csv()

    print("DEBUG BANKNIFTY LOAD 1 | entered get_nfo_file_data_banknifty()")
    print(f"DEBUG BANKNIFTY LOAD 2 | raw inst_name = {inst_name}")
    print(f"DEBUG BANKNIFTY LOAD 3 | raw expiry from cred = {cred.get('i_expiry_date_banknifty')}")
    print(f"DEBUG BANKNIFTY LOAD 4 | total rows in CSV = {len(df_inst)}")

    # --- SAFE CSV EXPIRY PARSING ---
    df_inst["InsertedDates"] = pd.to_datetime(
        df_inst["expiry"].astype(str).str.strip(),
        dayfirst=True,
        errors="coerce"
    )

    # --- SAFE TARGET EXPIRY PARSING ---
    expiry_value = cred.get("i_expiry_date_banknifty")

    if isinstance(expiry_value, str):
        expiry_value = expiry_value.strip()
        if len(expiry_value) == 8 and expiry_value.isdigit():
            expiry_value = pd.to_datetime(expiry_value, format="%Y%m%d", errors="coerce")
        else:
            expiry_value = pd.to_datetime(expiry_value, errors="coerce")
    elif isinstance(expiry_value, (int, np.integer)):
        expiry_value = pd.to_datetime(str(int(expiry_value)), format="%Y%m%d", errors="coerce")
    else:
        expiry_value = pd.to_datetime(expiry_value, errors="coerce")

    if pd.isna(expiry_value):
        print("DEBUG BANKNIFTY LOAD 5 | expiry parsing failed")
        nfo_data = pd.DataFrame()
        return

    expiry_value = pd.Timestamp(expiry_value).date()
    print(f"DEBUG BANKNIFTY LOAD 6 | parsed expiry_value = {expiry_value}")

    valid_rows = df_inst[df_inst["InsertedDates"].notna()].copy()
    print(f"DEBUG BANKNIFTY LOAD 7 | valid expiry rows = {len(valid_rows)}")

    if len(valid_rows) > 0:
        expiries = sorted(valid_rows["InsertedDates"].dt.date.drop_duplicates().tolist())
        print(f"DEBUG BANKNIFTY LOAD 8 | available expiries sample = {expiries[:10]}")

    a = valid_rows[valid_rows["InsertedDates"].dt.date == expiry_value].copy()
    print(f"DEBUG BANKNIFTY LOAD 9 | rows after expiry filter = {len(a)}")

    inst_name = str(inst_name).strip().upper()

    if inst_name in {"BN", "BANKNIFTY"}:
        nfo_data = a[a["name"].astype(str).str.strip().str.upper() == "BANKNIFTY"].copy()
    else:
        nfo_data = pd.DataFrame()

    print(f"DEBUG BANKNIFTY LOAD 10 | rows after name filter = {len(nfo_data)}")

    if len(nfo_data) > 0:
        print("DEBUG BANKNIFTY LOAD 11 | sample:")
        print(nfo_data.head(10).to_string(index=False))
    else:
        print("DEBUG BANKNIFTY LOAD 11 | dataframe empty")


def get_instrument_tokens():
    global instrument_tokens
    cred = _read_cred()
    df_inst = _read_inst_csv()
    inst_name = cred["i_inst_name"]
    expiry_date = cred["i_expiry_date"]
    print("inst_name :", inst_name, ", expiry_date :", expiry_date)
    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%Y-%m-%d")
    a = df_inst[df_inst["InsertedDates"].dt.date == expiry_date]
    if cred["i_inst_name"] == "BX":
        b = a[a["name"] == "BANKEX"]
        return np.int64(b["instrument_token"]).tolist()
    if cred["i_inst_name"] == "FN":
        b = a[a["name"] == "FINNIFTY"]
        return np.int64(b["instrument_token"]).tolist()
    if cred["i_inst_name"] == "BN":
        b = a[a["name"] == "BANKNIFTY"]
        return np.int64(b["instrument_token"]).tolist()
    if cred["i_inst_name"] == "N":
        b = a[a["name"] == "NIFTY"]
        return np.int64(b["instrument_token"]).tolist()
    if cred["i_inst_name"] == "S":
        b = a[a["name"] == "SENSEX"]
        return np.int64(b["instrument_token"]).tolist()
    if cred["i_inst_name"] == "C":
        print("fetch inst tokens for crude oil")
        b = a[a["name"] == "CRUDEOIL"]
        c = b[b["exchange"] == "MCX"]
        return np.int64(c["instrument_token"]).tolist()

def get_instrument_tokens_pe_crude_oil():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_crude_oil(cred["i_inst_name_crude_oil"])
    df2 = nfo_data[nfo_data["instrument_type"] == "PE"]
    if len(df2) > 0:
        return df2["instrument_token"].tolist()
    return None


def get_instrument_tokens_ce_nifty():
    global nfo_data

    print("DEBUG CE TOKENS 1 | entered get_instrument_tokens_ce_nifty()")

    if nfo_data is None or len(nfo_data) == 0:
        cred = _read_cred()
        print(f"DEBUG CE TOKENS 2 | i_inst_name_nifty = {cred.get('i_inst_name_nifty')}")
        print(f"DEBUG CE TOKENS 3 | i_expiry_date_nifty = {cred.get('i_expiry_date_nifty')}")
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])

    if nfo_data is None:
        print("DEBUG CE TOKENS 4 | nfo_data is still None")
        return []

    print(f"DEBUG CE TOKENS 5 | nfo_data rows = {len(nfo_data)}")
    print(f"DEBUG CE TOKENS 6 | nfo_data columns = {list(nfo_data.columns)}")

    if len(nfo_data) > 0:
        print("DEBUG CE TOKENS 7 | nfo_data sample:")
        print(nfo_data.head(10).to_string(index=False))

    df1 = nfo_data[nfo_data["instrument_type"].astype(str).str.strip().str.upper() == "CE"].copy()

    print(f"DEBUG CE TOKENS 8 | CE rows after filter = {len(df1)}")

    if len(df1) > 0:
        tokens = df1["instrument_token"].dropna().astype(int).tolist()
        print(f"DEBUG CE TOKENS 9 | token count = {len(tokens)}")
        return tokens

    return []


def get_instrument_tokens_pe_nifty():
    global nfo_data

    print("DEBUG PE TOKENS NIFTY 1 | entered get_instrument_tokens_pe_nifty()")

    if nfo_data is None or len(nfo_data) == 0:
        cred = _read_cred()
        print(f"DEBUG PE TOKENS NIFTY 2 | i_inst_name_nifty = {cred.get('i_inst_name_nifty')}")
        print(f"DEBUG PE TOKENS NIFTY 3 | i_expiry_date_nifty = {cred.get('i_expiry_date_nifty')}")
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])

    if nfo_data is None:
        print("DEBUG PE TOKENS NIFTY 4 | nfo_data is still None")
        return []

    print(f"DEBUG PE TOKENS NIFTY 5 | nfo_data rows = {len(nfo_data)}")

    df2 = nfo_data[
        nfo_data["instrument_type"].astype(str).str.strip().str.upper() == "PE"
    ].copy()

    print(f"DEBUG PE TOKENS NIFTY 6 | PE rows after filter = {len(df2)}")

    if len(df2) > 0:
        tokens = df2["instrument_token"].dropna().astype(int).tolist()
        print(f"DEBUG PE TOKENS NIFTY 7 | token count = {len(tokens)}")
        return tokens

    return []


def get_instrument_tokens_ce_sensex():
    global nfo_data

    print("DEBUG CE TOKENS SENSEX 1 | entered get_instrument_tokens_ce_sensex()")

    if nfo_data is None or len(nfo_data) == 0:
        cred = _read_cred()
        print(f"DEBUG CE TOKENS SENSEX 2 | i_inst_name_sensex = {cred.get('i_inst_name_sensex')}")
        print(f"DEBUG CE TOKENS SENSEX 3 | i_expiry_date_sensex = {cred.get('i_expiry_date_sensex')}")
        get_nfo_file_data_sensex(cred["i_inst_name_sensex"])

    if nfo_data is None:
        print("DEBUG CE TOKENS SENSEX 4 | nfo_data is still None")
        return []

    print(f"DEBUG CE TOKENS SENSEX 5 | nfo_data rows = {len(nfo_data)}")

    df1 = nfo_data[
        nfo_data["instrument_type"].astype(str).str.strip().str.upper() == "CE"
    ].copy()

    print(f"DEBUG CE TOKENS SENSEX 6 | CE rows after filter = {len(df1)}")

    if len(df1) > 0:
        tokens = df1["instrument_token"].dropna().astype(int).tolist()
        print(f"DEBUG CE TOKENS SENSEX 7 | token count = {len(tokens)}")
        return tokens

    return []


def get_instrument_tokens_pe_sensex():
    global nfo_data

    print("DEBUG PE TOKENS SENSEX 1 | entered get_instrument_tokens_pe_sensex()")

    if nfo_data is None or len(nfo_data) == 0:
        cred = _read_cred()
        print(f"DEBUG PE TOKENS SENSEX 2 | i_inst_name_sensex = {cred.get('i_inst_name_sensex')}")
        print(f"DEBUG PE TOKENS SENSEX 3 | i_expiry_date_sensex = {cred.get('i_expiry_date_sensex')}")
        get_nfo_file_data_sensex(cred["i_inst_name_sensex"])

    if nfo_data is None:
        print("DEBUG PE TOKENS SENSEX 4 | nfo_data is still None")
        return []

    print(f"DEBUG PE TOKENS SENSEX 5 | nfo_data rows = {len(nfo_data)}")

    df2 = nfo_data[
        nfo_data["instrument_type"].astype(str).str.strip().str.upper() == "PE"
    ].copy()

    print(f"DEBUG PE TOKENS SENSEX 6 | PE rows after filter = {len(df2)}")

    if len(df2) > 0:
        tokens = df2["instrument_token"].dropna().astype(int).tolist()
        print(f"DEBUG PE TOKENS SENSEX 7 | token count = {len(tokens)}")
        return tokens

    return []


def get_instrument_tokens_ce_banknifty(inst_token_ce=None):
    global nfo_data

    print("DEBUG CE TOKENS BANKNIFTY 1 | entered get_instrument_tokens_ce_banknifty()")

    if nfo_data is None or len(nfo_data) == 0:
        cred = _read_cred()
        print(f"DEBUG CE TOKENS BANKNIFTY 2 | i_inst_name_banknifty = {cred.get('i_inst_name_banknifty')}")
        print(f"DEBUG CE TOKENS BANKNIFTY 3 | i_expiry_date_banknifty = {cred.get('i_expiry_date_banknifty')}")
        get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])

    if nfo_data is None:
        print("DEBUG CE TOKENS BANKNIFTY 4 | nfo_data is still None")
        return []

    print(f"DEBUG CE TOKENS BANKNIFTY 5 | nfo_data rows = {len(nfo_data)}")

    df1 = nfo_data[
        nfo_data["instrument_type"].astype(str).str.strip().str.upper() == "CE"
    ].copy()

    print(f"DEBUG CE TOKENS BANKNIFTY 6 | CE rows after filter = {len(df1)}")

    if len(df1) > 0:
        tokens = df1["instrument_token"].dropna().astype(int).tolist()
        print(f"DEBUG CE TOKENS BANKNIFTY 7 | token count = {len(tokens)}")
        return tokens

    return []


def get_instrument_tokens_pe_banknifty(inst_token_pe=None):
    global nfo_data

    print("DEBUG PE TOKENS BANKNIFTY 1 | entered get_instrument_tokens_pe_banknifty()")

    if nfo_data is None or len(nfo_data) == 0:
        cred = _read_cred()
        print(f"DEBUG PE TOKENS BANKNIFTY 2 | i_inst_name_banknifty = {cred.get('i_inst_name_banknifty')}")
        print(f"DEBUG PE TOKENS BANKNIFTY 3 | i_expiry_date_banknifty = {cred.get('i_expiry_date_banknifty')}")
        get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])

    if nfo_data is None:
        print("DEBUG PE TOKENS BANKNIFTY 4 | nfo_data is still None")
        return []

    print(f"DEBUG PE TOKENS BANKNIFTY 5 | nfo_data rows = {len(nfo_data)}")

    df2 = nfo_data[
        nfo_data["instrument_type"].astype(str).str.strip().str.upper() == "PE"
    ].copy()

    print(f"DEBUG PE TOKENS BANKNIFTY 6 | PE rows after filter = {len(df2)}")

    if len(df2) > 0:
        tokens = df2["instrument_token"].dropna().astype(int).tolist()
        print(f"DEBUG PE TOKENS BANKNIFTY 7 | token count = {len(tokens)}")
        return tokens

    return []

def get_instrument_tokens_ce_crude_oil():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_crude_oil(cred["i_inst_name_crude_oil"])
    df1 = nfo_data[nfo_data["instrument_type"] == "CE"]
    df1.loc[:, "expiry"] = pd.to_datetime(df1["expiry"].astype(str).str.strip(), errors="coerce")
    if len(df1) > 0:
        return df1["instrument_token"].tolist()
    return None


def get_option_chain_ce_nifty():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])
    df1 = nfo_data[nfo_data["instrument_type"] == "CE"]
    df1.loc[:, "expiry"] = pd.to_datetime(df1["expiry"].astype(str).str.strip(), errors="coerce")
    return None


def build_nifty_ce_chain_50_strike_with_ltp():
    global nfo_data

    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])

    if nfo_data is None or len(nfo_data) == 0:
        raise ValueError("NFO data for NIFTY is empty.")

    df_ce = nfo_data[nfo_data["instrument_type"] == "CE"].copy()
    if df_ce.empty:
        raise ValueError("No CE contracts found in NFO data for NIFTY.")

    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()

    if pd.isna(nearest_expiry):
        raise ValueError("No valid nearest expiry found for NIFTY CE chain.")

    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    spot_data = _get_kite().ltp([256265])
    nifty_spot = _get_last_price_from_ltp(spot_data, 256265)
    print(f"Current NIFTY Spot: {nifty_spot:.2f}")

    atm_strike = round(nifty_spot / 50) * 50
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (6 * 50)
    strike_max = atm_strike + (6 * 50)

    df_ce = df_ce[(df_ce["strike"] >= strike_min) & (df_ce["strike"] <= strike_max)].copy()

    if df_ce.empty:
        raise ValueError("No CE strikes found in selected NIFTY 50-point strike range.")

    ce_tokens = df_ce["instrument_token"].dropna().astype(int).tolist()
    if not ce_tokens:
        raise ValueError("No CE instrument tokens found for selected NIFTY strikes.")

    quote_details_ce = _get_kite().ltp(ce_tokens)
    df_ltp = _build_ltp_df(quote_details_ce)

    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price_y"]],
        on="instrument_token",
        how="left"
    )

    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    print("\n=== NIFTY CE Option Chain (ATM ±4 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce


def build_banknifty_ce_chain_100_strike_with_ltp():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])

    df_ce = nfo_data[nfo_data["instrument_type"] == "CE"].copy()
    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()
    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    spot_data = _get_kite().ltp([260105])
    banknifty_spot = _get_last_price_from_ltp(spot_data, 260105)
    print(f"Current BANKNIFTY Spot: {banknifty_spot:.2f}")

    atm_strike = round(banknifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_ce = df_ce[
        (df_ce["strike"] >= strike_min)
        & (df_ce["strike"] <= strike_max)
        & (df_ce["strike"] % 100 == 0)
    ].copy()

    ce_tokens = df_ce["instrument_token"].dropna().astype(int).tolist()
    quote_details_ce = _get_kite().ltp(ce_tokens)
    df_ltp = _build_ltp_df(quote_details_ce)

    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price_y"]],
        on="instrument_token",
        how="left"
    )

    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    print("\n=== BANKNIFTY CE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce


def build_sensex_ce_chain_100_strike_with_ltp():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_sensex(cred["i_inst_name_sensex"])

    df_ce = nfo_data[nfo_data["instrument_type"] == "CE"].copy()
    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()
    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    spot_data = _get_kite().ltp([265])
    sensex_spot = _get_last_price_from_ltp(spot_data, 265)
    print(f"Current SENSEX Spot: {sensex_spot:.2f}")

    atm_strike = round(sensex_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_ce = df_ce[
        (df_ce["strike"] >= strike_min)
        & (df_ce["strike"] <= strike_max)
        & (df_ce["strike"] % 100 == 0)
    ].copy()

    ce_tokens = df_ce["instrument_token"].dropna().astype(int).tolist()
    quote_details_ce = _get_kite().ltp(ce_tokens)
    df_ltp = _build_ltp_df(quote_details_ce)

    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price_y"]],
        on="instrument_token",
        how="left"
    )

    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    print("\n=== SENSEX CE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce


def build_nifty_ce_chain_100_strike_with_ltp():
    global nfo_data

    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])

    if nfo_data is None or len(nfo_data) == 0:
        raise ValueError("NFO data for NIFTY is empty.")

    df_ce = nfo_data[nfo_data["instrument_type"] == "CE"].copy()
    if df_ce.empty:
        raise ValueError("No CE contracts found in NFO data for NIFTY.")

    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()

    if pd.isna(nearest_expiry):
        raise ValueError("No valid nearest expiry found for NIFTY CE chain.")

    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    spot_data = _get_kite().ltp([256265])
    nifty_spot = _get_last_price_from_ltp(spot_data, 256265)
    print(f"Current NIFTY Spot: {nifty_spot:.2f}")

    atm_strike = round(nifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_ce = df_ce[
        (df_ce["strike"] >= strike_min)
        & (df_ce["strike"] <= strike_max)
        & (df_ce["strike"] % 100 == 0)
    ].copy()

    if df_ce.empty:
        raise ValueError("No CE strikes found in selected NIFTY strike range.")

    ce_tokens = df_ce["instrument_token"].dropna().astype(int).tolist()
    if not ce_tokens:
        raise ValueError("No CE instrument tokens found for selected NIFTY strikes.")

    quote_details_ce = _get_kite().ltp(ce_tokens)
    df_ltp = _build_ltp_df(quote_details_ce)

    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price_y"]],
        on="instrument_token",
        how="left"
    )

    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    print("\n=== NIFTY CE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce


def build_nifty_pe_chain_100_strike_with_ltp():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])

    df_pe = nfo_data[nfo_data["instrument_type"] == "PE"].copy()
    df_pe["expiry"] = pd.to_datetime(df_pe["expiry"], errors="coerce")
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_pe[df_pe["expiry"] >= current_date]["expiry"].min()
    df_pe = df_pe[df_pe["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | PE contracts: {len(df_pe)}")

    spot_data = _get_kite().ltp([256265])
    nifty_spot = _get_last_price_from_ltp(spot_data, 256265)
    print(f"Current NIFTY Spot: {nifty_spot:.2f}")

    atm_strike = round(nifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_pe = df_pe[
        (df_pe["strike"] >= strike_min)
        & (df_pe["strike"] <= strike_max)
        & (df_pe["strike"] % 100 == 0)
    ]

    pe_tokens = df_pe["instrument_token"].dropna().astype(int).tolist()
    quote_details_pe = _get_kite().ltp(pe_tokens)
    df_ltp = _build_ltp_df(quote_details_pe)

    df_pe = df_pe.merge(
        df_ltp[["instrument_token", "last_price_y"]],
        on="instrument_token",
        how="left"
    )

    df_pe = df_pe.sort_values("strike").reset_index(drop=True)

    print("\n=== NIFTY PE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_pe[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_pe


def build_banknifty_pe_chain_100_strike_with_ltp():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])

    df_pe = nfo_data[nfo_data["instrument_type"] == "PE"].copy()
    df_pe["expiry"] = pd.to_datetime(df_pe["expiry"], errors="coerce")
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_pe[df_pe["expiry"] >= current_date]["expiry"].min()
    df_pe = df_pe[df_pe["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | PE contracts: {len(df_pe)}")

    spot_data = _get_kite().ltp([260105])
    banknifty_spot = _get_last_price_from_ltp(spot_data, 260105)
    print(f"Current BANKNIFTY Spot: {banknifty_spot:.2f}")

    atm_strike = round(banknifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_pe = df_pe[
        (df_pe["strike"] >= strike_min)
        & (df_pe["strike"] <= strike_max)
        & (df_pe["strike"] % 100 == 0)
    ].copy()

    pe_tokens = df_pe["instrument_token"].dropna().astype(int).tolist()
    quote_details_pe = _get_kite().ltp(pe_tokens)
    df_ltp = _build_ltp_df(quote_details_pe)

    df_pe = df_pe.merge(
        df_ltp[["instrument_token", "last_price_y"]],
        on="instrument_token",
        how="left"
    )

    df_pe = df_pe.sort_values("strike").reset_index(drop=True)

    print("\n=== BANKNIFTY PE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_pe[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_pe


def build_sensex_pe_chain_100_strike_with_ltp():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_sensex(cred["i_inst_name_sensex"])

    df_pe = nfo_data[nfo_data["instrument_type"] == "PE"].copy()
    df_pe["expiry"] = pd.to_datetime(df_pe["expiry"], errors="coerce")
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_pe[df_pe["expiry"] >= current_date]["expiry"].min()
    df_pe = df_pe[df_pe["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | PE contracts: {len(df_pe)}")

    spot_data = _get_kite().ltp([265])
    sensex_spot = _get_last_price_from_ltp(spot_data, 265)
    print(f"Current SENSEX Spot: {sensex_spot:.2f}")

    atm_strike = round(sensex_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_pe = df_pe[
        (df_pe["strike"] >= strike_min)
        & (df_pe["strike"] <= strike_max)
        & (df_pe["strike"] % 100 == 0)
    ].copy()

    pe_tokens = df_pe["instrument_token"].dropna().astype(int).tolist()
    quote_details_pe = _get_kite().ltp(pe_tokens)
    df_ltp = _build_ltp_df(quote_details_pe)

    df_pe = df_pe.merge(
        df_ltp[["instrument_token", "last_price_y"]],
        on="instrument_token",
        how="left"
    )

    df_pe = df_pe.sort_values("strike").reset_index(drop=True)

    print("\n=== SENSEX PE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_pe[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_pe


def bull_call_spreads_nifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (150, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    required = {"strike", "last_price_y", "lot_size"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (
        df.rename(columns={"last_price_y": "ltp"})
        .loc[:, ["strike", "ltp", "lot_size"]]
        .dropna()
    )
    d["strike"] = d["strike"].astype(float)
    d["ltp"] = d["ltp"].astype(float)
    d = d.sort_values("strike").reset_index(drop=True)

    ltp_map = d.set_index("strike")["ltp"].to_dict()
    lot_size = int(d["lot_size"].iloc[0])

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d["strike"] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, "strike"])]
    else:
        buy_candidates = d["strike"].tolist()

    rows = []
    for b in buy_candidates:
        buy_ltp = ltp_map.get(b)
        if buy_ltp is None:
            continue
        for g in gaps:
            s = b + g
            sell_ltp = ltp_map.get(s)
            if sell_ltp is None:
                continue
            width = s - b
            net_debit = buy_ltp - sell_ltp
            if net_debit <= 0:
                continue
            max_profit = width - net_debit
            if max_profit < 0:
                continue
            rr = max_profit / net_debit
            rows.append(
                {
                    "buy_strike": b,
                    "buy_ltp": round(buy_ltp, 2),
                    "sell_strike": s,
                    "sell_ltp": round(sell_ltp, 2),
                    "gap": int(width),
                    "net_debit": round(net_debit, 2),
                    "max_profit": round(max_profit, 2),
                    "rr": round(rr, 3),
                    "breakeven": round(b + net_debit, 2),
                    "per_lot_debit": round(net_debit * lot_size, 2),
                    "per_lot_max_profit": round(max_profit * lot_size, 2),
                    "lot_size": lot_size,
                }
            )

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out["rr_distance"] = (out["rr"] - rr_target).abs()
    out = out.sort_values(["rr_distance", "rr"], ascending=[True, False]).reset_index(drop=True)
    return out


def bull_call_spreads_banknifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
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

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d["strike"] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, "strike"])]
    else:
        buy_candidates = d["strike"].tolist()

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

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out["rr_distance"] = (out["rr"] - rr_target).abs()
    out = out.sort_values(["rr_distance", "rr"], ascending=[True, False]).reset_index(drop=True)
    return out


def bull_call_spreads_sensex(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
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

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d["strike"] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, "strike"])]
    else:
        buy_candidates = d["strike"].tolist()

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

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out["rr_distance"] = (out["rr"] - rr_target).abs()
    out = out.sort_values(["rr_distance", "rr"], ascending=[True, False]).reset_index(drop=True)
    return out


def bear_put_spreads_nifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (150, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
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

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d["strike"] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, "strike"])]
    else:
        buy_candidates = d["strike"].tolist()

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

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out["rr_distance"] = (out["rr"] - rr_target).abs()
    out = out.sort_values(["rr_distance", "rr"], ascending=[True, False]).reset_index(drop=True)
    return out


def bear_put_spreads_banknifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
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

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d["strike"] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, "strike"])]
    else:
        buy_candidates = d["strike"].tolist()

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

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out["rr_distance"] = (out["rr"] - rr_target).abs()
    out = out.sort_values(["rr_distance", "rr"], ascending=[True, False]).reset_index(drop=True)
    return out


def bear_put_spreads_sensex(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
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

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d["strike"] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, "strike"])]
    else:
        buy_candidates = d["strike"].tolist()

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

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out["rr_distance"] = (out["rr"] - rr_target).abs()
    out = out.sort_values(["rr_distance", "rr"], ascending=[True, False]).reset_index(drop=True)
    return out


def get_strike_for_inst_token_ce_banknifty(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]["strike"]).item()
        return np.int64(df1.iloc[-1]["strike"]).item()
    return None


def get_strike_for_inst_token_ce_crude_oil(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_crude_oil(cred["i_inst_name_crude_oil"])
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]["strike"]).item()
        return np.int64(df1.iloc[-1]["strike"]).item()
    return None


def get_strike_for_inst_token_pe_sensex(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        print("else")
        cred = _read_cred()
        get_nfo_file_data_sensex(cred["i_inst_name_sensex"])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]["strike"]).item()
        return np.int64(df1.iloc[-1]["strike"]).item()
    return None


def get_strike_for_inst_token_pe_nifty(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        print("else")
        cred = _read_cred()
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]["strike"]).item()
        return np.int64(df1.iloc[-1]["strike"]).item()
    return None


def get_strike_for_inst_token_pe_banknifty(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        print("else")
        cred = _read_cred()
        get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]["strike"]).item()
        return np.int64(df1.iloc[-1]["strike"]).item()
    return None


def get_strike_for_inst_token_pe_crude_oil(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        print("else")
        cred = _read_cred()
        get_nfo_file_data_crude_oil(cred["i_inst_name_crude_oil"])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]["strike"]).item()
        return np.int64(df1.iloc[-1]["strike"]).item()
    return None


def get_trading_symbol_ce_crude_oil(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_crude_oil(cred["i_inst_name_crude_oil"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "CE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_ce_sensex(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_sensex(cred["i_inst_name_sensex"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "CE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_ce_nifty(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_nifty(cred["i_inst_name_nifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "CE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_ce_banknifty(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "CE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_pe_sensex(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_sensex(cred["i_inst_name_sensex"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "PE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_pe_nifty(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_nifty(cred["i_inst_name_nifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "PE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_pe_banknifty(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "PE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_pe_crude_oil(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_crude_oil(cred["i_inst_name_crude_oil"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    df2 = df1[df1["instrument_type"] == "PE"]
    if len(df2) == 1:
        return df2.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_for_inst_token_sensex(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_sensex(cred["i_inst_name_sensex"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    if len(df1) == 1:
        return df1.iloc[-1]["tradingsymbol"]
    return None


def get_trading_symbol_for_inst_token_nifty(instrument_token):
    cred = _read_cred()
    get_nfo_file_data_nifty(cred["i_inst_name_nifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == instrument_token]
    if len(df1) == 1:
        return df1.iloc[-1]["tradingsymbol"]
    return None


def get_inst_token_for_trading_symbol_sensex(tradingsymbol):
    cred = _read_cred()
    get_nfo_file_data_sensex(cred["i_inst_name_sensex"])
    df1 = nfo_data[nfo_data["tradingsymbol"] == tradingsymbol]
    df2 = df1[df1["exchange"] == cred["i_exchange_code"]]
    if len(df2) == 1:
        return df2.iloc[-1]["instrument_token"]
    return None


def get_inst_token_for_trading_symbol_nifty(tradingsymbol):
    cred = _read_cred()
    get_nfo_file_data_nifty(cred["i_inst_name_nifty"])
    df1 = nfo_data[nfo_data["tradingsymbol"] == tradingsymbol]
    df2 = df1[df1["exchange"] == cred["i_exchange_code"]]
    if len(df2) == 1:
        return df2.iloc[-1]["instrument_token"]
    return None


def get_inst_type_for_inst_token_nifty(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_nifty(cred["i_inst_name_nifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        return df1.iloc[-1]["instrument_type"]
    return None


def get_inst_type_for_inst_token_banknifty(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_banknifty(cred["i_inst_name_banknifty"])
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        return df1.iloc[-1]["instrument_type"]
    return None


def get_inst_type_for_inst_token_crude_oil(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        cred = _read_cred()
        get_nfo_file_data_crude_oil(cred["i_inst_name_crude_oil"])
    df1 = nfo_data[nfo_data["instrument_token"] == inst_token]
    if len(df1) == 1:
        return df1.iloc[-1]["instrument_type"]
    return None


def get_instrument_details_nifty():
    i_inst_name = "N"
    i_stock_code = "NIFTY"
    i_exchange_code = "NFO"

    today = datetime.now().date()
    days_ahead = (1 - today.weekday()) % 7
    if days_ahead == 0:
        expiry = today
    else:
        expiry = today + timedelta(days=days_ahead)

    i_expiry_date_nifty = expiry
    print("Expiry Date Util:", i_expiry_date_nifty, i_inst_name, i_stock_code, i_exchange_code)
    return i_inst_name, i_stock_code, i_exchange_code, i_expiry_date_nifty


def get_instrument_details_banknifty():
    i_inst_name = "BN"
    i_stock_code = "BANKNIFTY"
    i_exchange_code = "NFO"

    today = datetime.now().date()
    if today.month == 12:
        first_day_next_month = datetime(today.year + 1, 1, 1).date()
    else:
        first_day_next_month = datetime(today.year, today.month + 1, 1).date()

    last_day_this_month = first_day_next_month - timedelta(days=1)

    while last_day_this_month.weekday() != 3:
        last_day_this_month -= timedelta(days=1)

    i_expiry_date_banknifty = last_day_this_month
    print("Expiry Date Util:", i_expiry_date_banknifty, i_inst_name, i_stock_code, i_exchange_code)
    return i_inst_name, i_stock_code, i_exchange_code, i_expiry_date_banknifty


def get_instrument_details_sensex():
    i_inst_name = "S"
    i_stock_code = "SENSEX"
    i_exchange_code = "BFO"

    today = datetime.now().date()
    days_ahead = (1 - today.weekday()) % 7
    if days_ahead == 0:
        expiry = today
    else:
        expiry = today + timedelta(days=days_ahead)

    i_expiry_date_sensex = expiry
    print("Expiry Date Util:", i_expiry_date_sensex, i_inst_name, i_stock_code, i_exchange_code)
    return i_inst_name, i_stock_code, i_exchange_code, i_expiry_date_sensex


def get_instrument_details_crude_oil():
    i_inst_name = "C"
    i_stock_code = "CRUDEOIL"
    i_exchange_code = "MCX"

    today = datetime.now()

    if today.month == 12:
        first_day_next_month = datetime(today.year + 1, 1, 1).date()
    else:
        first_day_next_month = datetime(today.year, today.month + 1, 1).date()

    last_day_this_month = first_day_next_month - timedelta(days=1)

    while last_day_this_month.weekday() != 0:
        last_day_this_month -= timedelta(days=1)

    i_expiry_date_crude_oil = last_day_this_month
    print("Expiry Date Util:", i_expiry_date_crude_oil, i_inst_name, i_stock_code, i_exchange_code)
    return i_inst_name, i_stock_code, i_exchange_code, i_expiry_date_crude_oil


def main():
    get_zerodha_inst_file()
    cred = _read_cred()

    i_inst_name_nifty, i_stock_code_nifty, i_exchange_code_nifty, i_expiry_date_nifty = get_instrument_details_nifty()
    i_inst_name_banknifty, i_stock_code_banknifty, i_exchange_code_banknifty, i_expiry_date_banknifty = get_instrument_details_banknifty()
    i_inst_name_sensex, i_stock_code_sensex, i_exchange_code_sensex, i_expiry_date_sensex = get_instrument_details_sensex()
    i_inst_name_crude_oil, i_stock_code_crude_oil, i_exchange_code_crude_oil, i_expiry_date_crude_oil = get_instrument_details_crude_oil()

    insert_data_rec(cred, "i_expiry_date_nifty", i_expiry_date_nifty)
    insert_data_rec(cred, "i_expiry_date_banknifty", i_expiry_date_banknifty)
    insert_data_rec(cred, "i_expiry_date_sensex", i_expiry_date_sensex)
    insert_data_rec(cred, "i_expiry_date_crude_oil", i_expiry_date_crude_oil)

    insert_data_rec(cred, "i_inst_name_nifty", i_inst_name_nifty)
    insert_data_rec(cred, "i_inst_name_banknifty", i_inst_name_banknifty)
    insert_data_rec(cred, "i_inst_name_sensex", i_inst_name_sensex)
    insert_data_rec(cred, "i_inst_name_crude_oil", i_inst_name_crude_oil)

    insert_data_rec(cred, "i_stock_code_nifty", i_stock_code_nifty)
    insert_data_rec(cred, "i_stock_code_banknifty", i_stock_code_banknifty)
    insert_data_rec(cred, "i_stock_code_sensex", i_stock_code_sensex)
    insert_data_rec(cred, "i_stock_code_crude_oil", i_stock_code_crude_oil)

    insert_data_rec(cred, "i_exchange_code_nifty", i_exchange_code_nifty)
    insert_data_rec(cred, "i_exchange_code_banknifty", i_exchange_code_banknifty)
    insert_data_rec(cred, "i_exchange_code_sensex", i_exchange_code_sensex)
    insert_data_rec(cred, "i_exchange_code_crude_oil", i_exchange_code_crude_oil)

    _write_cred(cred)
