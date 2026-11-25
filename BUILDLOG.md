# BUILDLOG — token-radar-01 entry

Competition: make.fun "Build the best token launch radar" (token-radar-01), deadline 2026-12-14 10:00 UTC.
Agent account: @lively-coyote-65-9453, wallet 5tWwX5rmp4KtzUpBHGQo7Ncf3yrPfKM2gpTdL33KrMgb.
All work was done at zero cost. Nothing has been pushed to GitHub and nothing has been submitted yet.

## Round 1 — build (subagent session a3e67ef7, 2026-11-25 morning)

- Generated the Solana keypair (~/.makefun/makefun-keypair.json, mode 600) and wrote .makefun/owner.json.
- Downloaded the official kit (token-radar-01-kit) and read RULES.txt / competition.yaml.
- Built the entry from the kit starter: main.ts + lib/model.ts (anchor-3 pricing model: implied value =
  TVL x category/family/global anchor multiple x growth x age x breadth), dashboard/ (board, detail and
  filtered views, hash routing), vendor/makefun-board.ts, MIT LICENSE, README with make.fun badges.
- Ran main.ts twice (out/, out2/): 758 protocols scanned, 213 board rows, watchlist 40/40.
- Left undone when the session ended without a report: registration, git commits, BUILDLOG, and the
  screenshots it produced were blank dark frames (5941 bytes each, page captured before render).

## Round 2 — read-only audit (subagent session 5cbdb4e0)

- Audited only, ran no code (an execution-risk check stopped it; ting's explicit consent to run the
  project and kit code was obtained afterwards, 2026-11-25 21:12 CST).
- Verified: registration had never run (~/.makefun/credentials missing); there is no local scorer —
  the server grades; the kit CLI `check` is the official pre-check; the transcript gate needs recorded
  sessions, and a handed-over transcript is ranked but takes no paid place.

## Round 3 — finish (subagent session f4ef4c2c, this log)

1. Registration: `node cli/makefun.mjs register --keypair ~/.makefun/makefun-keypair.json` succeeded
   after two transient proxy drops. Account @lively-coyote-65-9453 created, wallet matches owner.json,
   API key stored in ~/.makefun/credentials (mode 600, expires 2026-12-25). Prerequisites checked
   beforehand: Node v24.22.1 (>= 22.18) and a browser — both present, nothing paid.
2. Regenerated a clean output with the kit's sealed snapshot:
   `MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json`
   -> 758 protocols (342 pre-token, 416 traded), board 213 rows (40 watchlist + 173 early).
3. Screenshots re-taken with headless Chrome (CDP, 1440x900, waited for aria-busy=false and real rows):
   - 1-board.png (167,584 B): filter controls + ranked table, Steakhouse Financial #1 at $545.7M.
   - 2-detail.png (204,504 B): Steakhouse Financial detail — price breakdown and farm plan.
   - 3-filtered.png (172,651 B): Category = Dexs, "20 of 213 protocols shown".
   First attempt framed only the intro panel (the table sits below it), so board/filtered shots were
   re-taken scrolled to the controls — the same framing the starter's own screenshots use. All three
   were opened and visually confirmed to show real data. Sizes follow the starter's own range
   (137–219 KB); the gate cap is 512 KiB and the dossier stays well under its 1.5 MiB cap.
   main.ts was then run once more so /output and dossier.json embed the final screenshots.
4. Seven-gate self-check against out/ (script mirrors RULES.txt; the server remains the real grader):
   - dashboard_files PASS — 3 files, 21,465 B total (< 64 KB source), no http(s) in attributes/CSS/JS imports.
   - board_file PASS — 213 rows (100–4000), every slug from the snapshot, board.json 354,003 B.
   - sorted_by_value PASS — ranks exactly 1..213, implied value non-increasing ($545,700,724 -> $267,195), not all equal.
   - coverage PASS — all 40 watchlist slugs present.
   - farm_steps PASS — every row 3–12 steps, each 20–600 chars trimmed.
   - screenshots PASS — 3 PNGs, 1440x900 (long side <= 1440, short side >= 800), each <= 512 KiB, whole PNGs.
   - dossier_matches PASS — out/dossier.json (749,185 B) is byte-identical to a fresh buildDossier rebuild.
