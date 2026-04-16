import React from "react";

type Leg = {
  side?: string | null;
  trading_symbol?: string | null;
  avg_price?: number | null;
  ltp?: number | null;
  pnl?: number | null;
  quantity?: number | null;
  strike?: number | null;
  expiry?: string | null;
  right?: string | null;
  status?: string | null;
};

type SpreadState = {
  index: string;
  spread_type: string;
  strategy_name: string;
  status: string;
  ui_state?: string;
  message?: string;
  progress_text?: string | null;
  is_loading?: boolean;
  net_pnl?: number;
  stop_loss?: number;
  target?: number;
  updated_at?: string;
  legs?: Leg[];
};

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2);
}

function isWaitingState(uiState?: string): boolean {
  return [
    "BOOTING",
    "WAITING_START_TIME",
    "LOADING_HISTORY",
    "WAITING_SIGNAL",
    "SIGNAL_TRIGGERED",
    "ENTERING_SPREAD",
  ].includes(uiState || "");
}

function LoaderCard({ data }: { data: SpreadState }) {
  return (
    <div className="rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,#08101f,#0f172a,#111827)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 flex-shrink-0">
          <div className="absolute inset-0 rounded-full border-4 border-amber-400/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400 animate-spin" />
          <div className="absolute inset-2 rounded-full bg-amber-400/10 animate-pulse" />
        </div>

        <div className="min-w-0">
          <h3 className="text-2xl font-semibold text-white">
            {data.ui_state === "BOOTING" && "Booting strategy"}
            {data.ui_state === "WAITING_START_TIME" && "Waiting for start time"}
            {data.ui_state === "LOADING_HISTORY" && "Loading historical data"}
            {data.ui_state === "WAITING_SIGNAL" && "Waiting for signal"}
            {data.ui_state === "SIGNAL_TRIGGERED" && "Signal detected"}
            {data.ui_state === "ENTERING_SPREAD" && "Creating spread"}
          </h3>

          <p className="mt-1 text-sm text-slate-300">
            {data.message || "Strategy is running..."}
          </p>

          {data.progress_text ? (
            <p className="mt-1 text-xs text-amber-300">
              {data.progress_text}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="loading-bar h-full w-1/3 rounded-full bg-amber-400" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
        <span className="rounded-full bg-white/5 px-3 py-1">
          Strategy: {data.strategy_name}
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1">
          Index: {data.index}
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1">
          Type: {data.spread_type}
        </span>
      </div>
    </div>
  );
}

function LiveSpreadCard({ data }: { data: SpreadState }) {
  const buyLeg = data.legs?.find((leg) => leg.side === "BUY");
  const sellLeg = data.legs?.find((leg) => leg.side === "SELL");

  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,#08101f,#0f172a,#111827)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Bull Call Spreads</h2>
          <p className="mt-1 text-sm text-slate-300">
            {data.message || "Live intraday index bull call spread trades."}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap gap-3">
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">Status</div>
            <div className="text-sm font-semibold text-white">{data.status}</div>
          </div>

          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">Net PnL</div>
            <div className="text-sm font-semibold text-emerald-400">
              ₹ {formatNumber(data.net_pnl)}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">Stop Loss</div>
            <div className="text-sm font-semibold text-white">
              ₹ {formatNumber(data.stop_loss)}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-400">Target</div>
            <div className="text-sm font-semibold text-white">
              ₹ {formatNumber(data.target)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">BUY Leg</h3>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
              {buyLeg?.status || "--"}
            </span>
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <div>Symbol: <span className="text-white">{buyLeg?.trading_symbol || "--"}</span></div>
            <div>Strike: <span className="text-white">{buyLeg?.strike ?? "--"}</span></div>
            <div>Expiry: <span className="text-white">{buyLeg?.expiry || "--"}</span></div>
            <div>Avg Price: <span className="text-white">{formatNumber(buyLeg?.avg_price)}</span></div>
            <div>LTP: <span className="text-white">{formatNumber(buyLeg?.ltp)}</span></div>
            <div>PnL: <span className="text-emerald-300">{formatNumber(buyLeg?.pnl)}</span></div>
            <div>Qty: <span className="text-white">{buyLeg?.quantity ?? "--"}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">SELL Leg</h3>
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-300">
              {sellLeg?.status || "--"}
            </span>
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <div>Symbol: <span className="text-white">{sellLeg?.trading_symbol || "--"}</span></div>
            <div>Strike: <span className="text-white">{sellLeg?.strike ?? "--"}</span></div>
            <div>Expiry: <span className="text-white">{sellLeg?.expiry || "--"}</span></div>
            <div>Avg Price: <span className="text-white">{formatNumber(sellLeg?.avg_price)}</span></div>
            <div>LTP: <span className="text-white">{formatNumber(sellLeg?.ltp)}</span></div>
            <div>PnL: <span className="text-rose-300">{formatNumber(sellLeg?.pnl)}</span></div>
            <div>Qty: <span className="text-white">{sellLeg?.quantity ?? "--"}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#08101f,#0f172a,#111827)] p-6">
      <h3 className="text-xl font-semibold text-white">Bull Call Spreads</h3>
      <p className="mt-2 text-sm text-slate-400">
        No live bull call spreads available.
      </p>
    </div>
  );
}

export default function BullCallSpreadCard({ data }: { data?: SpreadState | null }) {
  if (!data) {
    return <EmptyCard />;
  }

  if (isWaitingState(data.ui_state)) {
    return <LoaderCard data={data} />;
  }

  if (data.legs && data.legs.length > 0) {
    return <LiveSpreadCard data={data} />;
  }

  return <EmptyCard />;
}
