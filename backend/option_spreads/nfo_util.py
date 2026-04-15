import yaml
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta
from kiteconnect import KiteConnect
from datetime import datetime
from typing import Iterable, Optional
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "inst_zerodha_nfo.csv"
df = pd.read_csv(CSV_PATH)
# ----------------------------------------------------------
# 1. Load credentials and initialize Kite API
# ----------------------------------------------------------
with open("cred.yml") as f:
    cred = yaml.safe_load(f)

kite = KiteConnect(api_key=cred["z_api_key"])
kite.set_access_token(cred["z_access_token"])

nfo_data = None
# i_inst_name = 'S' if datetime.now().strftime('%A') == 'Tuesday' else 'N'
i_inst_name =  'N'
expiry_date = None

with open('cred.yml') as f:
    cred = yaml.load(f, Loader=yaml.FullLoader)
# with open('cred.yml') as f:
#     cred = yaml.load(f, Loader=yaml.FullLoader)
#     z_user_id = cred['z_user_id']
#     z_password = cred['z_password']
#     z_tsecret = cred['z_tsecret']

def get_zerodha_inst_file():
    url = "https://api.kite.trade/instruments"
    r = requests.get(url, allow_redirects=True)
    with open('inst_zerodha_nfo.csv', 'wb') as f:
        f.write(r.content)




def insert_data_rec(iterable, search_key, data):
    if isinstance(iterable, dict):
        for k, v in iterable.items():
            if k == search_key:
                iterable[k] = data

def nearest_strike(x): return round(round(x), -2)


def round_to_multiple(number, multiple=100):
    return multiple * round(number / multiple)


def get_nfo_file_data_nifty(inst_name):
    global nfo_data
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    df_inst = pd.read_csv("inst_zerodha_nfo.csv")
    # a = pd.read_csv("merged_inst_flattrade_fo.csv") if datetime.now().strftime('%A') == 'Tuesday' else pd.read_csv("inst_zerodha_nfo.csv")
    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%Y-%m-%d")
    a = df_inst[df_inst['InsertedDates'].dt.date == cred['i_expiry_date_nifty']]
    if inst_name == 'BN':
        nfo_data = a[a["name"] == "BANKNIFTY"]
    if inst_name == 'FN':
        nfo_data = a[a["name"] == "FINNIFTY"]
    if inst_name == 'N':
        nfo_data = a[a["name"] == "NIFTY"]
    if inst_name == 'BX':
        nfo_data = a[a["name"] == "BANKEX"]
    if inst_name == 'S':
        nfo_data = a[a["name"] == "SENSEX"]
    if inst_name == 'C':
        nfo_data = a[a["name"] == "CRUDEOIL"]
    if inst_name == 'GP':
        nfo_data = a[a["name"] == "GOLDPETAL"]

def get_nfo_file_data_crude_oil(inst_name):
    global nfo_data
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    df_inst = pd.read_csv("inst_zerodha_nfo.csv")
    # a = pd.read_csv("merged_inst_flattrade_fo.csv") if datetime.now().strftime('%A') == 'Tuesday' else pd.read_csv("inst_zerodha_nfo.csv")
    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%Y-%m-%d")
    a = df_inst[df_inst['InsertedDates'].dt.date == cred['i_expiry_date_crude_oil']]
    if inst_name == 'BN':
        nfo_data = a[a["name"] == "BANKNIFTY"]
    if inst_name == 'FN':
        nfo_data = a[a["name"] == "FINNIFTY"]
    if inst_name == 'N':
        nfo_data = a[a["name"] == "NIFTY"]
    if inst_name == 'BX':
        nfo_data = a[a["name"] == "BANKEX"]
    if inst_name == 'S':
        nfo_data = a[a["name"] == "SENSEX"]
    if inst_name == 'C':
        nfo_data = a[a["name"] == "CRUDEOIL"]
    if inst_name == 'GP':
        nfo_data = a[a["name"] == "GOLDPETAL"]

def get_nfo_file_data_sensex(inst_name):
    global nfo_data
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    df_inst = pd.read_csv("inst_zerodha_nfo.csv")
    # a = pd.read_csv("merged_inst_flattrade_fo.csv") if datetime.now().strftime('%A') == 'Tuesday' else pd.read_csv("inst_zerodha_nfo.csv")
    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%Y-%m-%d")
    a = df_inst[df_inst['InsertedDates'].dt.date == cred['i_expiry_date_sensex']]
    if inst_name == 'BN':
        nfo_data = a[a["name"] == "BANKNIFTY"]
    if inst_name == 'FN':
        nfo_data = a[a["name"] == "FINNIFTY"]
    if inst_name == 'N':
        nfo_data = a[a["name"] == "NIFTY"]
    if inst_name == 'BX':
        nfo_data = a[a["name"] == "BANKEX"]
    if inst_name == 'S':
        nfo_data = a[a["name"] == "SENSEX"]
    if inst_name == 'C':
        nfo_data = a[a["name"] == "CRUDEOIL"]

def get_nfo_file_data_banknifty(inst_name):
    global nfo_data
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    df_inst = pd.read_csv("inst_zerodha_nfo.csv")
    # a = pd.read_csv("merged_inst_flattrade_fo.csv") if datetime.now().strftime('%A') == 'Tuesday' else pd.read_csv("inst_zerodha_nfo.csv")
    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%Y-%m-%d")
    a = df_inst[df_inst['InsertedDates'].dt.date == cred['i_expiry_date_banknifty']]
    if inst_name == 'BN':
        nfo_data = a[a["name"] == "BANKNIFTY"]
    if inst_name == 'FN':
        nfo_data = a[a["name"] == "FINNIFTY"]
    if inst_name == 'N':
        nfo_data = a[a["name"] == "NIFTY"]
    if inst_name == 'BX':
        nfo_data = a[a["name"] == "BANKEX"]
    if inst_name == 'S':
        nfo_data = a[a["name"] == "SENSEX"]
    if inst_name == 'C':
        nfo_data = a[a["name"] == "CRUDEOIL"]

