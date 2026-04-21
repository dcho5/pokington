# QA Findings

Date: 2026-04-20

## Baseline

- `README.md` reviewed before live testing.
- Automated baseline:
  - `pnpm test`
  - Engine suite passed: `15/15`
  - Web suite passed: `78/80`
  - Pre-existing red tests: `apps/web/src/lib/desktopBetLayout.test.mjs`
- Live driver added at [scripts/live-qa.mjs](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/scripts/live-qa.mjs)
- Primary live evidence runs:
  - `node scripts/live-qa.mjs --json-out /tmp/live-qa-report.json`
  - `node scripts/live-qa.mjs --scenario bombpot,queue --json-out /tmp/live-qa-targeted.json`

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
- Basic ledger sit/stand cycle with multiple buy-ins

## Findings

### QA-001

- ID: `QA-001`
- Title: Bomb pot cooldown survives `STAND_UP` and blocks re-seated proposer
- Status: `Confirmed`
- Severity: `High`
- Area: `engine / waiting-state bomb-pot flow`
- Reproduction:
  - Live scenario `bombpot_cooldown_leak`
  - Table `YPJZ7Y`
  - Alice proposes a bomb pot, Bob rejects, Alice stands up, Alice sits back down with the same profile/session, Alice tries to propose again
- Expected:
  - Standing up should remove the old player id from the bomb-pot cooldown tracking so the re-seated player can propose normally
- Actual:
  - The re-seated player remained blocked from opening a new bomb-pot vote
  - `bombPotCooldown` still contained the old `playerSessionId`
- Evidence:
  - `/tmp/live-qa-report.json`
  - Scenario outcome: `Confirmed Issue`
  - Final state included `bombPotCooldown: ['player_400a2697789f4eb6']` while Alice was already re-seated
- Likely Source:
  - [packages/engine/src/reducer.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/packages/engine/src/reducer.ts:533)
  - `STAND_UP` removes the player from `players`, `needsToAct`, and `closedActors`, but not `bombPotCooldown`
- Notes:
  - This matched the user-provided lead and was confirmed against the live product

### QA-002

- ID: `QA-002`
- Title: Multi-run aggregate winner hand label keeps only the first winning hand
- Status: `Confirmed`
- Severity: `Low`
- Area: `engine result aggregation / showdown display data`
- Reproduction:
  - Live scenario `multi_run_attempt_1`
  - Table `U9LU8Z`
  - Three-run pre-flop all-in with unanimous `3x`
- Expected:
  - If a player wins multiple runs with different hand labels, the aggregate result should either preserve all labels or explicitly mark the aggregate as mixed
- Actual:
  - One winner took multiple runs with `Two Pair`, `Full House`, and `One Pair`
  - The top-level aggregate winner entry exposed only `Two Pair`
- Evidence:
  - `/tmp/live-qa-report.json`
  - Scenario outcome: `Confirmed Issue`
  - Aggregate evidence:
    - `distinctLabels: ['Two Pair', 'Full House', 'One Pair']`
    - `aggregateHand: 'Two Pair'`
- Likely Source:
  - [packages/engine/src/reducer.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/packages/engine/src/reducer.ts:196)
  - `handleShowdownMultiRun()` preserves only the first non-null hand label in the aggregate map
- Notes:
  - This appears display-only; chip awards still matched the live showdown totals

### QA-003

- ID: `QA-003`
- Title: Immediate bomb-pot all-in showdown did not surface public boards during live probe
- Status: `Needs More Evidence`
- Severity: `Medium`
- Area: `party public state / showdown reveal timing / bomb-pot all-in`
- Reproduction:
  - Live scenarios `bombpot_immediate_allin`
  - Tables `CCE47W` and `HVR9CJ`
  - Two players each buy in for exactly the bomb-pot ante, approve a bomb pot, start the hand, and immediately jump to split-board showdown
- Expected:
  - After the announcement/reveal window, both public bomb-pot boards should reveal through to five cards
- Actual:
  - The scripted clients stayed in `showdown`, but public `communityCards` and `communityCards2` remained empty through the probe window
  - The targeted rerun timed out waiting for both boards to reveal
- Evidence:
  - `/tmp/live-qa-report.json`
  - `/tmp/live-qa-targeted.json`
  - Scenario outcomes:
    - initial run: `Blocked`
    - targeted rerun: `Blocked`
  - Final targeted public state still showed `communityCards: []`, `communityCards2: []`, `runCount: 2`
