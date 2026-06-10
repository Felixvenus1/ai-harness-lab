"""Purpose: Credible intervals and Highest Posterior Density Region (HPDR) computation."""
from __future__ import annotations

import math


def beta_hpdr(alpha: float, beta: float, mass: float = 0.90, n_grid: int = 2000) -> tuple[float, float]:
    """Compute the Highest Posterior Density Region for a Beta(alpha, beta) distribution.

    Uses a grid search over [0, 1] to find the narrowest interval containing
    `mass` (e.g. 0.90) of the posterior probability mass.

    Returns: (lo, hi) tuple.
    """
    try:
        from scipy import stats as scipy_stats  # type: ignore
        import numpy as np  # type: ignore

        dist = scipy_stats.beta(alpha, beta)
        grid = np.linspace(0.0, 1.0, n_grid)
        pdf_vals = dist.pdf(grid)
        width = int(n_grid * mass)
        best_lo, best_hi, best_density = 0, width, float("inf")

        for i in range(n_grid - width):
            density_sum = float(np.sum(pdf_vals[i : i + width]))
            cdf_width = float(dist.cdf(grid[i + width]) - dist.cdf(grid[i]))
            if abs(cdf_width - mass) < 0.02 and density_sum < best_density:
                best_density = density_sum
                best_lo, best_hi = i, i + width

        lo = float(dist.ppf(max(0.0, dist.cdf(grid[best_lo]))))
        hi = float(dist.ppf(min(1.0, dist.cdf(grid[best_hi]))))
        return round(lo, 4), round(hi, 4)

    except ImportError:
        # Fallback: use equal-tailed credible interval from scipy-free Beta quantile
        lo = _beta_quantile(alpha, beta, (1 - mass) / 2)
        hi = _beta_quantile(alpha, beta, 1 - (1 - mass) / 2)
        return round(lo, 4), round(hi, 4)


def _beta_quantile(alpha: float, beta_param: float, p: float) -> float:
    """Simple numerical Beta quantile using bisection (fallback when scipy not available)."""
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if _beta_cdf(mid, alpha, beta_param) < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _beta_cdf(x: float, a: float, b: float) -> float:
    """Regularised incomplete beta function via continued fraction (Lentz)."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    # Use symmetry relation for faster convergence
    if x > (a + 1) / (a + b + 2):
        return 1.0 - _beta_cdf(1 - x, b, a)

    lbeta = math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)
    front = math.exp(math.log(x) * a + math.log(1 - x) * b - lbeta) / a

    # Lentz's algorithm for the continued fraction
    def _cf() -> float:
        qab = a + b
        qap = a + 1
        qam = a - 1
        c, d = 1.0, 1.0 - qab * x / qap
        if abs(d) < 1e-30:
            d = 1e-30
        d = 1.0 / d
        h = d

        for m in range(1, 101):
            m2 = 2 * m
            aa = m * (b - m) * x / ((qam + m2) * (a + m2))
            d = 1.0 + aa * d
            if abs(d) < 1e-30:
                d = 1e-30
            c = 1.0 + aa / c
            if abs(c) < 1e-30:
                c = 1e-30
            d = 1.0 / d
            h *= d * c
            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
            d = 1.0 + aa * d
            if abs(d) < 1e-30:
                d = 1e-30
            c = 1.0 + aa / c
            if abs(c) < 1e-30:
                c = 1e-30
            d = 1.0 / d
            delta = d * c
            h *= delta
            if abs(delta - 1.0) < 1e-10:
                break
        return h

    return front * _cf()
