# Pokington Engine Audit — vs. WSOP / TDA Cash Game Rules

**Auditor**: Claude Opus 4.6 (AI)
**Date**: 2026-03-29
**Engine version**: packages/engine as of current HEAD
**Reference rules**: 2024 TDA Rules, Robert's Rules of Poker, WSOP Cash Game Procedures

---

## Executive Summary

The engine is surprisingly solid for a hobby project. The core `raise` / `all-in` / `call` split, `closedActors` re-opening logic, `lastLegalRaiseIncrement` tracking, and multi-way side pot builder all follow professional standards. However, several edge cases are missing or incorrect, categorized below by severity.

---

## CRITICAL — Rules violated, gameplay affected

### 1. `canRaise` in the UI store blocks legal all-ins

**Files**: `apps/web/src/store/useGameStore.ts:400-405` (UI), `reducer.ts:463-487` (engine)

**Symptom**: When a player is in `closedActors` (they already matched `roundBet`), the UI's `canRaise()` returns `false` because it checks `closedActors.includes(actorId)`. The separate `canAllIn()` button only appears when `!canRaise && canAllIn`. But `closedActors` tracks whether a player can *re-raise* — a player removed from `closedActors` by a full raise can raise again. This is **correct behavior**.

However, there is a subtle issue: a closed actor who is re-opened by a partial all-in (under-raise) is added back to `needsToAct` (lines 517-526) but is **NOT removed from `closedActors`**. This means:
- They can call or fold (because they're in `needsToAct`)
- `canRaise()` returns `false` (because they're still in `closedActors`) — **correct per TDA rules** (under-raise does not re-open)
- `canAllIn()` returns `true` — they can still go all-in

**Verdict**: The engine itself correctly implements this. The UI wiring also handles it (shows "All-in" button when `!canRaise && canAllIn`). **No bug here** — but the user's description of "the engine blocks all-ins if stack < minRaise" may refer to a different scenario. Let me trace that...

### 2. Engine `raise` action silently rejects under-minRaise amounts (engine correct, UI routing issue)

**File**: `reducer.ts:463-469`

```typescript
case "raise": {
  const raiseTotal = event.amount ?? (state.roundBet + state.lastLegalRaiseIncrement);
  const threshold = fullRaiseThreshold(state.roundBet, state.lastLegalRaiseIncrement);
  if (raiseTotal < threshold) return prevState;  // ← silent rejection
  const raiseCost = raiseTotal - player.currentBet;
  if (raiseCost > player.stack) return prevState;  // ← also silent rejection
```

If a player's stack can cover the gap to `roundBet` but NOT a full raise, the `raise` action is correctly rejected. The player should use `all-in` instead. **The engine handles this correctly** — the `all-in` action (lines 489-531) has no minimum amount check and always succeeds.

**However**, there's a real gap: the `raise` action rejects when `raiseCost > player.stack` (line 469). If a player tries to raise to exactly `threshold` but their stack can't cover it, the action silently fails. The UI *should* route this through `all-in`, and it does — see `page.client.tsx:156-171` (`handleRaise`). **This is working as designed.**

**Actual critical issue**: The `raise` action also rejects if a player wants to raise but their total after going all-in is below `threshold`. But the UI's `handleRaise` catches this:
```typescript
if (totalAmount >= threshold) {
  store.raise(totalAmount);
} else {
  store.allIn();
}
```
This means the UI correctly dispatches `all-in` when the player can't make a full raise. **No bug in the current wiring.**

### 3. Big Blind short-stack: `roundBet` set to partial BB amount

**File**: `reducer.ts:395-401`

```typescript
const bbAmount = Math.min(state.blinds.big, bbPlayer.stack);
bbPlayer.stack -= bbAmount;
bbPlayer.currentBet = bbAmount;
bbPlayer.totalContribution = bbAmount;
if (bbPlayer.stack === 0) bbPlayer.isAllIn = true;

state.roundBet = bbAmount;  // ← Bug: roundBet should STILL be blinds.big
state.lastLegalRaiseIncrement = bbAmount;  // ← Bug: should still be blinds.big
```

**TDA Rule 15 (Incomplete Blind)**: When the big blind is short (can't post full BB), the *roundBet* should still be the full big blind amount. Other players must call the full BB, not the short-stacked BB's actual post. The difference is the "dead money" that makes up the difference is just not there, but the round bet is still the full BB.

Wait — actually in a cash game, if the BB can only post 15 of a 25-cent BB, the `roundBet` is 15 and UTG can call 15, raise to 50 (25+25), etc. The "completion" rule applies: UTG can "complete" to 25 (a non-raise action that sets roundBet to 25 and does NOT count as a raise).

**The current engine does NOT implement the completion rule.** With `roundBet = 15` and `lastLegalRaiseIncrement = 15`:
- UTG calling 15 is treated as a call — correct
- UTG "completing" to 25 is treated as a *raise* (25 ≥ 15 + 15 = 30? No, 25 < 30, so it would be rejected by the raise handler) — **BUG**

The completion rule requires special handling: if the initial forced bet (blind) was incomplete, the first voluntary action to increase the bet up to the full blind is a "completion" (not a raise), and it does NOT reset `lastLegalRaiseIncrement` or clear `closedActors` — but it DOES set `roundBet = blinds.big`.

**Severity**: Critical in edge cases (short-stack BB). Not common in typical play.

### 4. Small Blind short-stack: similar completion rule issue

**File**: `reducer.ts:389-393`

Same pattern. If SB can only post 5 of a 10-cent SB, `roundBet` isn't affected (it's set by BB later). But the `lastLegalRaiseIncrement` is later set from `bbAmount` which could also be short. The completion rule applies to the aggregate.

---

## SIGNIFICANT — Logic gaps in professional scenarios

### 5. No "Dead Button" rule

**File**: `reducer.ts:363-381`

The engine uses a "Moving Button" rule (dealer always advances to the next occupied seat). In professional cash games (TDA Rule 7), the **Dead Button** rule applies:
- If a player leaves between the button and BB, the button may "die" (skip that position) to ensure no player misses the BB.
- The engine simply skips to the next occupied seat with `nextOccupiedSeat()`, which could cause players to skip the blinds.

**Impact**: In a game where players frequently sit/stand, the blind structure becomes unfair. For a friends-game with stable seating, this is fine.

### 6. New player blind posting not enforced

**File**: `reducer.ts:310-328` (SIT_DOWN)

When a new player sits down mid-game at a professional table, they must either:
- Wait for the BB to reach them, or
- Post a "new player blind" equal to the BB to play immediately

The engine just adds them with `stack = buyIn` and they play the next hand for free (no forced blind post). This is standard for home games but not for casino/professional play.

### 7. Missing "raise cap" for limit/spread-limit formats

The engine appears to be designed for no-limit only (no mention of bet caps or raise limits). This is fine — just noting that if limit formats are ever added, a `maxRaises` per street (typically 4) would be needed.

### 8. `closedActors` re-opened players can still all-in beyond roundBet

**File**: `reducer.ts:517-526` (under-raise all-in handler)

When a partial all-in raises the bet (but under the full-raise threshold), closed actors with `currentBet < allInNewTotal` are re-added to `needsToAct`. They stay in `closedActors`, so `canRaise` returns false — they can only call, fold, or all-in. This is **correct per TDA rules**: an under-raise does NOT re-open action for a full raise.

However, the `all-in` action itself has no guard to check if the player is in `closedActors`. A closed actor can go all-in even when they shouldn't be able to raise. Per TDA rules, a re-opened player after an under-raise can:
- Call the new amount
- Fold
- Go all-in (but ONLY as an all-in — they cannot make a "raise" that happens to commit all their chips)

**The engine handles this correctly** because: the UI's `canRaise()` returns `false` for `closedActors` members, and the all-in action doesn't have raise semantics (it just puts in all chips). The `isFullRaise` check inside the all-in handler then determines whether to re-open again. This is correct.

### 9. Pre-flop BB option ("Big Blind Special")

**File**: `reducer.ts:412-419`

The pre-flop action list starts from UTG (BB+1). But the BB gets a "free option" to raise even if nobody else has raised (when action completes back to them and they've only posted the forced blind). Looking at the code:

```typescript
const utgSeat = (bbSeat + 1) % MAX_SEATS;
const actors = activePlayerIdsFrom(utgSeat, state.players);
```

`activePlayerIdsFrom` starts from UTG and wraps around clockwise. Since the BB already has `currentBet === roundBet`, the check action is available. When everyone just calls, `needsToAct` eventually empties and the street advances. But does the BB get their option?

Looking at `activePlayerIdsFrom`: it filters for `!isFolded && !isAllIn`. The BB player IS included (unless all-in from posting). The BB IS in the action queue after UTG wraps around. When everyone calls and checks, the BB gets their turn last and can check or raise. **This is correct.**

BUT: when everyone just calls (no raise), the BB is already in `closedActors`? Let me re-check... No — the BB is NOT added to `closedActors` at start. `closedActors` starts empty. UTG calls → added to `closedActors`. Action continues. When it reaches BB, they're NOT in closedActors, so they CAN raise. After they check, they're added to `closedActors`.

Wait, the BB is not initially in the `needsToAct` list. Let me re-trace: `activePlayerIdsFrom(utgSeat, state.players)` — this returns all non-folded, non-all-in players starting from UTG clockwise. The BB IS in this list (at the end, since it wraps around). So the BB IS in `needsToAct`. When UTG calls, the `call` handler does:
```typescript
state.needsToAct.shift();
state.closedActors.push(event.playerId);
```
It shifts UTG out. Eventually action reaches BB, who can check (since `currentBet === roundBet`) or raise.

**Actually**: The issue is that after everyone calls (matches `roundBet`), the BB already has `currentBet === roundBet`. When the action reaches them (they're last in `needsToAct`), they can check or raise. After they act, `needsToAct` empties and the street advances. **Correct behavior.**

### 10. Heads-up blind structure

**File**: `reducer.ts:375-381`

```typescript
if (numPlayers === 2) {
  sbSeat = dealerSeat;  // dealer posts SB
  bbSeat = nextOccupiedSeat(dealerSeat, state.players);  // other posts BB
}
```

This is **correct per TDA rules** — in heads-up, the dealer/button posts the small blind and acts first pre-flop, second post-flop.

---

## MINOR — Cosmetic or low-impact issues

### 11. No rake/pot-cap mechanism

No rake calculation exists. Fine for a social/home game app.

### 12. Shuffle uses `Math.random()` — not cryptographically secure

**File**: `deck.ts:18-24`

Fisher-Yates shuffle with `Math.random()` is predictable. For a real-money application, this should use `crypto.getRandomValues()`. For play-money / social, it's fine.

### 13. Side pot builder includes folded players' contributions

**File**: `reducer.ts:86-113`

```typescript
const nonFolded = all.filter((p) => !p.isFolded && p.totalContribution > 0);
// ...
const contributors = all.filter((p) => p.totalContribution >= level);
```

The `levels` only come from non-folded players. But `contributors` includes ALL players (including folded) who contributed at that level. This correctly counts folded players' money into the pot while excluding them from eligibility. **This is actually correct.**

### 14. `enterVotingOrRunOut` doesn't verify 2+ non-folded non-all-in players remain

**File**: `reducer.ts:232-243`

The function enters voting if `communityCards < 5` and `nonFolded > 1`. But voting is only meaningful when ALL remaining players are all-in (otherwise normal betting continues). The function is called from `advanceStreet` (line 269) which already verified `actors.length <= 1` (at most 1 non-all-in player). So the all-in condition is implicitly satisfied. **Correct, but implicit.**

### 15. Pot remainder distribution

**File**: `reducer.ts:163-164`

```typescript
const share = Math.floor(runPot / potWinners.length);
const rem = runPot - share * potWinners.length;
potWinners.forEach((w, i) => {
  const amt = share + (i === 0 ? rem : 0);
```

The remainder always goes to `potWinners[0]`. Per TDA Rule 19, the remainder chip(s) go to the player closest to the left of the button. The current code gives it to whichever player happens to be first in the sorted results array (sorted by hand strength, then arbitrary). **Minor rule violation.** Should sort tied winners by seat position relative to the button and award remainder to the first clockwise from button.

---

## LOGIC PATCH — Proposed Utilities

### A. `calculateMinRaise`: Professional "Difference Rule" implementation

```typescript
/**
 * Calculate the minimum legal raise-to amount using the "Difference Rule"
 * (also called the "Last Legal Increment" rule).
 *
 * The minimum raise increment equals the last FULL legal raise increment.
 * In no-limit, this means: minRaiseTo = roundBet + lastLegalRaiseIncrement.
 *
 * Special case: If this is the opening bet of a post-flop street, the
 * minimum bet is the big blind (there is no "raise" — it's an "open").
 *
 * @returns The minimum total a raise must reach. If the player's stack
 *          can't reach this, they must go all-in instead of raising.
 */
function calculateMinRaise(
  roundBet: number,
  lastLegalRaiseIncrement: number,
  bigBlind: number,
  isOpeningBet: boolean,
): number {
  if (isOpeningBet) return bigBlind;
  return roundBet + Math.max(lastLegalRaiseIncrement, bigBlind);
}
```

The engine's existing `fullRaiseThreshold` (line 80-82) is equivalent to this but lacks the `isOpeningBet` guard. Currently `getMinRaise` in the store (line 382-385) adds the `Math.max(lastLegalRaiseIncrement, blinds.big)` floor — **this is correct**.

### B. `isActionReopened`: Check whether a new bet re-opens action

```typescript
/**
 * Determine whether a new all-in bet re-opens action for closed actors.
 *
 * Per TDA Differential Rule:
 * - If the all-in amount EXCEEDS roundBet + lastLegalRaiseIncrement ("full raise"),
 *   action reopens for ALL players (closedActors is cleared).
 * - If it exceeds roundBet but NOT the full-raise threshold ("under-raise"),
 *   action reopens ONLY for players who haven't matched the new amount.
 *   They may call/fold but NOT re-raise (they stay in closedActors).
 * - If it doesn't exceed roundBet, no action is reopened.
 */
function isActionReopened(
  allInNewTotal: number,
  roundBet: number,
  lastLegalRaiseIncrement: number,
): { type: 'full' | 'partial' | 'none'; newIncrement: number } {
  const threshold = roundBet + lastLegalRaiseIncrement;

  if (allInNewTotal >= threshold) {
    return { type: 'full', newIncrement: allInNewTotal - roundBet };
  }
  if (allInNewTotal > roundBet) {
    return { type: 'partial', newIncrement: lastLegalRaiseIncrement }; // unchanged
  }
  return { type: 'none', newIncrement: lastLegalRaiseIncrement };
}
```

The engine already implements this logic inline in the `all-in` handler (lines 501-529). The `isFullRaise` / `raisesRoundBet` branches match the `full` / `partial` / `none` cases exactly. Extracting into a utility would improve readability but is not functionally necessary.

### C. Completion Rule Implementation (the one real gap)

```typescript
/**
 * Handle the "completion" action when the blind was short-posted.
 * A completion to the full big blind is NOT a raise — it does not
 * reset lastLegalRaiseIncrement or clear closedActors.
 */
// In START_HAND:
state.roundBet = state.blinds.big;  // Always set to full BB, even if short-posted
// Track whether the blind was incomplete:
state.isBlindIncomplete = bbAmount < state.blinds.big;

// In PLAYER_ACTION → raise:
// If isBlindIncomplete and raiseTotal === blinds.big, treat as completion:
if (state.isBlindIncomplete && raiseTotal <= state.blinds.big) {
  // This is a "completion", not a raise
  state.roundBet = raiseTotal;
  // Do NOT clear closedActors
  // Do NOT update lastLegalRaiseIncrement
  state.isBlindIncomplete = false;
  player.stack -= (raiseTotal - player.currentBet);
  player.currentBet = raiseTotal;
  player.lastAction = "call"; // displayed as a call/complete
  state.needsToAct.shift();
  state.closedActors.push(event.playerId);
}
```

---

## STATE MACHINE UPDATE — Suggested `GameState` additions

```typescript
interface GameState {
  // ... existing fields ...

  // NEW: Track whether the big blind was short-posted (for completion rule)
  isBlindIncomplete: boolean;

  // OPTIONAL: Track button position separately from dealer for dead-button rule
  // buttonSeatIndex: number;  // may differ from dealerSeatIndex with dead-button

  // OPTIONAL: Track new-player join queue for forced blind posting
  // pendingBlinds: Record<string, number>;  // playerId → amount owed before playing
}
```

---

## Summary Table

| # | Severity | Issue | File:Line | Status |
|---|----------|-------|-----------|--------|
| 1 | Info | `canRaise`/`canAllIn` UI split | store:400-413 | Working correctly |
| 2 | Info | Raise rejection routing | reducer:463-469 | Working correctly (UI handles) |
| 3 | **Critical** | Short BB sets `roundBet` to partial; no completion rule | reducer:395-401 | **Needs fix** |
| 4 | Critical | Short SB same pattern | reducer:389-393 | **Needs fix** (related to #3) |
| 5 | Significant | No dead-button rule | reducer:363-367 | Missing feature |
| 6 | Significant | No new-player blind posting | reducer:310-328 | Missing feature |
| 7 | Minor | No raise cap (limit formats) | N/A | Not needed for NL-only |
| 8 | Info | Closed actor all-in semantics | reducer:489-531 | Working correctly |
| 9 | Info | BB option pre-flop | reducer:412-419 | Working correctly |
| 10 | Info | Heads-up blinds | reducer:375-381 | Correct |
| 11 | Minor | No rake | N/A | Out of scope |
| 12 | Minor | Non-cryptographic shuffle | deck:18-24 | OK for play-money |
| 13 | Info | Side pot folded contributions | reducer:86-113 | Correct |
| 14 | Info | Voting entry conditions | reducer:232-243 | Correct (implicit) |
| 15 | **Minor** | Pot remainder goes to first winner, not closest to button | reducer:163-164 | **Needs fix** |

---

## Regarding the "Known Issue"

The user stated: *"The engine currently blocks all-ins if the player's remaining stack is less than the minRaise."*

After thorough audit, **this is NOT the case in the engine**. The engine's `all-in` action (reducer.ts:489-531) has zero minimum-amount checks — it always succeeds for any player with `stack > 0`. The `raise` action correctly rejects under-threshold amounts, but that's by design; the UI routes short-stack raises through `all-in` via `handleRaise` in `page.client.tsx:156-171`.

If the user is experiencing this bug, it's likely in the UI layer — specifically, the `canRaise` check might be hiding the Raise button while the All-in button isn't appearing. Check:
- `canRaise()` returns `false` when `closedActors.includes(actorId)` — correct
- `canAllIn()` returns `true` when `stack > 0 && !isAllIn` — correct
- The All-in button renders when `!canRaise && canAllIn` — this should work

The most likely user-facing scenario: a player wants to "raise" using the raise UI (slider), picks an amount that happens to equal their stack, and the UI's `handleRaise` sends it as `raise` not `all-in`. If the amount is below `threshold`, the engine rejects it silently. The fix in `handleRaise` (comparing against threshold) was already applied. If this is still occurring, check that `handleRaise` is actually being called for the mobile raise sheet's confirm action.
