# QA Findings

Date: 2026-04-20

## Baseline

- `README.md` reviewed before live testing.
- Automated baseline:
  - `pnpm test`
  - Engine suite passed: `18/18`
  - Web suite passed: `81/83`
  - Pre-existing red tests: `apps/web/src/lib/desktopBetLayout.test.mjs`
- Live driver: [scripts/live-qa.mjs](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/scripts/live-qa.mjs)
- Primary live evidence runs:
  - `node scripts/live-qa.mjs --json-out /tmp/live-qa-report.json`
  - `node scripts/live-qa.mjs --scenario standup_guard,seat_ledger,cooldown,aggregate,bombpot --json-out /tmp/live-qa-targeted-3.json`

## Coverage That Passed

- Baseline create/join/seat/start flow
- Normal heads-up hand through showdown
- Run-it-multiple-times:
  - pre-flop unanimous `2x`
  - pre-flop unanimous `3x`
  - pre-flop split vote fallback to `1x`
  - pre-flop timeout fallback to `1x`
  - flop unanimous `2x`
  - turn unanimous `2x`
- Bomb pot schedule and split-board hand start
- Queue leave removal on next `START_HAND` boundary
- Reconnect with same client identity and private-hole-card restoration
- Bomb-pot cooldown no longer blocks a re-seated proposer
- Aggregate multi-run winner labels now preserve mixed results live
- Stand-up during showdown is now rejected and the player remains seated until hand end

## Findings

### QA-001

- ID: `QA-001`
- Title: Bomb pot cooldown survives `STAND_UP` and blocks re-seated proposer
- Status: `Not Reproduced`
- Severity: `High`
- Area: `engine / waiting-state bomb-pot flow`
- Reproduction:
  - Live scenario `bombpot_cooldown_leak`
  - Table `3QSSM6`
  - Alice proposes a bomb pot, Bob rejects, Alice stands up, Alice sits back down with the same session, Alice proposes again
- Expected:
  - Standing up should clear the old player id from bomb-pot cooldown tracking
- Actual:
  - The re-seated proposer could immediately open a fresh bomb-pot vote
- Evidence:
  - `/tmp/live-qa-targeted-3.json`
  - Scenario outcome: `Not Reproduced`
- Likely Source:
  - Fixed in [packages/engine/src/reducer.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/packages/engine/src/reducer.ts:540)
- Notes:
  - This was previously confirmed on an older build
  - Current branch filters `bombPotCooldown` on `STAND_UP` and clears stale vote state

### QA-002

- ID: `QA-002`
- Title: Multi-run aggregate winner hand label keeps only the first winning hand
- Status: `Not Reproduced`
- Severity: `Low`
- Area: `engine result aggregation / showdown display data`
- Reproduction:
  - Live scenario `multi_run_attempt_1`
  - Table `QYTP3G`
  - Three-run pre-flop all-in with unanimous `3x`
- Expected:
  - Mixed winning hand labels should survive in the aggregate winner record
- Actual:
  - The aggregate winner label was reported as `Straight / Two Pair / One Pair`
- Evidence:
  - `/tmp/live-qa-targeted-3.json`
  - Scenario outcome: `Needs More Evidence`
  - Live note: `Aggregate winner hand label was Straight / Two Pair / One Pair.`
- Likely Source:
  - Fixed in [packages/engine/src/reducer.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/packages/engine/src/reducer.ts:207)
- Notes:
  - This was previously confirmed on an older build
  - Current branch aggregates distinct hand labels instead of keeping only the first one

### QA-003

- ID: `QA-003`
- Title: Immediate bomb-pot all-in showdown never advances the public boards past the flop
- Status: `Confirmed`
- Severity: `High`
- Area: `party public state / showdown reveal timing / bomb-pot all-in`
- Reproduction:
  - Live scenario `bombpot_immediate_allin`
  - Table `35LNAK`
  - Two players each buy in for exactly the bomb-pot ante, approve a bomb pot, and start a hand that jumps straight to showdown
- Expected:
  - After the showdown timing window starts, both public bomb-pot boards should reveal to five cards
- Actual:
  - After a 12-second probe window, both public boards were still stuck at three cards
  - The public state already had `knownCardCountAtRunIt = 3` and `runDealStartedAt` populated, so the reveal timeline had started but follow-up broadcasts never surfaced turn and river
- Evidence:
  - `/tmp/live-qa-targeted-3.json`
  - Scenario outcome: `Blocked`
  - Final public state:
    - `communityCards.length = 3`
    - `communityCards2.length = 3`
    - `knownCardCountAtRunIt = 3`
    - `runDealStartedAt = showdownStartedAt`
- Likely Source:
  - [apps/web/src/party/index.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/apps/web/src/party/index.ts:966)
  - [apps/web/src/party/publicState.mjs](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/apps/web/src/party/publicState.mjs:1)