# def get_instrument_token_ce_sensex(strike):
#     try:
#         if nfo_data is not None and len(nfo_data) > 0:
#             pass
#         else:
#             get_nfo_file_data_sensex(i_inst_name)
#         df1 = nfo_data[nfo_data['strike'] == strike]
#         df2 = df1[df1['instrument_type'] == 'CE']
#         if len(df2) == 1:
#             # print("type of inst token : ", np.int64(df2.iloc[-1]['instrument_token']).item())
#             return np.int64(df2.iloc[-1]['instrument_token']).item()
#         return None
#     except:
#         print("No instrument token found.")
#
#
# def get_instrument_token_ce_nifty(strike):
#     try:
#         if nfo_data is not None and len(nfo_data) > 0:
#             pass
#         else:
#             get_nfo_file_data_nifty(i_inst_name)
#         df1 = nfo_data[nfo_data['strike'] == strike]
#         df2 = df1[df1['instrument_type'] == 'CE']
#         if len(df2) == 1:
#             # print("type of inst token : ", np.int64(df2.iloc[-1]['instrument_token']).item())
#             return np.int64(df2.iloc[-1]['instrument_token']).item()
#         return None
#     except:
#         print("No instrument token found.")
#
# def get_instrument_token_ce_banknifty(strike):
#     try:
#         if nfo_data is not None and len(nfo_data) > 0:
#             pass
#         else:
#             get_nfo_file_data_banknifty(i_inst_name)
#         df1 = nfo_data[nfo_data['strike'] == strike]
#         df2 = df1[df1['instrument_type'] == 'CE']
#         if len(df2) == 1:
#             # print("type of inst token : ", np.int64(df2.iloc[-1]['instrument_token']).item())
#             return np.int64(df2.iloc[-1]['instrument_token']).item()
#         return None
#     except:
#         print("No instrument token found.")
#
# def get_instrument_token_pe_sensex(strike):
#     try:
#         if nfo_data is not None and len(nfo_data) > 0:
#             pass
#         else:
#             get_nfo_file_data_sensex(i_inst_name)
#         df1 = nfo_data[nfo_data['strike'] == strike]
#         df2 = df1[df1['instrument_type'] == 'PE']
#         if len(df2) == 1:
#             # print("type of inst token : ", np.int64(df2.iloc[-1]['instrument_token']).item())
#             return np.int64(df2.iloc[-1]['instrument_token']).item()
#         return None
#     except:
#         print("No instrument token found.")
#
#
# def get_instrument_token_pe_nifty(strike):
#     try:
#         if nfo_data is not None and len(nfo_data) > 0:
#             pass
#         else:
#             get_nfo_file_data_nifty(i_inst_name)
#         df1 = nfo_data[nfo_data['strike'] == strike]
#         df2 = df1[df1['instrument_type'] == 'PE']
#         if len(df2) == 1:
#             # print("type of inst token : ", np.int64(df2.iloc[-1]['instrument_token']).item())
#             return np.int64(df2.iloc[-1]['instrument_token']).item()
#         return None
#     except:
#         print("No instrument token found.")
#
# def get_instrument_token_pe_banknifty(strike):
#     try:
#         if nfo_data is not None and len(nfo_data) > 0:
#             pass
#         else:
#             get_nfo_file_data_banknifty(i_inst_name)
#         df1 = nfo_data[nfo_data['strike'] == strike]
#         df2 = df1[df1['instrument_type'] == 'PE']
#         if len(df2) == 1:
#             # print("type of inst token : ", np.int64(df2.iloc[-1]['instrument_token']).item())
#             return np.int64(df2.iloc[-1]['instrument_token']).item()
#         return None
#     except:
#         print("No instrument token found.")


def get_instrument_tokens():
    global instrument_tokens
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)

    df_inst = pd.read_csv("inst_zerodha_nfo.csv")
    inst_name = cred['i_inst_name']
    expiry_date = cred['i_expiry_date']
    print("inst_name :", inst_name, ", expiry_date :", expiry_date)
    df_inst["InsertedDates"] = pd.to_datetime(df_inst["expiry"], format="%Y-%m-%d")
    a = df_inst[df_inst['InsertedDates'].dt.date == expiry_date]
    if cred['i_inst_name'] == 'BX':
        b = a[a["name"] == "BANKEX"]
        instrument_tokens_list = np.int64(b['instrument_token'])
        instrument_tokens = instrument_tokens_list.tolist()
        return instrument_tokens
    if cred['i_inst_name'] == 'FN':
        b = a[a["name"] == "FINNIFTY"]
        instrument_tokens_list = np.int64(b['instrument_token'])
        instrument_tokens = instrument_tokens_list.tolist()
        return instrument_tokens
    if cred['i_inst_name'] == 'BN':
        b = a[a["name"] == "BANKNIFTY"]
        instrument_tokens_list = np.int64(b['instrument_token'])
        instrument_tokens = instrument_tokens_list.tolist()
        return instrument_tokens
    if cred['i_inst_name'] == 'N':
        b = a[a["name"] == "NIFTY"]
        instrument_tokens_list = np.int64(b['instrument_token'])
        instrument_tokens = instrument_tokens_list.tolist()
        return instrument_tokens
    if cred['i_inst_name'] == 'S':
        b = a[a["name"] == "SENSEX"]
        instrument_tokens_list = np.int64(b['instrument_token'])
        instrument_tokens = instrument_tokens_list.tolist()
        return instrument_tokens
    if cred['i_inst_name'] == 'C':
        print("fetch inst tokens for crude oil")
        b = a[a["name"] == "CRUDEOIL"]
        c = b[b["exchange"] == "MCX"]
        instrument_tokens_list = np.int64(c['instrument_token'])
        instrument_tokens = instrument_tokens_list.tolist()
        return instrument_tokens

def get_instrument_tokens_pe_sensex():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print(Fore.WHITE + "bank nifty data available")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df2 = nfo_data[nfo_data['instrument_type'] == 'PE']
    if len(df2) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df2['instrument_token'].tolist()
        return instrument_tokens
    return None

def get_instrument_tokens_pe_crude_oil():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print(Fore.WHITE + "bank nifty data available")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df2 = nfo_data[nfo_data['instrument_type'] == 'PE']
    if len(df2) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df2['instrument_token'].tolist()
        return instrument_tokens
    return None


def get_instrument_tokens_pe_nifty():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print(Fore.WHITE + "bank nifty data available")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df2 = nfo_data[nfo_data['instrument_type'] == 'PE']
    if len(df2) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df2['instrument_token'].tolist()
        return instrument_tokens
    return None

def get_instrument_tokens_pe_banknifty(inst_token_pe=None):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print(Fore.WHITE + "bank nifty data available")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df2 = nfo_data[nfo_data['instrument_type'] == 'PE']
    if len(df2) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df2['instrument_token'].tolist()
        return instrument_tokens
    return None

def get_instrument_tokens_ce_sensex():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['instrument_type'] == 'CE']
    df1.loc[:, 'expiry'] = pd.to_datetime(df1['expiry'].astype(str).str.strip(), errors='coerce')

    current_date = pd.to_datetime(datetime.now().date())

    # Find the nearest expiry date using sort_values
    nearest_expiry = df1[df1['expiry'] >= current_date]

    if len(df1) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df1['instrument_token'].tolist()
        return instrument_tokens
    return None


def get_instrument_tokens_ce_nifty():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_type'] == 'CE']
    df1.loc[:, 'expiry'] = pd.to_datetime(df1['expiry'].astype(str).str.strip(), errors='coerce')

    current_date = pd.to_datetime(datetime.now().date())

    # Find the nearest expiry date using sort_values
    nearest_expiry = df1[df1['expiry'] >= current_date]

    if len(df1) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df1['instrument_token'].tolist()
        return instrument_tokens
    return None
