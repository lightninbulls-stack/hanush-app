"""
Zerodha daily token refresh — runs headless on GitHub Actions CI.
Outputs the access token to stdout as: ACCESS_TOKEN:<token>
All other output goes to stderr (via logging).
"""
import os
import sys
import time
import logging
from urllib.parse import urlparse, parse_qs

import pyotp
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from kiteconnect import KiteConnect

# ==========================
# CONFIGURATION
# ==========================
API_KEY    = "7kbosahuhwl3muhk"
API_SECRET = "wu7d22otf07l91wxru3x5mzd3la52kd1"
USER_ID    = "IX6094"
PASSWORD   = "23@Loveyouto"
TOTP_SECRET = "DKITN7GBXWEEOFY5KQZAVKWEBBK73SYW"
WAIT_TIMEOUT = 25

# ==========================
# LOGGING → stderr only
# ==========================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)

# ==========================
# CHROME SETUP
# ==========================
def build_driver() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")   # required in CI/Docker

    # Run headless when HEADLESS env var is set (GitHub Actions always sets it)
    if os.environ.get("HEADLESS", "0") == "1":
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        log.info("Running in headless mode")

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(60)
    return driver

# ==========================
# LOGIN FLOW
# ==========================
def get_request_token() -> str | None:
    log.info("Starting get_request_token()")
    driver = build_driver()
    wait = WebDriverWait(driver, WAIT_TIMEOUT)

    try:
        kite = KiteConnect(api_key=API_KEY)
        login_url = kite.login_url()
        log.info("Opening Zerodha login page...")
        driver.get(login_url)

        log.info("Entering user ID...")
        user_input = wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//input[@id='userid' or @name='user_id' or @type='text']")
            )
        )
        user_input.clear()
        user_input.send_keys(USER_ID)

        log.info("Entering password...")
        password_input = wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//input[@id='password' or @type='password']")
            )
        )
        password_input.clear()
        password_input.send_keys(PASSWORD)

        log.info("Clicking login button...")
        wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']"))).click()

        time.sleep(2)

        try:
            log.info("Checking for TOTP screen...")
            totp_input = WebDriverWait(driver, 8).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//input[@type='number' or @inputmode='numeric' or @autocomplete='one-time-code']")
                )
            )
            totp = pyotp.TOTP(TOTP_SECRET).now()
            totp_input.clear()
            totp_input.send_keys(totp)
            log.info("TOTP entered")
            wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@type='submit']"))).click()
            log.info("TOTP submitted")
        except Exception:
            log.info("TOTP screen not shown or already handled")

        log.info("Waiting for redirect with request_token...")
        wait.until(lambda d: "request_token=" in d.current_url)

        parsed = urlparse(driver.current_url)
        request_token = parse_qs(parsed.query).get("request_token", [None])[0]

        if not request_token:
            raise RuntimeError("request_token missing in redirect URL")

        log.info("Request token obtained")
        return request_token

    except Exception:
        log.error("Error during Zerodha login automation", exc_info=True)
        return None

    finally:
        time.sleep(2)
        driver.quit()
        log.info("Browser closed")

# ==========================
# MAIN
# ==========================
def main():
    log.info("Starting Zerodha token refresh")
    request_token = get_request_token()

    if not request_token:
        log.error("Failed to obtain request token. Exiting.")
        sys.exit(1)

    kite = KiteConnect(api_key=API_KEY)
    try:
        session = kite.generate_session(
            request_token=request_token,
            api_secret=API_SECRET,
        )
        access_token = session["access_token"]
        log.info("Access token generated successfully")

        # Print ONLY the token to stdout — the workflow captures this line
        print(f"ACCESS_TOKEN:{access_token}", flush=True)

    except Exception:
        log.error("Failed to generate access token", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
