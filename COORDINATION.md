# Tradebot2 — Coordination Board

Shared task board for parallel agent sessions. Each task lists its status, owning session ID, and the files it touches. Claim a task by writing your session ID and file scope here, then commit and push that claim immediately. Never start a task another session has claimed. Keep scopes non-overlapping.

Statuses: unclaimed | in progress | done | needs review

## Convention
- Branches are named `session-<id>/<task>` and touch only the files in the claimed scope.
- If a task requires changing a file owned by another session, log the request here instead of editing it.
- Small, frequent commits. Run `git pull --rebase` before every push.
- On merge conflict: stop, resolve without discarding the other session's work, log what happened.
- When a task is finished, record sources, verification performed, and any irregularities here, then mark it done.
- Never mark anything verified without checking it against an official source; link that source.
- If a session crashes or its claim is >60 minutes old with no commits, any other session may take over and note the handoff here.
- Shared outputs (table data, site index/navigation) are changed only by the final integration session once all other tasks are done.

## Official sources (to be verified line by line)
- REST Trade API: https://external-api.demo.kalshi.co/trade-api/v2
- WebSocket API: wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2
- (Also listed: https://demo-api.kalshi.co/trade-api/v2 and wss://demo-api.kalshi.co/trade-api/ws/v2)

## Tasks

| # | Task | Status | Owner session | Files touched | Sources | Verification | Irregularities |
|---|------|--------|---------------|---------------|---------|--------------|----------------|
| 1 | Create COORDINATION.md shared task board | done | arena/7a21cbd2-tradebot2 | COORDINATION.md | — | — | — |
| 2 | Executive summary of Kalshi API / demo environment | done | arena/7a21cbd2-tradebot2 | docs/executive-summary.md | Kalshi trade API docs (docs.kalshi.com via web_search) | Verified against docs.kalshi.com; direct API blocked by sandbox egress | Sandbox cannot reach kalshi.co/kalshi.com (TLS) |
| 3 | Verify official Kalshi API endpoints & contract/price semantics | done | arena/7a21cbd2-tradebot2 | docs/api-verification.md | external-api.demo.kalshi.co | Verified endpoint surface vs docs.kalshi.com; direct connectivity blocked | Sandbox cannot reach kalshi.co/kalshi.com (TLS) |
| 4 | Build live dashboard site (landing page + category subpages) | in progress | arena/7a21cbd2-tradebot2 | index.html, categories/*.html, assets/, alert/chart/portfolio pages | — | pending | pending |
| 5 | Price-swing alert system (>= $0.10) + two scrolling chats | unclaimed | — | JS alert/chat modules | — | pending | pending |
| 6 | Live event tracking until resolution (yes/no) | unclaimed | — | event state modules | — | pending | pending |
| 7 | Simulated trades automation + strategy testing | unclaimed | — | trade simulation modules | — | pending | pending |
| 8 | Portfolio performance tracking + trade categorization | unclaimed | — | portfolio modules | — | pending | pending |
| 9 | Price movement graph (time X, price Y, selectable length) + liquidity | unclaimed | — | chart modules | — | pending | pending |
| 10 | Live/interactivity suggestions + sharp-jump event links | unclaimed | — | docs/interactivity-suggestions.md | — | pending | pending |
| 11 | GitHub Pages site build + no broken links | unclaimed | — | GitHub Actions/pages config | — | pending | pending |
| 12 | Final integration: merge, re-verify line by line, publish, record PR | unclaimed | — | all | — | pending | pending |

## Flagged for Review / Unverified items
(None yet)