def get_instrument_tokens_ce_banknifty(inst_token_ce=None):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['instrument_type'] == 'CE']
    df1.loc[:, 'expiry'] = pd.to_datetime(df1['expiry'].astype(str).str.strip(), errors='coerce')

    current_date = pd.to_datetime(datetime.now().date())

    # Find the nearest expiry date using sort_values
    nearest_expiry = df1[df1['expiry'] >= current_date]

    if len(df1) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df1['instrument_token'].tolist()
        return instrument_tokens
    return None
def get_instrument_tokens_ce_sensex():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['instrument_type'] == 'CE']
    df1.loc[:, 'expiry'] = pd.to_datetime(df1['expiry'].astype(str).str.strip(), errors='coerce')

    current_date = pd.to_datetime(datetime.now().date())

    # Find the nearest expiry date using sort_values
    nearest_expiry = df1[df1['expiry'] >= current_date]

    if len(df1) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df1['instrument_token'].tolist()
        return instrument_tokens
    return None

def get_instrument_tokens_ce_crude_oil():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df1 = nfo_data[nfo_data['instrument_type'] == 'CE']
    df1.loc[:, 'expiry'] = pd.to_datetime(df1['expiry'].astype(str).str.strip(), errors='coerce')

    current_date = pd.to_datetime(datetime.now().date())

    # Find the nearest expiry date using sort_values
    nearest_expiry = df1[df1['expiry'] >= current_date]

    if len(df1) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df1['instrument_token'].tolist()
        return instrument_tokens
    return None




def get_option_chain_ce_nifty():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_type'] == 'CE']
    df1.loc[:, 'expiry'] = pd.to_datetime(df1['expiry'].astype(str).str.strip(), errors='coerce')
    current_date = pd.to_datetime(datetime.now().date())
    # Find the nearest expiry date using sort_values
    nearest_expiry = df1[df1['expiry'] >= current_date]

    return None
