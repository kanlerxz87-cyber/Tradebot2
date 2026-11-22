# data/history

One JSON file per tracked market, appended by `collector/collect.py` each cycle:
`{"ticker","series_ticker","topic","points":[{"ts","t","last","bid","ask","mid","vol","oi","bid_depth","spread"}]}`

Files here are pruned automatically when a market stops being tracked, and the
directory is intentionally empty until the first GitHub Actions cycle runs.
