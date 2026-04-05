# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# From repo root (preferred — Turbo rebuilds packages first)
pnpm dev              # start Next.js dev server
pnpm build            # production build

# From apps/web/ directly (packages must be pre-built)
npx next dev
npx tsc --noEmit      # type check; filter known Framer Motion noise:
npx tsc --noEmit 2>&1 | grep -v "is not assignable to type 'IntrinsicAttributes"
```

If you change anything in `packages/engine` or `packages/shared`, rebuild them before the web app picks up the changes:
```bash
cd packages/shared && pnpm build
cd packages/engine && pnpm build
```

## Import Paths

`tsconfig.json` sets `baseUrl` to `src/` — always use bare imports:
```ts
import { formatCents } from "lib/formatCents";   // ✓
import { formatCents } from "../../lib/formatCents"; // ✗
```

## Architecture

### State — single Zustand store (`src/store/useGameStore.ts`)

All game state lives here. The store wraps `@pokington/engine`'s pure `gameReducer` and adds UI-layer concerns.

**Direct state** (read from `state.*`): `gameState`, `viewingSeat`, `turnStartedAt`, `votingStartedAt`, `runDealStartedAt`, `showdownStartedAt`, `runAnnouncement`, `isRunItBoard`, `knownCardCountAtRunIt`, `streetPauseChips`, `streetSweeping`, `sevenTwoAnnouncement`, `bombPotAnnouncement`.

**Derived selectors** (call as functions): `getPlayers()`, `getCommunityCards()`, `getPot()`, `getWinners()`, `getCallAmount()`, `getMinRaise()`, `isViewerTurn()`, etc. These are cheap computations over `gameState` — no memoization, fine to call in render.

**Key timing constants** (module-level, not in state):
- `TURN_TIMEOUT_MS = 30_000`
- `VOTING_TIMEOUT_MS = 30_000`
- `STREET_PAUSE_MS = 1_200`
- `ANNOUNCEMENT_MS = 3_500`

**Side effects in `dispatch()`**: phase transitions start/clear timers, set `runAnnouncement`, set `runDealStartedAt`. Don't bypass `dispatch` to mutate state directly.

### Display defer pattern (`src/app/t/[code]/page.client.tsx`)

The engine assigns chips to `player.stack` immediately at showdown and zeroes `state.pot`. The display layer defers showing these updates until chip animations visually land:

```ts
// displayStack withholds wins from unsettled runs
displayStack = engineStack - Σ wins in runs [settledRunCount .. runResults.length-1]

// displayPot reconstructs from runResults (state.pot === 0 at showdown)
totalPot = Σ all run winner amounts
displayPot = totalPot - Σ settled run amounts
```

`settledRunCount` comes from `hooks/useSettledRunsCount.ts` (100ms poll from `showdownStartedAt`).

**Critical:** `runResults[r].winners` has one entry per side-pot per run — always use `filter().reduce()`, never `find()`, when summing a player's winnings per run.

### Layout split

`TableLayout.tsx` is a thin gate that checks `useIsPortrait()` and renders either `DesktopTableLayout` or `MobileTableLayout`. Both receive the same `TableLayoutProps`.

- **Desktop** (`desktop/DesktopTableLayout.tsx`): `aspect-[21/9]` oval with `overflow-hidden rounded-[97px]`. Multi-run card rows must be placed *outside* the surface div or they clip.
- **Mobile** (`mobile/MobileTableLayout.tsx`): Fixed full-screen, 5-zone layout (TableHeader / OpponentStrip / CommunityCards / HandPanel / ActionBar).

### Shared table components

Components under `src/components/Table/` use a `variant` or `compact` prop to gate layout-specific styling while sharing all logic. Prefer extending these over creating parallel implementations:

| Component | Variant prop | Purpose |
|---|---|---|
| `TimerBar` | `"turn" \| "voting"` | Countdown bar |
| `WinnerBanner` | `"desktop" \| "mobile"` | Winner display |
| `VotingPanel` | `"desktop" \| "mobile"` | Run-it vote UI |
| `SitDownForm` | `"dialog" \| "sheet"` | Sit-down form |
| `RunItBoard` | `compact?: boolean` | Multi-run community cards |

### Multi-run animation timing

Run-it card reveals are driven by a store timestamp (`runDealStartedAt`) so animation state survives layout remounts during portrait↔landscape switches.

`lib/runAnimation.ts` → `deriveRunAnimation(runDealStartedAt, knownCardCount, totalRuns)` returns `{ currentRun, revealedCount }`.

`revealedCount` is a **total card index threshold** (3, 4, or 5) — compare against card index `i`, not against `i - knownCardCount`.

Chip animation timing source of truth: `components/Table/desktop/WinnerChipsAnimation.tsx` (`ANNOUNCE_DELAY_S`, `CHIP_DURATION_S`, `getRunTimings`).

### Known Framer Motion type errors

The installed Framer Motion version produces spurious `Property 'className' does not exist on type 'IntrinsicAttributes & ... MotionProps'` errors across all `<motion.*>` usages. These are pre-existing and do not indicate real bugs. Filter them when checking for real errors:
```bash
npx tsc --noEmit 2>&1 | grep -v "is not assignable to type 'IntrinsicAttributes"
```

### Local testing

`src/app/t/[code]/DebugPanel.tsx` is a floating overlay that lets you switch the viewing seat, trigger actions for any player, manually cast votes, and resolve run-it voting. Use it instead of writing one-off scripts for manual testing.

## Key Utilities

- `lib/formatCents.ts` — `formatCents(n)` and `parseDollarsToCents(s)`; use everywhere money is displayed
- `lib/actionColors.ts` — `ACTION_COLORS_DESKTOP` (subtle) / `ACTION_COLORS_MOBILE` (bold) for last-action badges
- `lib/avatarColor.ts` — deterministic avatar color from player ID; must stay in sync with iOS `AvatarColor.swift`
- `lib/seatLayout.ts` — `computeSeatPosition` for desktop oval seat placement
- `hooks/useRaiseAmount.ts` — raise amount state, presets, clamp, increment; shared by desktop popover and mobile raise sheet
- `constants/game.ts` — `BLIND_OPTIONS`, `BOUNTY_OPTIONS`, `getBuyInPresets(bigBlindCents)`