def build_nifty_ce_chain_50_strike_with_ltp():
    # --- Step 1: Load NFO data ---
    # nfo_data = get_nfo_file_data_nifty("NIFTY")
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df_ce = nfo_data[nfo_data['instrument_type'] == 'CE']

    # --- Step 2: Filter CE instruments ---
    # df_ce = nfo_data[nfo_data["instrument_type"] == "CE"].copy()
    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")

    # --- Step 3: Select nearest expiry ---
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()
    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    # --- Step 4: Fetch NIFTY Spot Price (token = 256265) ---
    spot_data = kite.ltp(256265)
    nifty_spot = spot_data["256265"]["last_price"]
    print(f"Current NIFTY Spot: {nifty_spot:.2f}")

    # --- Step 5: Calculate ATM strike (nearest multiple of 50) ---
    atm_strike = round(nifty_spot / 50) * 50
    print(f"Detected ATM Strike: {atm_strike}")

    # --- Step 6: Define ±4 strikes range ---
    strike_min = atm_strike - (6 * 50)
    strike_max = atm_strike + (6 * 50)

    df_ce = df_ce[(df_ce["strike"] >= strike_min) & (df_ce["strike"] <= strike_max)]

    # --- Step 7: Fetch LTPs for selected CE tokens ---
    ce_tokens = df_ce["instrument_token"].tolist()
    quote_details_ce = kite.ltp(ce_tokens)
    df_ltp = pd.DataFrame(quote_details_ce).T.reset_index(drop=True)

    # --- Step 8: Merge LTP into df_ce ---
    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left"
    )

    # --- Step 9: Sort by strike ---
    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    # --- Step 10: Print the option chain (CE only) ---
    print("\n=== NIFTY CE Option Chain (ATM ±4 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce
def build_banknifty_ce_chain_100_strike_with_ltp():
    # --- Step 1: Load NFO data ---
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])

    df_ce = nfo_data[nfo_data['instrument_type'] == 'CE'].copy()

    # --- Step 2: Parse expiry ---
    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")

    # --- Step 3: Select nearest expiry ---
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()
    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    # --- Step 4: Fetch BANKNIFTY Spot Price ---
    # Replace 260105 if your BANKNIFTY spot/index token is different
    spot_data = kite.ltp(260105)
    banknifty_spot = spot_data["260105"]["last_price"]
    print(f"Current BANKNIFTY Spot: {banknifty_spot:.2f}")

    # --- Step 5: Calculate ATM strike (nearest multiple of 100) ---
    atm_strike = round(banknifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    # --- Step 6: Define strike range ---
    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_ce = df_ce[
        (df_ce["strike"] >= strike_min)
        & (df_ce["strike"] <= strike_max)
        & (df_ce["strike"] % 100 == 0)
    ].copy()

    # --- Step 7: Fetch LTPs for selected CE tokens ---
    ce_tokens = df_ce["instrument_token"].tolist()
    quote_details_ce = kite.ltp(ce_tokens)
    df_ltp = pd.DataFrame(quote_details_ce).T.reset_index(drop=True)

    # --- Step 8: Merge LTP into df_ce ---
    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left"
    )

    # --- Step 9: Sort by strike ---
    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    # --- Step 10: Print the option chain (CE only) ---
    print("\n=== BANKNIFTY CE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce

def build_sensex_ce_chain_100_strike_with_ltp():
    # --- Step 1: Load NFO/BFO data ---
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])

    df_ce = nfo_data[nfo_data['instrument_type'] == 'CE'].copy()

    # --- Step 2: Parse expiry ---
    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")

    # --- Step 3: Select nearest expiry ---
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()
    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    # --- Step 4: Fetch SENSEX Spot Price ---
    # Replace this token with your actual SENSEX spot/index token
    spot_data = kite.ltp(265)
    sensex_spot = spot_data["265"]["last_price"]
    print(f"Current SENSEX Spot: {sensex_spot:.2f}")

    # --- Step 5: Calculate ATM strike (nearest multiple of 100) ---
    atm_strike = round(sensex_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    # --- Step 6: Define strike range ---
    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_ce = df_ce[
        (df_ce["strike"] >= strike_min)
        & (df_ce["strike"] <= strike_max)
        & (df_ce["strike"] % 100 == 0)
    ].copy()

    # --- Step 7: Fetch LTPs for selected CE tokens ---
    ce_tokens = df_ce["instrument_token"].tolist()
    quote_details_ce = kite.ltp(ce_tokens)
    df_ltp = pd.DataFrame(quote_details_ce).T.reset_index(drop=True)

    # --- Step 8: Merge LTP into df_ce ---
    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left"
    )

    # --- Step 9: Sort by strike ---
    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    # --- Step 10: Print CE option chain ---
    print("\n=== SENSEX CE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce

def build_nifty_ce_chain_100_strike_with_ltp():
    # --- Step 1: Load NFO data ---
    # nfo_data = get_nfo_file_data_nifty("NIFTY")
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df_ce = nfo_data[nfo_data['instrument_type'] == 'CE']

    # --- Step 2: Filter CE instruments ---
    # df_ce = nfo_data[nfo_data["instrument_type"] == "CE"].copy()
    df_ce["expiry"] = pd.to_datetime(df_ce["expiry"], errors="coerce")

    # --- Step 3: Select nearest expiry ---
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_ce[df_ce["expiry"] >= current_date]["expiry"].min()
    df_ce = df_ce[df_ce["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | CE contracts: {len(df_ce)}")

    # --- Step 4: Fetch NIFTY Spot Price (token = 256265) ---
    spot_data = kite.ltp(256265)
    nifty_spot = spot_data["256265"]["last_price"]
    print(f"Current NIFTY Spot: {nifty_spot:.2f}")

    # --- Step 5: Calculate ATM strike (nearest multiple of 100) ---
    atm_strike = round(nifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    # --- Step 6: Define ±6 strikes range (still using 100-gap logic) ---
    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")
    df_ce = df_ce[
        (df_ce["strike"] >= strike_min)
        & (df_ce["strike"] <= strike_max)
        & (df_ce["strike"] % 100 == 0)  # ✅ only strikes divisible by 100
        ]

    df_ce = df_ce[(df_ce["strike"] >= strike_min) & (df_ce["strike"] <= strike_max)]

    # --- Step 7: Fetch LTPs for selected CE tokens ---
    ce_tokens = df_ce["instrument_token"].tolist()
    quote_details_ce = kite.ltp(ce_tokens)
    df_ltp = pd.DataFrame(quote_details_ce).T.reset_index(drop=True)

    # --- Step 8: Merge LTP into df_ce ---
    df_ce = df_ce.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left"
    )

    # --- Step 9: Sort by strike ---
    df_ce = df_ce.sort_values("strike").reset_index(drop=True)

    # --- Step 10: Print the option chain (CE only) ---
    print("\n=== NIFTY CE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_ce[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_ce

def build_nifty_pe_chain_100_strike_with_ltp():
    # --- Step 1: Load NFO data ---
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])

    df_pe = nfo_data[nfo_data['instrument_type'] == 'PE'].copy()

    # --- Step 2: Parse expiry ---
    df_pe["expiry"] = pd.to_datetime(df_pe["expiry"], errors="coerce")

    # --- Step 3: Select nearest expiry ---
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_pe[df_pe["expiry"] >= current_date]["expiry"].min()
    df_pe = df_pe[df_pe["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | PE contracts: {len(df_pe)}")

    # --- Step 4: Fetch NIFTY Spot Price (token = 256265) ---
    spot_data = kite.ltp(256265)
    nifty_spot = spot_data["256265"]["last_price"]
    print(f"Current NIFTY Spot: {nifty_spot:.2f}")

    # --- Step 5: Calculate ATM strike (nearest multiple of 100) ---
    atm_strike = round(nifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    # --- Step 6: Define strike range ---
    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_pe = df_pe[
        (df_pe["strike"] >= strike_min)
        & (df_pe["strike"] <= strike_max)
        & (df_pe["strike"] % 100 == 0)
    ]

    # --- Step 7: Fetch LTPs for selected PE tokens ---
    pe_tokens = df_pe["instrument_token"].tolist()
    quote_details_pe = kite.ltp(pe_tokens)
    df_ltp = pd.DataFrame(quote_details_pe).T.reset_index(drop=True)

    # --- Step 8: Merge LTP into df_pe ---
    df_pe = df_pe.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left"
    )

    # --- Step 9: Sort by strike ---
    df_pe = df_pe.sort_values("strike").reset_index(drop=True)

    # --- Step 10: Print PE option chain ---
    print("\n=== NIFTY PE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_pe[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_pe


def build_banknifty_pe_chain_100_strike_with_ltp():
    # --- Step 1: Load NFO data ---
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])

    df_pe = nfo_data[nfo_data['instrument_type'] == 'PE'].copy()

    # --- Step 2: Parse expiry ---
    df_pe["expiry"] = pd.to_datetime(df_pe["expiry"], errors="coerce")

    # --- Step 3: Select nearest expiry ---
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_pe[df_pe["expiry"] >= current_date]["expiry"].min()
    df_pe = df_pe[df_pe["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | PE contracts: {len(df_pe)}")

    # --- Step 4: Fetch BANKNIFTY Spot Price ---
    # Replace 260105 if your BANKNIFTY spot/index token is different
    spot_data = kite.ltp(260105)
    banknifty_spot = spot_data["260105"]["last_price"]
    print(f"Current BANKNIFTY Spot: {banknifty_spot:.2f}")

    # --- Step 5: Calculate ATM strike (nearest multiple of 100) ---
    atm_strike = round(banknifty_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    # --- Step 6: Define strike range ---
    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_pe = df_pe[
        (df_pe["strike"] >= strike_min)
        & (df_pe["strike"] <= strike_max)
        & (df_pe["strike"] % 100 == 0)
    ].copy()

    # --- Step 7: Fetch LTPs for selected PE tokens ---
    pe_tokens = df_pe["instrument_token"].tolist()
    quote_details_pe = kite.ltp(pe_tokens)
    df_ltp = pd.DataFrame(quote_details_pe).T.reset_index(drop=True)

    # --- Step 8: Merge LTP into df_pe ---
    df_pe = df_pe.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left"
    )

    # --- Step 9: Sort by strike ---
    df_pe = df_pe.sort_values("strike").reset_index(drop=True)

    # --- Step 10: Print the option chain (PE only) ---
    print("\n=== BANKNIFTY PE Option Chain (ATM ±6 Strikes) ===")
    print(
        df_pe[["instrument_token", "tradingsymbol", "strike", "expiry", "last_price_y"]]
        .to_string(index=False)
    )

    return df_pe

def build_sensex_pe_chain_100_strike_with_ltp():
    # --- Step 1: Load NFO/BFO data ---
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])

    df_pe = nfo_data[nfo_data['instrument_type'] == 'PE'].copy()

    # --- Step 2: Parse expiry ---
    df_pe["expiry"] = pd.to_datetime(df_pe["expiry"], errors="coerce")

    # --- Step 3: Select nearest expiry ---
    current_date = pd.Timestamp.today().normalize()
    nearest_expiry = df_pe[df_pe["expiry"] >= current_date]["expiry"].min()
    df_pe = df_pe[df_pe["expiry"] == nearest_expiry].reset_index(drop=True)

    print(f"\nNearest expiry: {nearest_expiry.date()} | PE contracts: {len(df_pe)}")

    # --- Step 4: Fetch SENSEX Spot Price ---
    # Replace this token with your actual SENSEX spot/index token
    spot_data = kite.ltp(265)
    sensex_spot = spot_data["265"]["last_price"]
    print(f"Current SENSEX Spot: {sensex_spot:.2f}")

    # --- Step 5: Calculate ATM strike (nearest multiple of 100) ---
    atm_strike = round(sensex_spot / 100) * 100
    print(f"Detected ATM Strike: {atm_strike}")

    # --- Step 6: Define strike range ---
    strike_min = atm_strike - (4 * 100)
    strike_max = atm_strike + (6 * 100)
    print(f"Strike Range: {strike_min} to {strike_max}")

    df_pe = df_pe[
        (df_pe["strike"] >= strike_min)
        & (df_pe["strike"] <= strike_max)
        & (df_pe["strike"] % 100 == 0)
    ].copy()

    # --- Step 7: Fetch LTPs for selected PE tokens ---
    pe_tokens = df_pe["instrument_token"].tolist()
    quote_details_pe = kite.ltp(pe_tokens)
    df_ltp = pd.DataFrame(quote_details_pe).T.reset_index(drop=True)

    # --- Step 8: Merge LTP into df_pe ---
    df_pe = df_pe.merge(
        df_ltp[["instrument_token", "last_price"]],
        on="instrument_token",
        how="left"
    )

    # --- Step 9: Sort by strike ---
    df_pe = df_pe.sort_values("strike").reset_index(drop=True)

    # --- Step 10: Print PE option chain ---
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
    """
    Build Bull Call Spreads for specified strike gaps and rank by closeness to rr_target.

    Parameters
    ----------
    df : DataFrame
        Must contain columns: ['strike', 'last_price_y', 'lot_size'].
    gaps : iterable of int
        Strike gaps to evaluate (e.g., 150, 200).
    rr_target : float
        Target risk-reward to rank against.
    atm_only : bool
        If True, only consider buy_strike = nearest-to-spot (requires `spot`).
    spot : float or None
        Underlying spot; required if atm_only=True.

    Returns
    -------
    DataFrame
        One row per (buy, sell) pair with payoff metrics and ranking by rr distance.
    """
    required = {'strike', 'last_price_y', 'lot_size'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (df
         .rename(columns={'last_price_y': 'ltp'})
         .loc[:, ['strike', 'ltp', 'lot_size']]
         .dropna())
    d['strike'] = d['strike'].astype(float)
    d['ltp'] = d['ltp'].astype(float)
    d = d.sort_values('strike').reset_index(drop=True)

    # Build fast lookup
    ltp_map = d.set_index('strike')['ltp'].to_dict()
    # Assume constant lot size across strikes; if not, you can extend to per-leg lots
    lot_size = int(d['lot_size'].iloc[0])

    # Candidate buy strikes
    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d['strike'] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, 'strike'])]
    else:
        buy_candidates = d['strike'].tolist()

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
            net_debit = buy_ltp - sell_ltp  # max loss
            if net_debit <= 0:
                continue  # skip invalid (credit or zero-cost) cases for bull call

            max_profit = width - net_debit
            if max_profit < 0:
                continue  # economically dominated

            rr = max_profit / net_debit
            rows.append({
                'buy_strike': b,
                'buy_ltp': round(buy_ltp, 2),
                'sell_strike': s,
                'sell_ltp': round(sell_ltp, 2),
                'gap': int(width),
                'net_debit': round(net_debit, 2),
                'max_profit': round(max_profit, 2),
                'rr': round(rr, 3),
                'breakeven': round(b + net_debit, 2),
                'per_lot_debit': round(net_debit * lot_size, 2),
                'per_lot_max_profit': round(max_profit * lot_size, 2),
                'lot_size': lot_size,
            })

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out['rr_distance'] = (out['rr'] - rr_target).abs()
    out = out.sort_values(['rr_distance', 'rr'], ascending=[True, False]).reset_index(drop=True)
    return out