- Likely Source:
  - Possibly the interaction between [apps/web/src/party/index.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/apps/web/src/party/index.ts:781), [apps/web/src/party/publicState.mjs](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/apps/web/src/party/publicState.mjs:1), and animated showdown timing when a bomb-pot hand jumps from `waiting` straight into `showdown`
- Notes:
  - This is not yet marked confirmed because the driver observed public-state symptoms, not a user-visible manual repro
  - Worth checking directly in the UI while watching websocket/state updates

### QA-004

- ID: `QA-004`
- Title: Incomplete blind completion divergence was not reproduced in live probe
- Status: `Not Reproduced`
- Severity: `Informational`
- Area: `engine betting logic`
- Reproduction:
  - Live scenarios `blind_incomplete_raise` and `blind_incomplete_allin`
  - Tables `QFNXAE` and `JSXHUE`
  - Four-player setup with a short big blind, one caller ahead, and a second actor completing either via `raise` to the full blind or `all-in` to the same total
- Expected:
  - If the user lead is correct, the `raise` and `all-in` completion paths should diverge around who is re-opened or re-queued
- Actual:
  - In the live probe, the prior closed actor was re-queued in both variants
- Evidence:
  - `/tmp/live-qa-report.json`
  - Divergence summaries:
    - raise variant: `requeued=true`
    - all-in variant: `requeued=true`
- Likely Source:
  - If a narrower bug still exists, it likely lives around [packages/engine/src/reducer.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/packages/engine/src/reducer.ts:733) and [packages/engine/src/reducer.ts](/Users/dcho5/Desktop/coding_projects.nosync/pokington_031326/packages/engine/src/reducer.ts:818)
- Notes:
  - This should stay on the watchlist because the live probe was focused, not exhaustive

### QA-005

- ID: `QA-005`
- Title: Basic ledger buy-in / cash-out mismatch was not reproduced
- Status: `Not Reproduced`
- Severity: `Informational`
- Area: `party ledger persistence / display derivation`
- Reproduction:
  - Live scenario `ledger_cycle`
  - Table `XHBL3M`
  - Alice sits for `2000`, stands, sits for `3500`, plays a short hand, then stands again
- Expected:
  - `buyIns`, `cashOuts`, and `currentStack` should match the exact sit/stand sequence
- Actual:
  - The ledger matched the sequence exactly in this probe:
    - `buyIns = [2000, 3500]`
    - `cashOuts = [2000, 3450]`
    - `currentStack = 0` after the final stand-up
- Evidence:
  - `/tmp/live-qa-report.json`
- Likely Source:
  - No confirmed defect from this repro
  - If the NOTES.md suspicion is real, it may require a more specific interaction between active-hand stack sync and ledger display
- Notes:
  - This does not clear the NOTES.md concern completely; it only says the simple cycle behaved correctly

### QA-006

- ID: `QA-006`
- Title: Headless browser table smoke stayed on reconnect overlay
- Status: `Needs More Evidence`
- Severity: `Informational`
- Area: `frontend connection overlay / browser automation smoke`
- Reproduction:
  - Headless Chrome screenshots against persisted live tables:
    - showdown table `BA3YUM`
    - run-it table `DJM5EZ`
    - bomb-pot mobile table `W5UNM2`
    - bomb-pot-all-in mobile table `HVR9CJ`
- Expected:
  - The table shell should hydrate into the live table scene
- Actual:
  - All headless screenshots stayed on the reconnect overlay
  - The mobile overlay also appeared clipped horizontally in the captured viewport
- Evidence:
  - `/tmp/qa-showdown.png`
  - `/tmp/qa-runit.png`
  - `/tmp/qa-bombpot-mobile.png`
  - `/tmp/qa-bombpot-allin-mobile.png`
- Likely Source:
  - Unclear
  - This may be an artifact of the headless environment rather than a product bug
- Notes:
  - Do not fix against this finding alone; verify in a normal browser session first

## Leads Not Yet Confirmed

- `NOTES.md` ledger bug note still needs a more targeted repro than the basic sit/stand cycle
- The immediate bomb-pot all-in reveal issue is the highest-priority open lead from this run
- The incomplete-blind completion divergence may still exist in a narrower action order than the live probe exercised
