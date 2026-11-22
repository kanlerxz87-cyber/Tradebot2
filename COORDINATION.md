# COORDINATION.md — Tradebot2 Shared Task Board

> **Repository:** `kanlerxz87-cyber/Tradebot2`  
> **GitHub Pages URL:** `https://kanlerxz87-cyber.github.io/Tradebot2/` (deployed from `main` `/`)  
> **Active Integration Branch:** `arena/4f9ce955-tradebot2` (base commit `003447ea92f5fdd7c2ee66558876c99237818f38`)  
> **Last Updated:** 2026-11-22 (UTC)

---

## Task Board

| Task ID | Task Name | Status | Owning Session | Branch | File Scope |
| --- | --- | --- | --- | --- | --- |
| `T1-repo-audit` | Repo Review & Kalshi Demo API Verification | `in progress` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `VERIFICATION_REPORT.md`, `data/verified_api_endpoints.json`, `data/flagged_irregularities.json` |
| `T2-executive-summary` | Executive Summary & Interactive Roadmap | `in progress` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `EXECUTIVE_SUMMARY.md`, `README.md` |
| `T3-topic-datasets` | Verified 5-Topic Catalog (Gas Prices, Elections, Culture, Crypto, Golf) | `in progress` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `data/verified_topics.json` |
| `T4-kalshi-demo-tooling` | Kalshi Demo REST/WebSocket Client, Strategy Engine & Site Verifier | `in progress` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `scripts/kalshi_demo_client.py`, `scripts/strategy_engine.py`, `scripts/verify_site.py`, `requirements.txt` |
| `T5-live-dashboard-site` | Live Interactive GitHub Pages Dashboard & Category Subpages | `in progress` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `.nojekyll`, `index.html`, `pages/*.html`, `assets/css/styles.css`, `assets/js/*.js` |
| `T6-final-integration` | Final Line-by-Line Verification, Build Check, PR Merge & Pages Deploy | `unclaimed` | — | `arena/4f9ce955-tradebot2` | Shared index/nav verification, PR & GitHub Pages deployment |

---

## Coordination Protocol Notes
- Single-branch Arena session policy: all commits, pushes, and the pull request originate from `arena/4f9ce955-tradebot2` into `main`.
- Every verified table row must carry a direct URL to an official source (`docs.kalshi.com`, `kalshi.com`, `help.kalshi.com`, `gasprices.aaa.com`, `pgatour.com`, `grammy.com`, etc.).
- Any value that cannot be confirmed from an official source is left blank (`""` / `—`) and published on `pages/flagged-for-review.html` with status `needs review` (non-blocking).
- Simulated demo market streams and paper-trade fills are explicitly labeled as **Simulated Demo Mode** and never presented as verified exchange figures.

---

## Activity & Verification Log

| Timestamp (UTC) | Session | Action | Notes |
| --- | --- | --- | --- |
| 2026-11-22 07:05 | `arena-4f9ce955` | Created `COORDINATION.md` and claimed `T1`–`T5` | Repository initial audit completed: contained only 11-byte `README.md` (`# Tradebot2`) at commit `003447e`. GitHub Pages already enabled on `main` root (`/`). |
