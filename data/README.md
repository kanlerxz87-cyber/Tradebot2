# data/

Generated artifacts live under this directory (`data/`). At this commit the repo
contains only the files below — everything else is generated at build time by
`scripts/kalshi_collector.py`, `scripts/verify_site.py`, or `scripts/simulate.js`.

## Files tracked in repo
- `data/snapshot.json`, `data/verified_topics.json`, `data/verified_api_endpoints.json`,
  `data/flagged_irregularities.json` — generated snapshots/verified tables (see git history).

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

Note: `data/portfolio-log.json` mixes paper and demo-account trade history and is
not covered by `.gitignore` yet — hold it out of commits. (See COORDINATION.md for
the request to add it for the next integration session.)

Do not commit personal or private keys anywhere, including `data/`.
