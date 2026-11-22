# Archived parallel-session output

This directory preserves the substantive content of the static dashboard and research files merged to `main` by parallel PRs #1, #2, and #3 while the final integration branch was in progress.

They are retained for provenance and to satisfy the coordination requirement not to discard another session's work. They are **not included in the final GitHub Pages artifact**.

## Why this output is archived

The files contain hard-coded or simulated values presented as current market/account facts, including example prices, a $10,000 demo balance, portfolio return, win rate, Sharpe ratio, ROI thresholds, event tickers, liquidity, and claimed jump catalysts. Those values were not tied row-by-row to official Kalshi demo API records and therefore do not satisfy the final source policy.

The final runtime in `src/` instead:

- requests official public demo data at runtime;
- leaves unavailable or authenticated values blank;
- labels all calculations and simulations;
- treats causal catalysts as unverified;
- links every rendered table body row to official Kalshi documentation or its demo API record.

See [`../../docs/VERIFICATION.md`](../../docs/VERIFICATION.md) and the current [official Kalshi API documentation](https://docs.kalshi.com).

## Layout

- `root/` — files that previous sessions placed in the repository root.
- `docs/` — files that previous sessions placed in the Pages `docs/` directory.

Git history retains the original merge commits and paths: `ea48ded`, `3fb2259`, and `27c53fe`.
