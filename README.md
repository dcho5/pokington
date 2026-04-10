# Pokington

A real-time multiplayer Texas Hold'em poker app for home games. Players share a link, sit down, and play — no accounts required. Supports up to 10 players per table with full cash game mechanics including blinds, side pots, and optional house rules.

**Features:** run-it-multiple-times · 7-2 offsuit bounty · bomb pots · turn timers · away status · per-player session ledger · responsive desktop and mobile layouts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript |
| Real-time | PartyKit (WebSocket server on Cloudflare Workers) |
| State | Zustand |
| Animation | Framer Motion |
| Styling | Tailwind CSS |
| Monorepo | pnpm workspaces + Turborepo |
| Deployment | Vercel (frontend) · Cloudflare (PartyKit) |

---

## Architecture

```
pokington/
├── apps/web/          # Next.js frontend (App Router)
├── packages/engine/   # @pokington/engine — pure game reducer, hand evaluator
└── packages/shared/   # @pokington/shared — shared types (Card, Rank, Suit, GamePhase)
```

The game is split into three concerns:

1. **Engine** (`packages/engine`) — a pure `gameReducer(state, event) → state` function with zero side effects. Handles all poker rules: betting rounds, side pot calculation, hand evaluation, run-it-multiple-times boards.

2. **Server** (`apps/web/src/party`) — a PartyKit WebSocket room that applies events against the engine, manages per-player private state (hole cards), and runs authoritative timers. Persists the session ledger in Durable Object storage.

3. **Client** (`apps/web`) — a Next.js app that holds game state in Zustand, renders a responsive poker table, and drives animations via Framer Motion.

---

## Engineering Highlights

### Authoritative server-side game logic
The engine reducer runs exclusively on the server. Clients send `GAME_EVENT` messages; the server applies them and broadcasts a `STATE` diff. Hole cards are sent per-player over individual `PRIVATE` messages — no opponent cards in the public state.

### Display-layer stack deferral
The engine awards chips immediately at showdown, but the UI needs time to animate them flying to the winner. Zustand tracks `showdownStartedAt` and a settled-run counter to compute a *display stack* that lags behind the engine stack until each animation completes. No visual conflicts with the source of truth.

### Deterministic run-it-multiple-times
When players go all-in and vote to run it 2 or 3 times, the engine deals multiple independent boards from a single deck snapshot and evaluates each run separately. Chip animations are sequenced per-run from a single `runDealStartedAt` timestamp, so they survive layout remounts (e.g. rotating from portrait to landscape mid-hand).

### Server-owned timers
Turn timers and voting timers fire on the server, not the client. This prevents clock skew, eliminates race conditions, and means a lagging or malicious client cannot stall the game.

### Responsive table layouts
`TableLayout` checks `useIsPortrait()` and renders either `DesktopTableLayout` (oval CSS layout with 10 seats at computed angles) or `MobileTableLayout` (5-zone fixed layout: header, opponent strip, community cards, hand panel, action bar). Both consume identical props; shared child components like `VotingPanel` accept a `variant` prop instead of being forked.

---

## Running Locally

**Prerequisites:** Node 18+, pnpm, PartyKit CLI

```bash
pnpm install
pnpm dev
```

This starts the Next.js dev server and the PartyKit backend in parallel via Turborepo.

To run the production build with Cloudflare tunnels (as used for actual home games):

```bash
./launch_poker.sh          # full build + tunnels
./launch_poker.sh --local  # full build, no tunnels
./launch_poker.sh --no-build --local  # skip build
```

The launch script builds a Next.js standalone binary, starts the PartyKit server, and opens two Cloudflare Quick Tunnels — one for the frontend and one for the WebSocket backend. The public URL is printed to stdout.
