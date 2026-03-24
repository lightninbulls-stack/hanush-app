import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, type IChartApi, type UTCTimestamp } from 'lightweight-charts';
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
        { label: '5M', value: '5m' },
        { label: '15M', value: '15m' },
        { label: '1H', value: '1h' },
        { label: '1D', value: '1d' },
        { label: '1W', value: '1wk' },
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
                
                    // ✅ Always convert to IST for display
                    const istDate = new Date(timestamp * 1000 + 5.5 * 60 * 60 * 1000);
                
                    if (interval === '5m' || interval === '15m' || interval === '1h') {
                        const hours = istDate.getUTCHours().toString().padStart(2, '0');
                        const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
                
                        // Show date at 9:15 AM IST (market open)
                        if (hours === '09' && minutes === '15') {
                            const day = istDate.getUTCDate().toString().padStart(2, '0');
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const month = monthNames[istDate.getUTCMonth()];
                            return `${month} ${day}`;
                        }
                        return `${hours}:${minutes}`;
                
                    } else if (interval === '1d') {
                        const day = istDate.getUTCDate();
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const month = monthNames[istDate.getUTCMonth()];
                        const year = istDate.getUTCFullYear();
                        if (day === 1) return `${month} ${year}`;
                        return day.toString();
                
                    } else if (interval === '1wk') {
                        const day = istDate.getUTCDate();
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const month = monthNames[istDate.getUTCMonth()];
                        return `${month} ${day}`;
                
                    } else {
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const month = monthNames[istDate.getUTCMonth()];
                        const year = istDate.getUTCFullYear();
                        return `${month} ${year}`;
                    }
                },
            },
            rightPriceScale: {
                borderColor: '#2B2B43',
                visible: true,
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    color: '#758696',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#c5a059',
                },
                horzLine: {
                    color: '#758696',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#c5a059',
                },
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

                    if (interval === '5m' || interval === '15m' || interval === '1h') {
                        // ✅ Show IST time in crosshair: add 5h30m to UTC
                        const istDate = new Date(timestamp * 1000 + 5.5 * 60 * 60 * 1000);
                        const hours = istDate.getUTCHours().toString().padStart(2, '0');
                        const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
                        const day = istDate.getUTCDate().toString().padStart(2, '0');
                        const month = (istDate.getUTCMonth() + 1).toString().padStart(2, '0');
                        const year = istDate.getUTCFullYear();
                        return `${year}-${month}-${day} ${hours}:${minutes} IST`;
                    }

                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    return `${year}-${month}-${day}`;
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
                const response = await axios.get(`${API_BASE_URL}/stocks/history/${symbol}?interval=${interval}`);
                const history = response.data;

                if (history && history.length > 0) {
                    const processedData = history.map((d: any) => {
                        let time: UTCTimestamp;

                        if (typeof d.time === 'string') {
                            const dateObj = new Date(d.time);
                            time = Math.floor(dateObj.getTime() / 1000) as UTCTimestamp;
                        } else if (typeof d.time === 'number') {
                            time = d.time as UTCTimestamp;
                        } else {
                            console.error('Invalid time format:', d.time);
                            return null;
                        }

                        return {
                            time,
                            open: parseFloat(d.open),
                            high: parseFloat(d.high),
                            low: parseFloat(d.low),
                            close: parseFloat(d.close),
                        };
                    }).filter(Boolean);

                    const sortedData = processedData.sort((a: any, b: any) => a.time - b.time);

                    candlestickSeries.setData(sortedData);
                    chart.timeScale().fitContent();

                    setTimeout(() => {
                        if (chartContainerRef.current) {
                            chart.applyOptions({
                                width: chartContainerRef.current.clientWidth
                            });
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Error fetching data for Lightweight Charts:', error);
            }
        };

        fetchData();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [symbol, interval]);

    // ✅ Clean display name: strip .NS suffix
    const displayName = symbol.replace('.NS', '').replace('.BSE', '');

    return (
        <div className="chart-wrapper" style={{ width: '100%' }}>
            {/* ✅ Stock name header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '10px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color: '#c5a059',
                        letterSpacing: '0.05em',
                    }}>
                        {displayName}
                    </span>
                    <span style={{
                        fontSize: '0.75rem',
                        color: '#666',
                        background: '#1a1a1a',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #333',
                    }}>
                        NSE
                    </span>
                </div>

                {/* Timeframe selector */}
                <div
                    className="timeframe-selector"
                    style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                    }}
                >
                    {timeframes.map((tf) => (
                        <button
                            key={tf.value}
                            onClick={() => setInterval(tf.value)}
                            style={{
                                padding: '6px 14px',
                                background: interval === tf.value ? '#c5a059' : '#1a1a1a',
                                border: interval === tf.value ? '2px solid #c5a059' : '1px solid #333',
                                borderRadius: '4px',
                                color: interval === tf.value ? '#000' : '#aaa',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: interval === tf.value ? 700 : 400,
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (interval !== tf.value) {
                                    e.currentTarget.style.background = '#2a2a2a';
                                    e.currentTarget.style.color = '#fff';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (interval !== tf.value) {
                                    e.currentTarget.style.background = '#1a1a1a';
                                    e.currentTarget.style.color = '#aaa';
                                }
                            }}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>
            </div>

            <div
                ref={chartContainerRef}
                style={{
                    width: '100%',
                    height: '600px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'block',
                    position: 'relative',
                }}
            />
        </div>
    );
};

export default TradingViewChart;
