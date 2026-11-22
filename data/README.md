# data/

Generated artifacts live under this directory (`data/`). This commit adds
`data/README.md` (format notes) and `scripts/simulate.js`. Everything else here is
generated at build time by `collector/` or `scripts/kalshi_collector.py`.

## portfolio-log.json (generated, NOT committed)

Written by `scripts/simulate.js` (paper mode by default; `--live` places real orders
on the **demo** environment with user-held credentials — never committed):

```json
{
  "mode": "paper",
  "generatedAt": "2026-11-22T08:00:00.000Z",
  "baseUrl": "https://external-api.demo.kalshi.co/trade-api/v2",
  "topic": "all",
  "trades": [
    {
      "strategy": "swing-momentum",
      "topic": "crypto",
      "ticker": "KXBTC-...",
      "side": "yes",
      "contracts": 1,
      "price": 0.42,
      "fee": 0.017,
      "reason": "swing up 0.12",
      "time": "2026-11-22T08:00:00.000Z"
    }
  ]
}
```

Note: `data/portfolio-log.json` mixes paper and demo-account trade history. Do NOT
commit it — hold it out of commits (the repo `.gitignore` does not yet exclude it;
see COORDINATION.md for the request to add it).

Do not commit personal or private keys anywhere, including `data/`.