- Notes:
  - This is now strong enough to treat as confirmed because the live websocket state itself stayed stale after the reveal timer started
  - The current client-side showdown initialization fix preserves the correct starting count, but the server still is not broadcasting later reveal steps for this path

### QA-004

- ID: `QA-004`
- Title: Incomplete blind completion divergence was not reproduced in live probe
- Status: `Not Reproduced`
- Severity: `Informational`
- Area: `engine betting logic`
- Reproduction:
  - Live scenarios `blind_incomplete_raise` and `blind_incomplete_allin`
  - Focused four-player setup with a short big blind, one caller ahead, and a second actor completing via either `raise` or `all-in`
- Expected:
  - If the reported divergence is real, the re-open / re-queue result should differ between the two action types
- Actual:
  - The prior closed actor was re-queued in both variants
- Evidence:
  - `/tmp/live-qa-report.json`
- Likely Source:
  - If a narrower bug still exists, it likely lives around [packages/engine/src/reducer.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/packages/engine/src/reducer.ts:818)
- Notes:
  - Keep this on the watchlist because the live probe was focused, not exhaustive

### QA-005

- ID: `QA-005`
- Title: Basic ledger buy-in / cash-out mismatch was not reproduced
- Status: `Not Reproduced`
- Severity: `Informational`
- Area: `party ledger persistence / display derivation`
- Reproduction:
  - Live scenario `ledger_cycle`
  - Alice sits for `2000`, stands, sits for `3500`, plays a short hand, then stands again
- Expected:
  - `buyIns`, `cashOuts`, and `currentStack` should match the sit/stand sequence exactly
- Actual:
  - The ledger matched the sequence in this probe
- Evidence:
  - `/tmp/live-qa-report.json`
- Likely Source:
  - No confirmed defect from this narrow repro
- Notes:
  - This does not clear the broader NOTES.md suspicion completely

### QA-006

- ID: `QA-006`
- Title: Headless browser table smoke stayed on reconnect overlay
- Status: `Needs More Evidence`
- Severity: `Informational`
- Area: `frontend connection overlay / browser automation smoke`
- Reproduction:
  - Headless Chrome screenshots against persisted live tables
- Expected:
  - The table shell should hydrate into the live table scene
- Actual:
  - The screenshots stayed on the reconnect overlay
- Evidence:
  - `/tmp/qa-showdown.png`
  - `/tmp/qa-runit.png`
  - `/tmp/qa-bombpot-mobile.png`
  - `/tmp/qa-bombpot-allin-mobile.png`
- Likely Source:
  - Unclear; this may be headless-specific
- Notes:
  - Do not fix against this finding alone

### QA-007

- ID: `QA-007`
- Title: Seat changes are logged as cash-out and rebuy activity
- Status: `Confirmed`
- Severity: `Medium`
- Area: `client seat-change flow / ledger persistence / stats`
- Reproduction:
  - Live scenario `seat_change_ledger`
  - Table `T4B7ZK`
  - Alice sits for `2000`, changes seats, and the ledger is inspected immediately
- Expected:
  - A pure seat move should preserve one continuous seating session with no realized cash-out or new buy-in
- Actual:
  - The seat move recorded `buyIns = [2000, 2000]` and `cashOuts = [2000]`
- Evidence:
  - `/tmp/live-qa-targeted-3.json`
  - Scenario outcome: `Confirmed Issue`
- Likely Source:
  - [apps/web/src/store/useGameStore.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/apps/web/src/store/useGameStore.ts:688)
  - [apps/web/src/party/index.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/apps/web/src/party/index.ts:761)
  - [apps/web/src/lib/ledger.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/apps/web/src/lib/ledger.ts:3)
- Notes:
  - This likely explains at least part of the “buy in amounts are wrong sometimes” report in `NOTES.md`
  - The current client implements seat move as literal `STAND_UP` plus `SIT_DOWN`, so the server persists it as real money movement

## Current Branch Changes

- `STAND_UP` now clears bomb-pot cooldown and stale bomb-pot votes on the reducer path
- Multi-run aggregate winners now preserve distinct hand labels in the top-level display data
- Stand-up during showdown is now rejected as part of the broader “no stand-up mid-hand” rule
- The client keeps a showdown-time player snapshot so winner names and seat targets remain stable if player presence changes unexpectedly during showdown
- The live runner now captures `knownCardCountAtRunIt`, `runDealStartedAt`, and `showdownStartedAt`, plus dedicated scenarios for stand-up guarding and seat-change ledger pollution

## Leads Not Yet Confirmed

- The remaining open gameplay issue with the highest priority is the bomb-pot immediate all-in public reveal stall
- The incomplete-blind completion divergence may still exist in a narrower action order than the current probe exercised
- The headless reconnect overlay behavior still needs a normal browser repro before it should drive product work