def bull_call_spreads_banknifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    """
    Build BANKNIFTY Bull Call Spreads for specified strike gaps and rank by closeness to rr_target.

    Bull Call:
      - Buy lower strike CE
      - Sell higher strike CE
    """
    required = {'strike', 'last_price_y', 'lot_size'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (
        df.rename(columns={'last_price_y': 'ltp'})
          .loc[:, ['strike', 'ltp', 'lot_size']]
          .dropna()
          .copy()
    )

    d['strike'] = d['strike'].astype(float)
    d['ltp'] = d['ltp'].astype(float)
    d = d.sort_values('strike').reset_index(drop=True)

    ltp_map = d.set_index('strike')['ltp'].to_dict()
    lot_size = int(d['lot_size'].iloc[0])

    # Candidate buy strikes
    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d['strike'] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, 'strike'])]
    else:
        buy_candidates = d['strike'].tolist()

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
            net_debit = buy_ltp - sell_ltp  # max loss

            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit

            rows.append({
                'buy_strike': buy_strike,
                'buy_ltp': round(buy_ltp, 2),
                'sell_strike': sell_strike,
                'sell_ltp': round(sell_ltp, 2),
                'gap': int(width),
                'net_debit': round(net_debit, 2),
                'max_profit': round(max_profit, 2),
                'rr': round(rr, 3),
                'breakeven': round(buy_strike + net_debit, 2),
                'per_lot_debit': round(net_debit * lot_size, 2),
                'per_lot_max_profit': round(max_profit * lot_size, 2),
                'lot_size': lot_size,
            })

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out['rr_distance'] = (out['rr'] - rr_target).abs()
    out = out.sort_values(['rr_distance', 'rr'], ascending=[True, False]).reset_index(drop=True)
    return out

def bull_call_spreads_sensex(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    """
    Build SENSEX Bull Call Spreads for specified strike gaps and rank by closeness to rr_target.

    Bull Call:
      - Buy lower strike CE
      - Sell higher strike CE
    """
    required = {'strike', 'last_price_y', 'lot_size'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (
        df.rename(columns={'last_price_y': 'ltp'})
          .loc[:, ['strike', 'ltp', 'lot_size']]
          .dropna()
          .copy()
    )

    d['strike'] = d['strike'].astype(float)
    d['ltp'] = d['ltp'].astype(float)
    d = d.sort_values('strike').reset_index(drop=True)

    ltp_map = d.set_index('strike')['ltp'].to_dict()
    lot_size = int(d['lot_size'].iloc[0])

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d['strike'] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, 'strike'])]
    else:
        buy_candidates = d['strike'].tolist()

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

            rows.append({
                'buy_strike': buy_strike,
                'buy_ltp': round(buy_ltp, 2),
                'sell_strike': sell_strike,
                'sell_ltp': round(sell_ltp, 2),
                'gap': int(width),
                'net_debit': round(net_debit, 2),
                'max_profit': round(max_profit, 2),
                'rr': round(rr, 3),
                'breakeven': round(buy_strike + net_debit, 2),
                'per_lot_debit': round(net_debit * lot_size, 2),
                'per_lot_max_profit': round(max_profit * lot_size, 2),
                'lot_size': lot_size,
            })

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out['rr_distance'] = (out['rr'] - rr_target).abs()
    out = out.sort_values(['rr_distance', 'rr'], ascending=[True, False]).reset_index(drop=True)
    return out

