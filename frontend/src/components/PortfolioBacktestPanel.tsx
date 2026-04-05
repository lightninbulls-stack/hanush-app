const metricCards: MetricCardItem[] = useMemo(
  () => [
    {
      label: "Cumulative Return",
      value: formatPercent(m.cumulative_return_pct),
      tone: getTone(m.cumulative_return_pct),
    },
    {
      label: "CAGR",
      value: formatPercent(m.cagr_pct),
      tone: getTone(m.cagr_pct),
    },
    {
      label: "Volatility",
      value: formatPercent(m.annualized_volatility_pct),
      tone: "neutral",
    },
    {
      label: "Sharpe",
      value: formatNumber(m.sharpe),
      tone: getTone(m.sharpe),
    },
    {
      label: "Max Drawdown",
      value: formatPercent(m.max_drawdown_pct),
      tone: getTone(m.max_drawdown_pct),
    },
    {
      label: "1W Return",
      value: formatPercent(m.return_1w_pct),
      tone: getTone(m.return_1w_pct),
    },
    {
      label: "1M Return",
      value: formatPercent(m.return_1m_pct),
      tone: getTone(m.return_1m_pct),
    },
    {
      label: "3M Return",
      value: formatPercent(m.return_3m_pct),
      tone: getTone(m.return_3m_pct),
    },
    {
      label: "6M Return",
      value: formatPercent(m.return_6m_pct),
      tone: getTone(m.return_6m_pct),
    },
    {
      label: "Portfolio VaR (95%)",
      value: formatPercent(m.var_95_pct),
      tone: "negative",
    },
  ],
  [m]
);
