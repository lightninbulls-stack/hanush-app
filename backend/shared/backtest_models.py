from pydantic import BaseModel
from typing import List, Optional


class PortfolioPoint(BaseModel):
    date: str
    nav: float


class PortfolioHolding(BaseModel):
    symbol: str
    weight: float
    start_price: float
    end_price: float
    total_return_pct: float


class BenchmarkMetrics(BaseModel):
    cumulative_return_pct: float
    cagr_pct: float
    annualized_volatility_pct: float
    sharpe: float
    max_drawdown_pct: float
    return_1w_pct: Optional[float] = None
    return_1m_pct: Optional[float] = None
    return_3m_pct: Optional[float] = None
    return_6m_pct: Optional[float] = None
    var_95_pct: Optional[float] = None


class PortfolioMetrics(BaseModel):
    cumulative_return_pct: float
    cagr_pct: float
    annualized_volatility_pct: float
    sharpe: float
    max_drawdown_pct: float
    return_1w_pct: Optional[float] = None
    return_1m_pct: Optional[float] = None
    return_3m_pct: Optional[float] = None
    return_6m_pct: Optional[float] = None
    var_95_pct: Optional[float] = None
    beta_to_benchmark: Optional[float] = None
    correlation_to_benchmark: Optional[float] = None


class PortfolioBacktestResponse(BaseModel):
    requested_symbols: List[str]
    matched_symbols: List[str]
    metrics: PortfolioMetrics
    curve: List[PortfolioPoint]
    holdings: List[PortfolioHolding]
    benchmark_name: Optional[str] = None
    benchmark_metrics: Optional[BenchmarkMetrics] = None
    benchmark_curve: Optional[List[PortfolioPoint]] = None
