from __future__ import annotations

import traceback

from kiteconnect import KiteConnect

from .config import DOWNSIDE_CONFIG
from .data_loader import build_signal_universe, resolve_instrument_file
from .publisher import publish_strategy_state
from .strategy_runner import IntradayStockSignalRunner
from .utils import (
    build_log_and_print,
    is_after_market_close_ist,
    is_weekday_ist,
    load_creds,
    setup_logger,
    wait_until_market_open,
)


def main() -> None:
    strategy_name = DOWNSIDE_CONFIG["strategy_name"]
    side = DOWNSIDE_CONFIG["side"]
    regime_file_path = DOWNSIDE_CONFIG["regime_file_path"]
    fast_span = DOWNSIDE_CONFIG["fast_span"]
    slow_span = DOWNSIDE_CONFIG["slow_span"]
    log_file_name = DOWNSIDE_CONFIG["log_file_name"]

    logger = setup_logger("lightnin_bear_downside_intraday_signal", log_file_name)
    log_and_print = build_log_and_print(logger)

    log_and_print("Downside strategy main() entered")

    publish_strategy_state(
        strategy_name=strategy_name,
        ui_state="BOOTING",
        message="Downside strategy process started.",
        progress_text="Initializing",
        is_loading=True,
    )

    if not is_weekday_ist():
        publish_strategy_state(
            strategy_name=strategy_name,
            ui_state="STOPPED",
            message="Downside strategy inactive outside working days.",
            is_loading=False,
        )
        return

    wait_until_market_open(
        lambda **kwargs: publish_strategy_state(strategy_name=strategy_name, **kwargs)
    )

    try:
        cred = load_creds()

        kite = KiteConnect(api_key=cred["z_api_key"])
        kite.set_access_token(cred["z_access_token"])
        log_and_print("Kite authenticated successfully.")

        instrument_file_path = resolve_instrument_file()
        regime_tokens_df = build_signal_universe(
            regime_file_path=regime_file_path,
            instrument_file_path=instrument_file_path,
        )

        log_and_print(
            f"Matched {len(regime_tokens_df)} downside regime stocks with NSE cash tokens."
        )

        engine = IntradayStockSignalRunner(
            kite=kite,
            cred=cred,
            regime_tokens_df=regime_tokens_df,
            strategy_name=strategy_name,
            side=side,
            fast_span=fast_span,
            slow_span=slow_span,
            log_and_print=log_and_print,
            is_after_market_close_fn=is_after_market_close_ist,
        )

        engine.start()
        log_and_print("Downside intraday stock signal engine started.")

    except SystemExit:
        log_and_print("Downside strategy exited after execution.")
        publish_strategy_state(
            strategy_name=strategy_name,
            ui_state="STOPPED",
            message="Downside strategy stopped Manually.",
            is_loading=False,
        )

    except Exception as exc:
        log_and_print(f"Downside strategy failed: {exc}", "error")
        log_and_print(traceback.format_exc(), "error")
        publish_strategy_state(
            strategy_name=strategy_name,
            ui_state="ERROR",
            message=f"Downside strategy failed: {str(exc)}",
            progress_text="Check logs",
            is_loading=False,
        )


if __name__ == "__main__":
    main()
