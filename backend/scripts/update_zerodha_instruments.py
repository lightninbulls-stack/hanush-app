from __future__ import annotations

from pathlib import Path
import requests


INSTRUMENTS_URL = "https://api.kite.trade/instruments"
OUTPUT_PATH = Path("backend/data/inst_zerodha_nfo.csv")
REQUEST_TIMEOUT = 60


def download_zerodha_instruments() -> None:
    """
    Download the latest Zerodha instruments file and overwrite the local CSV.
    """
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    response = requests.get(INSTRUMENTS_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    OUTPUT_PATH.write_bytes(response.content)

    print(f"Saved latest instruments file to: {OUTPUT_PATH.resolve()}")
    print(f"File size: {OUTPUT_PATH.stat().st_size} bytes")


def main() -> None:
    download_zerodha_instruments()


if __name__ == "__main__":
    main()