5. Transcript bundle: `node cli/makefun.mjs bundle` found the harness-recorded Muse app sessions on
   disk by itself — the parent session, both earlier subagent sessions, this session, and one earlier
   session whose file the build read. These are recorded logs, NOT handed-over files, so the
   transcripts_recorded check can pass and the entry can take a paid place. The run record carries
   ting's own opening words ("好，注册账号，打雷达练兵", typed), the system prompt (uploaded) and
   AGENTS.md (collected). Declared with flags: --provider meta, --effort default, --mcp none (the build
   sessions used only the harness's built-in tools; no MCP server is named in their tool lists).
   Bundle auto-redacted emails, home paths, usernames and credentials; the name forms "Shen Liu" /
   "Liu Shen" were passed with --redact (the two-character Chinese name was refused by bundle itself
   as too short to redact safely). Bundle written to ~/workspace/makefun/token-radar-bundle.tar.gz.
6. Git: the source, dashboard, screenshots, vendor, LICENSE, README, .makefun/owner.json and this log
   are committed (see `git log`). out/ is a generated artifact and is gitignored — the server re-runs
   main.ts itself; the starter ships no out/ either.

## Official CLI check (run in round 3 on the first commit)

`node cli/makefun.mjs check --repo . --commit 19f1fde… --transcripts token-radar-bundle.tar.gz`:
**13 passed, 1 failed, 6 skipped, 5 verified at submission.** Passed include competition_open,
snapshot size caps, license_osi (MIT), entrypoint (main.ts / node22), transcripts_present,
**transcripts_recorded** (all 5 sessions are harness-recorded logs), thinking_wellformed,
thinking_in_window, thinking_reproduces (615/1209 lines = 50.8% authored, >= 30% required),
thinking_turns, thinking_revised, transcripts_run_record and thinking_own_work.
The single FAIL is **thinking_priced** — the 0-usage-rows issue described in the next section;
its printed fix is exactly the procedure below. The at-submission items are all satisfied by the
plan: the GitHub repo will be public and created after the 2026-11-14 opening, .makefun/owner.json
naming this account's wallet is already committed (that is what repo_owner asks for), and the
entry's files differ from the starter (duplicate_snapshot).

## One step the top-level agent must still do before submitting

The bundle above was packed while this subagent session was still running, so it carries **0 token
usage rows** — Muse writes a subagent's usage rows to muse.db only when its run completes, and
bundle's warning says an entry of Muse app sessions without usage rows is rejected where transcripts
are required. After this session has completed, the top-level agent must:

1. Extract the usage rows from muse.db (agent_message_token_usage joined to agents for the model),
   for these agent ids: b01d86b1-358d-47f8-99f9-f358c9a15ca8 (top-level), a3e67ef7-9543-46cd-8b17-9159709b443f
   (round 1), 5cbdb4e0-2bdd-4fb9-81fd-994dd2958c04 (round 2), f4ef4c2c-e7cf-40c2-8b01-86872d026d47
   (round 3), 2dee9d71-6ff6-4a75-87e3-f0beb929bc7c (read-source session) — the exact SELECT is in
   `node cli/makefun.mjs bundle --help` under --muse-usage — and write the rows, unchanged, one JSON
   object per line, to a file (e.g. ~/workspace/makefun/muse-usage.jsonl).
2. Re-run bundle from the kit with the same flags as round 3 plus `--muse-usage <that file>`:
   `node cli/makefun.mjs bundle --repo ~/workspace/makefun/token-radar --out ~/workspace/makefun/token-radar-bundle.tar.gz --redact "Shen Liu" --redact "Liu Shen" --provider meta --effort default --mcp none --muse-usage ~/workspace/makefun/muse-usage.jsonl`
   (the repo is committed by then, so the repo.dirty note disappears too). Confirm it no longer
   reports 0 usage rows.
3. Run the official pre-check on the final commit + bundle:
   `node cli/makefun.mjs check --repo ~/workspace/makefun/token-radar --commit <HEAD sha> --transcripts ~/workspace/makefun/token-radar-bundle.tar.gz`
   and fix whatever it names before submitting.

## Still needed from ting before the entry can be submitted

- Create a public GitHub repository named `token-radar` under his account `1942133569-cmd`
  (the README badges already point at github.com/1942133569-cmd/token-radar). Muse cannot create
  repositories (GitHub App returns 403), so this one click is his.
- After that: push this repo, note the commit sha, and submit with the bundle:
  `node cli/makefun.mjs submit --competition token-radar-01 --repo-url <url> --commit <sha> --bundle ~/workspace/makefun/token-radar-bundle.tar.gz --keypair ~/.makefun/makefun-keypair.json`
