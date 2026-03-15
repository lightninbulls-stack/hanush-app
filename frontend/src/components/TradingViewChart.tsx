import React, { useEffect, useRef } from 'react';
import {
    createChart, ColorType,
    type IChartApi, type UTCTimestamp
} from 'lightweight-charts';
import axios from 'axios';

interface TradingViewChartProps {
    symbol: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [interval, setInterval] = React.useState('1d');

    const timeframes = [
        { label: '5M',  value: '5m'  },
        { label: '15M', value: '15m' },
        { label: '1H',  value: '1h'  },
        { label: '1D',  value: '1d'  },
        { label: '1W',  value: '1wk' },
        { label: '1MO', value: '1mo' },
    ];

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        const isIntraday = interval === '5m' || interval === '15m' || interval === '1h';

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0d0d0d' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#1a1a1a' },
                horzLines: { color: '#1a1a1a' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 600,
            timeScale: {
                timeVisible: isIntraday,
                secondsVisible: false,
                borderColor: '#2B2B43',
                visible: true,
                minBarSpacing: 0.5,
                tickMarkFormatter: (time: number | string) => {
                    let timestamp: number;
                    if (typeof time === 'string') {
                        timestamp = new Date(time).getTime() / 1000;
                    } else {
                        timestamp = time;
                    }
                    const date = new Date(timestamp * 1000);
                    if (interval === '5m' || interval === '15m' || interval === '1h') {
                        const hours = date.getHours().toString().padStart(2, '0');
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        if (hours === '00' && minutes === '00') {
                            const day = date.getDate().toString().padStart(2, '0');
                            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            return `${monthNames[date.getMonth()]} ${day}`;
                        }
                        return `${hours}:${minutes}`;
                    } else if (interval === '1d') {
                        const day = date.getDate();
                        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        if (day === 1) return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                        return day.toString();
                    } else if (interval === '1wk') {
                        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return `${monthNames[date.getMonth()]} ${date.getDate()}`;
                    } else {
                        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                    }
                },
            },
            rightPriceScale: { borderColor: '#2B2B43', visible: true },
            crosshair: {
                mode: 0,
                vertLine: { color: '#758696', width: 1, style: 2, labelBackgroundColor: '#c5a059' },
                horzLine: { color: '#758696', width: 1, style: 2, labelBackgroundColor: '#c5a059' },
            },
            localization: {
                timeFormatter: (time: number | string) => {
                    let timestamp: number;
                    if (typeof time === 'string') {
                        timestamp = new Date(time).getTime() / 1000;
                    } else {
                        timestamp = time;
                    }
                    const date = new Date(timestamp * 1000);
                    const h = date.getHours().toString().padStart(2, '0');
                    const m = date.getMinutes().toString().padStart(2, '0');
                    const d = date.getDate().toString().padStart(2, '0');
                    const mo = (date.getMonth() + 1).toString().padStart(2, '0');
                    const y = date.getFullYear();
                    if (interval === '5m' || interval === '15m' || interval === '1h') {
                        return `${y}-${mo}-${d} ${h}:${m}`;
                    }
                    return `${y}-${mo}-${d}`;
                },
            },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#00ff88',
            downColor: '#ff4d4d',
            borderVisible: false,
            wickUpColor: '#00ff88',
            wickDownColor: '#ff4d4d',
        });

        chartRef.current = chart;

        const fetchData = async () => {
            try {
                // ── Try PostgreSQL first via /stocks/history (now backed by DB) ──
                const response = await axios.get(
                    `${API_BASE_URL}/stocks/history/${symbol}?interval=${interval}`
                );
                const history = response.data;

                if (history && history.length > 0) {
                    const processedData = history
                        .map((d: { time: string | number; open: string | number; high: string | number; low: string | number; close: string | number }) => {
                            let time: UTCTimestamp;
                            if (typeof d.time === 'string') {
                                time = Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp;
                            } else {
                                time = d.time as UTCTimestamp;
                            }
                            return {
                                time,
                                open:  parseFloat(String(d.open)),
                                high:  parseFloat(String(d.high)),
                                low:   parseFloat(String(d.low)),
                                close: parseFloat(String(d.close)),
                            };
                        })
                        .sort((a: { time: UTCTimestamp }, b: { time: UTCTimestamp }) => a.time - b.time);

                    candlestickSeries.setData(processedData);
                    chart.timeScale().fitContent();

                    setTimeout(() => {
                        if (chartContainerRef.current) {
                            chart.applyOptions({ width: chartContainerRef.current.clientWidth });
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Error fetching chart data:', error);
            }
        };

        fetchData();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [symbol, interval]);

    return (
        <div className="chart-wrapper" style={{ width: '100%' }}>
            <div
                className="timeframe-selector"
                style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}
            >
                {timeframes.map((tf) => (
                    <button
                        key={tf.value}
                        onClick={() => setInterval(tf.value)}
                        style={{
                            padding: '8px 16px',
                            background: interval === tf.value ? '#c5a059' : '#333',
                            border: interval === tf.value ? '2px solid #c5a059' : '1px solid #555',
                            borderRadius: '4px',
                            color: interval === tf.value ? '#000' : '#fff',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: interval === tf.value ? 'bold' : 'normal',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (interval !== tf.value) e.currentTarget.style.background = '#444';
                        }}
                        onMouseLeave={(e) => {
                            if (interval !== tf.value) e.currentTarget.style.background = '#333';
                        }}
                    >
                        {tf.label}
                    </button>
                ))}
            </div>
            <div
                ref={chartContainerRef}
                style={{
                    width: '100%', height: '600px', borderRadius: '8px',
                    overflow: 'hidden', display: 'block', position: 'relative'
                }}
            />
        </div>
    );
};

export default TradingViewChart;
