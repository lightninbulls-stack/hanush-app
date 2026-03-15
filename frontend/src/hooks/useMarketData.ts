/**
 * useMarketData.ts
 * Hooks for fetching OHLCV candles from PostgreSQL + live ticks via WebSocket.
 * Used to upgrade TradingViewChart.tsx from yfinance to Zerodha DB data.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE: string =
  (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? 'http://localhost:8000';
const WS_BASE: string = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');

export type Timeframe =
  | '1min' | '5min' | '15min' | '1hour'
  | '1day' | '1week' | '1month';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_partial?: boolean;
}

/** Maps yfinance interval strings to Zerodha timeframe keys */
export const INTERVAL_TO_TIMEFRAME: Record<string, Timeframe> = {
  '1m': '1min',  '5m': '5min',  '15m': '15min', '1h': '1hour',
  '1d': '1day',  '1wk': '1week','1mo': '1month',
  '1min': '1min','5min': '5min','15min': '15min','1hour': '1hour',
  '1day': '1day','1week': '1week','1month': '1month',
};

// ─── Historical candles from PostgreSQL ──────────────────────────────────────

export function useChartData(symbol: string, timeframe: Timeframe, limit?: number) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ timeframe });
      if (limit) params.set('limit', String(limit));
      const res = await fetch(`${API_BASE}/api/chart/${symbol.toUpperCase()}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: Candle[] };
      setCandles(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, limit]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  return { candles, loading, error, refetch: fetchData };
}

// ─── Live ticks via WebSocket ─────────────────────────────────────────────────

interface TickMsg   { type: 'tick'; symbol: string; price: number; volume: number; timestamp: string }
interface CandleMsg { type: 'candle_close'; symbol: string; timeframe: Timeframe; candle: Candle }
interface OtherMsg  { type: 'pong' | 'subscribed' }
type WsMsg = TickMsg | CandleMsg | OtherMsg;

export function useLiveData(symbols: string[], timeframes?: Timeframe[]) {
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prices,        setPrices]        = useState<Record<string, number>>({});
  const [latestCandles, setLatestCandles] = useState<Record<string, Record<string, Candle>>>({});
  const [connected,     setConnected]     = useState(false);

  const symbolKey = symbols.join(',');
  const tfKey     = (timeframes ?? []).join(',');

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${WS_BASE}/ws/live`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', symbols }));
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(e.data) as WsMsg;
        if (msg.type === 'tick') {
          setPrices(p => ({ ...p, [msg.symbol]: msg.price }));
        } else if (msg.type === 'candle_close') {
          if (!timeframes || timeframes.includes(msg.timeframe)) {
            setLatestCandles(p => ({
              ...p,
              [msg.symbol]: { ...(p[msg.symbol] ?? {}), [msg.timeframe]: msg.candle },
            }));
          }
        }
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey, tfKey]);

  useEffect(() => {
    connect();
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }, 30_000);
    return () => {
      clearInterval(ping);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { prices, latestCandles, connected };
}

// ─── Historical + live merged ─────────────────────────────────────────────────

export function useRealtimeChart(symbol: string, timeframe: Timeframe, limit?: number) {
  const { candles: historical, loading, error } = useChartData(symbol, timeframe, limit);
  const { prices, latestCandles } = useLiveData([symbol], [timeframe]);
  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    if (historical.length) setCandles([...historical]);
  }, [historical]);

  useEffect(() => {
    const live = latestCandles[symbol]?.[timeframe];
    if (!live) return;
    setCandles(prev => {
      if (!prev.length) return [live];
      const last = prev[prev.length - 1];
      if (last.time === live.time) return [...prev.slice(0, -1), live];
      if (live.time > last.time)   return [...prev, live];
      return prev;
    });
  }, [latestCandles, symbol, timeframe]);

  return { candles, loading, error, currentPrice: prices[symbol] };
}

// ─── Watchlist bulk prices ────────────────────────────────────────────────────

export function useWatchlistPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const { prices: livePrices, connected } = useLiveData(symbols);
  const symbolKey = symbols.join(',');

  useEffect(() => {
    if (!symbols.length) return;
    fetch(`${API_BASE}/api/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(symbols),
    })
      .then(r => r.json())
      .then((data: Record<string, { price: number }>) => {
        const m: Record<string, number> = {};
        for (const [s, v] of Object.entries(data)) m[s] = v.price;
        setPrices(m);
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  useEffect(() => {
    if (Object.keys(livePrices).length) setPrices(p => ({ ...p, ...livePrices }));
  }, [livePrices]);

  return { prices, connected };
}