def bear_put_spreads_nifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (150, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    """
    Build NIFTY Bear Put Spreads for specified strike gaps and rank by closeness to rr_target.

    Bear Put:
      - Buy higher strike PE
      - Sell lower strike PE

    Parameters
    ----------
    df : DataFrame
        Must contain columns: ['strike', 'last_price_y', 'lot_size'].
    gaps : iterable of int
        Strike gaps to evaluate (e.g., 150, 200).
    rr_target : float
        Target risk-reward to rank against.
    atm_only : bool
        If True, only consider buy_strike = nearest-to-spot (requires `spot`).
    spot : float or None
        Underlying spot; required if atm_only=True.

    Returns
    -------
    DataFrame
        One row per (buy, sell) pair with payoff metrics and ranking by rr distance.
    """
    required = {'strike', 'last_price_y', 'lot_size'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (
        df.rename(columns={'last_price_y': 'ltp'})
          .loc[:, ['strike', 'ltp', 'lot_size']]
          .dropna()
          .copy()
    )

    d['strike'] = d['strike'].astype(float)
    d['ltp'] = d['ltp'].astype(float)
    d = d.sort_values('strike').reset_index(drop=True)

    ltp_map = d.set_index('strike')['ltp'].to_dict()
    lot_size = int(d['lot_size'].iloc[0])

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d['strike'] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, 'strike'])]
    else:
        buy_candidates = d['strike'].tolist()

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
            net_debit = buy_ltp - sell_ltp   # max loss

            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit

            rows.append({
                'buy_strike': buy_strike,
                'buy_ltp': round(buy_ltp, 2),
                'sell_strike': sell_strike,
                'sell_ltp': round(sell_ltp, 2),
                'gap': int(width),
                'net_debit': round(net_debit, 2),
                'max_profit': round(max_profit, 2),
                'rr': round(rr, 3),
                'breakeven': round(buy_strike - net_debit, 2),
                'per_lot_debit': round(net_debit * lot_size, 2),
                'per_lot_max_profit': round(max_profit * lot_size, 2),
                'lot_size': lot_size,
            })

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out['rr_distance'] = (out['rr'] - rr_target).abs()
    out = out.sort_values(['rr_distance', 'rr'], ascending=[True, False]).reset_index(drop=True)
    return out

def bear_put_spreads_banknifty(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    """
    Build BANKNIFTY Bear Put Spreads for specified strike gaps and rank by closeness to rr_target.

    Bear Put:
      - Buy higher strike PE
      - Sell lower strike PE
    """
    required = {'strike', 'last_price_y', 'lot_size'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (
        df.rename(columns={'last_price_y': 'ltp'})
          .loc[:, ['strike', 'ltp', 'lot_size']]
          .dropna()
          .copy()
    )

    d['strike'] = d['strike'].astype(float)
    d['ltp'] = d['ltp'].astype(float)
    d = d.sort_values('strike').reset_index(drop=True)

    ltp_map = d.set_index('strike')['ltp'].to_dict()
    lot_size = int(d['lot_size'].iloc[0])

    # Candidate buy strikes
    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d['strike'] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, 'strike'])]
    else:
        buy_candidates = d['strike'].tolist()

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
            net_debit = buy_ltp - sell_ltp  # max loss

            if net_debit <= 0:
                continue

            max_profit = width - net_debit
            if max_profit < 0:
                continue

            rr = max_profit / net_debit

            rows.append({
                'buy_strike': buy_strike,
                'buy_ltp': round(buy_ltp, 2),
                'sell_strike': sell_strike,
                'sell_ltp': round(sell_ltp, 2),
                'gap': int(width),
                'net_debit': round(net_debit, 2),
                'max_profit': round(max_profit, 2),
                'rr': round(rr, 3),
                'breakeven': round(buy_strike - net_debit, 2),
                'per_lot_debit': round(net_debit * lot_size, 2),
                'per_lot_max_profit': round(max_profit * lot_size, 2),
                'lot_size': lot_size,
            })

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out['rr_distance'] = (out['rr'] - rr_target).abs()
    out = out.sort_values(['rr_distance', 'rr'], ascending=[True, False]).reset_index(drop=True)
    return out

def bear_put_spreads_sensex(
    df: pd.DataFrame,
    gaps: Iterable[int] = (100, 200),
    rr_target: float = 1.7,
    atm_only: bool = False,
    spot: Optional[float] = None,
) -> pd.DataFrame:
    """
    Build SENSEX Bear Put Spreads for specified strike gaps and rank by closeness to rr_target.

    Bear Put:
      - Buy higher strike PE
      - Sell lower strike PE
    """
    required = {'strike', 'last_price_y', 'lot_size'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = (
        df.rename(columns={'last_price_y': 'ltp'})
          .loc[:, ['strike', 'ltp', 'lot_size']]
          .dropna()
          .copy()
    )

    d['strike'] = d['strike'].astype(float)
    d['ltp'] = d['ltp'].astype(float)
    d = d.sort_values('strike').reset_index(drop=True)

    ltp_map = d.set_index('strike')['ltp'].to_dict()
    lot_size = int(d['lot_size'].iloc[0])

    if atm_only:
        if spot is None:
            raise ValueError("Provide `spot` when atm_only=True.")
        atm_idx = (d['strike'] - float(spot)).abs().argmin()
        buy_candidates = [float(d.loc[atm_idx, 'strike'])]
    else:
        buy_candidates = d['strike'].tolist()

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

            rows.append({
                'buy_strike': buy_strike,
                'buy_ltp': round(buy_ltp, 2),
                'sell_strike': sell_strike,
                'sell_ltp': round(sell_ltp, 2),
                'gap': int(width),
                'net_debit': round(net_debit, 2),
                'max_profit': round(max_profit, 2),
                'rr': round(rr, 3),
                'breakeven': round(buy_strike - net_debit, 2),
                'per_lot_debit': round(net_debit * lot_size, 2),
                'per_lot_max_profit': round(max_profit * lot_size, 2),
                'lot_size': lot_size,
            })

    out = pd.DataFrame(rows)
    if out.empty:
        return out

    out['rr_distance'] = (out['rr'] - rr_target).abs()
    out = out.sort_values(['rr_distance', 'rr'], ascending=[True, False]).reset_index(drop=True)
    return out

# ===== Example usage with your DataFrame =====
# df_ce is your DataFrame
# Option A: Evaluate *all* possible buy strikes:


# Option B: Force “buy ATM only” (requires spot). Example assumes ~25300:
# results_atm = bull_call_spreads(df_ce, gaps=(150, 200), rr_target=1.5, atm_only=True, spot=25300.0)

# Inspect the top candidates

def get_instrument_tokens_ce_nifty():
    if nfo_data is not None and len(nfo_data) > 0:
        pass
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_type'] == 'CE']
    df1.loc[:, 'expiry'] = pd.to_datetime(df1['expiry'].astype(str).str.strip(), errors='coerce')

    current_date = pd.to_datetime(datetime.now().date())

    # Find the nearest expiry date using sort_values
    nearest_expiry = df1[df1['expiry'] >= current_date]

    if len(df1) > 0:
        # print("type of inst token : ", type(np.int64(df2.iloc[-1]['instrument_token']).item()))
        instrument_tokens = df1['instrument_token'].tolist()
        return instrument_tokens
    return None


def get_strike_for_inst_token_ce_banknifty(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]['strike']).item()
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return np.int64(df1.iloc[-1]['strike']).item()
    return None

