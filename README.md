# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/1942133569-cmd/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/1942133569-cmd/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. It reads a sealed snapshot of every protocol DefiLlama tracks, finds the ones that record no token yet and are not a wrapped or staked product of one that trades, and ranks them by what their launch would be worth: each protocol's TVL priced at the live market-cap/TVL anchor of its own category (or its economic family's, or the market's as a whole), adjusted for its seven-day growth, its age with no token and its chain breadth. The hand-in is a static dashboard — the ranked board, a detail view with the price breakdown and a farm plan for every protocol, and filters — written by `main.ts` together with `board.json` and the dossier.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