def get_strike_for_inst_token_ce_crude_oil(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        strike = np.int64(df1.iloc[-1]['strike']).item()
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return np.int64(df1.iloc[-1]['strike']).item()
    return None

def get_strike_for_inst_token_pe_sensex(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available")
    else:
        print("else")
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    # print(df1)
    if len(df1) == 1:
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        strike = np.int64(df1.iloc[-1]['strike']).item()
        return np.int64(df1.iloc[-1]['strike']).item()
    return None


def get_strike_for_inst_token_pe_nifty(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available")
    else:
        print("else")
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    # print(df1)
    if len(df1) == 1:
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        strike = np.int64(df1.iloc[-1]['strike']).item()
        return np.int64(df1.iloc[-1]['strike']).item()
    return None


def get_strike_for_inst_token_pe_banknifty(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available")
    else:
        print("else")
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    # print(df1)
    if len(df1) == 1:
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        strike = np.int64(df1.iloc[-1]['strike']).item()
        return np.int64(df1.iloc[-1]['strike']).item()
    return None


def get_strike_for_inst_token_pe_crude_oil(inst_token):
    global strike
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available")
    else:
        print("else")
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
        print("inst_token : ", inst_token)
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    # print(df1)
    if len(df1) == 1:
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        strike = np.int64(df1.iloc[-1]['strike']).item()
        return np.int64(df1.iloc[-1]['strike']).item()
    return None

def get_trading_symbol_ce_crude_oil(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'CE']
    if len(df2) == 1:
        # print("trading symbol ce : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None

def get_trading_symbol_ce_sensex(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'CE']
    if len(df2) == 1:
        # print("trading symbol ce : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None

def get_trading_symbol_ce_nifty(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'CE']
    if len(df2) == 1:
        # print("trading symbol ce : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None

def get_trading_symbol_ce_banknifty(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'CE']
    if len(df2) == 1:
        # print("trading symbol ce : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None

def get_trading_symbol_pe_sensex(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'PE']
    if len(df2) == 1:
        # print("trading symbol pe : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None



def get_trading_symbol_pe_nifty(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'PE']
    if len(df2) == 1:
        # print("trading symbol pe : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None

def get_trading_symbol_pe_banknifty(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'PE']
    if len(df2) == 1:
        # print("trading symbol pe : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None

def get_trading_symbol_pe_crude_oil(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    df2 = df1[df1['instrument_type'] == 'PE']
    if len(df2) == 1:
        # print("trading symbol pe : ", df2.iloc[-1]['tradingsymbol'])
        return df2.iloc[-1]['tradingsymbol']
    return None


def get_trading_symbol_for_inst_token_sensex(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    if len(df1) == 1:
        return df1.iloc[-1]['tradingsymbol']
    return None


def get_trading_symbol_for_inst_token_nifty(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    if len(df1) == 1:
        return df1.iloc[-1]['tradingsymbol']
    return None

def get_trading_symbol_for_inst_token_banknifty(instrument_token):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == instrument_token]
    if len(df1) == 1:
        return df1.iloc[-1]['tradingsymbol']
    return None


def get_inst_token_for_trading_symbol_sensex(tradingsymbol):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['tradingsymbol'] == tradingsymbol]
    df2 = df1[df1['exchange'] == cred['i_exchange_code']]
    # print("tradingsymbol : ", tradingsymbol, df2)
    if len(df2) == 1:
        # print("df2.iloc[-1]['instrument_token'] : ", df2.iloc[-1]['instrument_token'])
        return df2.iloc[-1]['instrument_token']
    return None

def get_inst_token_for_trading_symbol_nifty(tradingsymbol):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['tradingsymbol'] == tradingsymbol]
    df2 = df1[df1['exchange'] == cred['i_exchange_code']]
    # print("tradingsymbol : ", tradingsymbol, df2)
    if len(df2) == 1:
        # print("df2.iloc[-1]['instrument_token'] : ", df2.iloc[-1]['instrument_token'])
        return df2.iloc[-1]['instrument_token']
    return None


def get_inst_token_for_trading_symbol_crude_oil(tradingsymbol):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df1 = nfo_data[nfo_data['tradingsymbol'] == tradingsymbol]
    df2 = df1[df1['exchange'] == cred['i_exchange_code']]
    # print("tradingsymbol : ", tradingsymbol, df2)
    if len(df2) == 1:
        # print("df2.iloc[-1]['instrument_token'] : ", df2.iloc[-1]['instrument_token'])
        return df2.iloc[-1]['instrument_token']
    return None

def get_inst_token_for_trading_symbol_banknifty(tradingsymbol):
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)
    get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['tradingsymbol'] == tradingsymbol]
    df2 = df1[df1['exchange'] == cred['i_exchange_code']]
    # print("tradingsymbol : ", tradingsymbol, df2)
    if len(df2) == 1:
        # print("df2.iloc[-1]['instrument_token'] : ", df2.iloc[-1]['instrument_token'])
        return df2.iloc[-1]['instrument_token']
    return None

def get_strike_for_inst_token_sensex(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("SENSEX nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        strike_for_inst_token = np.int64(df1.iloc[-1]['strike']).item()
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return strike_for_inst_token
    return None


def get_strike_for_inst_token_nifty(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        strike_for_inst_token = np.int64(df1.iloc[-1]['strike']).item()
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return strike_for_inst_token
    return None

def get_strike_for_inst_token_banknifty(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        strike_for_inst_token = np.int64(df1.iloc[-1]['strike']).item()
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return strike_for_inst_token
    return None


def get_strike_for_inst_token_crude_oil(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        strike_for_inst_token = np.int64(df1.iloc[-1]['strike']).item()
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return strike_for_inst_token
    return None

def get_inst_type_for_inst_token_sensex(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_sensex(cred['i_inst_name_sensex'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        instrument_type = df1.iloc[-1]['instrument_type']
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return instrument_type
    return None


def get_inst_type_for_inst_token_nifty(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_nifty(cred['i_inst_name_nifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        instrument_type = df1.iloc[-1]['instrument_type']
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return instrument_type
    return None


def get_inst_type_for_inst_token_banknifty(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_banknifty(cred['i_inst_name_banknifty'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        instrument_type = df1.iloc[-1]['instrument_type']
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return instrument_type
    return None
def get_inst_type_for_inst_token_crude_oil(inst_token):
    if nfo_data is not None and len(nfo_data) > 0:
        pass
        # print("bank nifty data available for ce")
    else:
        with open('cred.yml') as f:
            cred = yaml.load(f, Loader=yaml.FullLoader)
        get_nfo_file_data_crude_oil(cred['i_inst_name_crude_oil'])
    df1 = nfo_data[nfo_data['instrument_token'] == inst_token]
    if len(df1) == 1:
        instrument_type = df1.iloc[-1]['instrument_type']
        # print("strike : ", np.int64(df1.iloc[-1]['strike']).item())
        return instrument_type
    return None

def get_instrument_details_nifty():


    i_inst_name = "N"
    i_stock_code = "NIFTY"
    i_exchange_code = "NFO"

    # Find nearest upcoming Tuesday
    today = datetime.now().date()
    days_ahead = (1 - today.weekday()) % 7  # Tuesday is weekday 1
    if days_ahead == 0:
        expiry = today  # If today is Tuesday
    else:
        expiry = today + timedelta(days=days_ahead)

    i_expiry_date_nifty = expiry

    print('Expiry Date Util:', i_expiry_date_nifty, i_inst_name, i_stock_code, i_exchange_code)
    return i_inst_name, i_stock_code, i_exchange_code, i_expiry_date_nifty




from datetime import datetime, timedelta

def get_instrument_details_crude_oil():
    """
    Returns instrument details for MCX Crude Oil
    with expiry set to the last Monday of the current month.
    """

    i_inst_name = "C"
    i_stock_code = "CRUDEOIL"
    i_exchange_code = "MCX"

    # Step 1: Today's date
    today = datetime.now()

    # Step 2: Find last day of the current month
    if today.month == 12:
        last_day = today.replace(day=31)
    else:
        last_day = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

    # Step 3: Move backwards to last Monday (Monday = 0)
    days_back = (last_day.weekday() - 0) % 7
    i_expiry_date_crude_oil = (last_day - timedelta(days=days_back)).date()

    print(
        "Expiry Date Util:",
        i_expiry_date_crude_oil,
        i_inst_name,
        i_stock_code,
        i_exchange_code
    )

    return (
        i_inst_name,
        i_stock_code,
        i_exchange_code,
        i_expiry_date_crude_oil
    )

def get_instrument_details_sensex():
    i_inst_name = "S"
    i_stock_code = "SENSEX"
    i_exchange_code = "BFO"
    # Find nearest upcoming Thursday
    today = datetime.now().date()
    days_ahead = (3 - today.weekday()) % 7  # Thursday is weekday 3
    if days_ahead == 0:
        expiry = today  # If today is Thursday
    else:
        expiry = today + timedelta(days=days_ahead)

    i_expiry_date_sensex = expiry

    print('Expiry Date Util:', i_expiry_date_sensex, i_inst_name, i_stock_code, i_exchange_code)
    return i_inst_name, i_stock_code, i_exchange_code, i_expiry_date_sensex

from datetime import datetime, timedelta

def get_instrument_details_banknifty():
    i_inst_name = "BN"
    i_stock_code = "BANKNIFTY"
    i_exchange_code = "NFO"

    # Step 1: Get today's date
    today = datetime.now().date()

    # Step 2: Find the first day of the next month
    if today.month == 12:
        first_day_next_month = datetime(today.year + 1, 1, 1).date()
    else:
        first_day_next_month = datetime(today.year, today.month + 1, 1).date()

    # Step 3: Get the last day of the current month
    last_day_this_month = first_day_next_month - timedelta(days=1)

    # Step 4: Find the last Thursday of the current month
    while last_day_this_month.weekday() != 3:  # 3 = Thursday
        last_day_this_month -= timedelta(days=1)

    i_expiry_date_banknifty = last_day_this_month

    print('Expiry Date Util:', i_expiry_date_banknifty, i_inst_name, i_stock_code, i_exchange_code)
    return i_inst_name, i_stock_code, i_exchange_code, i_expiry_date_banknifty

def main():
    get_zerodha_inst_file()
    with open('cred.yml') as f:
        cred = yaml.load(f, Loader=yaml.FullLoader)

    i_inst_name_nifty, i_stock_code_nifty, i_exchange_code_nifty, i_expiry_date_nifty = get_instrument_details_nifty()
    i_inst_name_banknifty, i_stock_code_banknifty, i_exchange_code_banknifty, i_expiry_date_banknifty = get_instrument_details_banknifty()
    i_inst_name_sensex, i_stock_code_sensex, i_exchange_code_sensex, i_expiry_date_sensex = get_instrument_details_sensex()
    i_inst_name_crude_oil, i_stock_code_crude_oil, i_exchange_code_crude_oil, i_expiry_date_crude_oil = get_instrument_details_crude_oil()

    insert_data_rec(cred, 'i_expiry_date_nifty', i_expiry_date_nifty)
    insert_data_rec(cred, 'i_expiry_date_banknifty', i_expiry_date_banknifty)
    insert_data_rec(cred, 'i_expiry_date_sensex', i_expiry_date_sensex)
    insert_data_rec(cred, 'i_expiry_date_crude_oil', i_expiry_date_crude_oil)

    insert_data_rec(cred, 'i_inst_name_nifty', i_inst_name_nifty)
    insert_data_rec(cred, 'i_inst_name_banknifty', i_inst_name_banknifty)
    insert_data_rec(cred, 'i_inst_name_sensex', i_inst_name_sensex)
    insert_data_rec(cred, 'i_inst_name_crude_oil', i_inst_name_crude_oil)


    insert_data_rec(cred, 'i_stock_code_nifty', i_stock_code_nifty)
    insert_data_rec(cred, 'i_stock_code_banknifty', i_stock_code_banknifty)
    insert_data_rec(cred, 'i_stock_code_sensex', i_stock_code_sensex)
    insert_data_rec(cred, 'i_stock_code_crude_oil', i_stock_code_crude_oil)

    insert_data_rec(cred, 'i_exchange_code_nifty', i_exchange_code_nifty)
    insert_data_rec(cred, 'i_exchange_code_banknifty', i_exchange_code_banknifty)
    insert_data_rec(cred, 'i_exchange_code_sensex', i_exchange_code_sensex)
    insert_data_rec(cred, 'i_exchange_code_crude_oil', i_exchange_code_crude_oil)




    with open('cred.yml', 'w') as fp:
        yaml.dump(cred, fp)



if __name__ == '__main__':
    get_instrument_details_nifty()
    get_instrument_details_banknifty()
    get_instrument_details_sensex()
    get_instrument_details_crude_oil()
