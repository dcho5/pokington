# Pokington

A real-time multiplayer Texas Hold'em poker app for home games. Players share a link, sit down, and play — no accounts required. Supports up to 10 players per table with full cash game mechanics including blinds, side pots, and optional house rules.

**Features:** run-it-multiple-times · 7-2 offsuit bounty · bomb pots · away status · per-player session ledger · responsive desktop and mobile layouts

---

## Table of Contents

- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Key Systems](#key-systems)
- [Directory Guide](#directory-guide)
- [Setup & Development](#setup--development)
- [Running Locally](#running-locally)
- [Testing & Validation](#testing--validation)
- [Deployment](#deployment)

---

## Repository Structure

This is a **pnpm workspaces + Turborepo monorepo** with three primary packages:

```
pokington/                     # Root monorepo
├── apps/
│   └── web/                  # Next.js 14 frontend + PartyKit WebSocket server
├── packages/
│   ├── engine/               # Pure game logic reducer & hand evaluator
│   └── shared/               # Shared TypeScript types and constants
├── scripts/                  # Automation scripts
│   ├── dev.mjs              # Multi-process dev launcher (PartyKit + Next.js)
│   └── live-qa.mjs          # Live QA automation
├── launch_poker.sh           # Production build + Cloudflare tunnels
├── turbo.json                # Turborepo task configuration
├── pnpm-workspace.yaml       # pnpm workspace root config
└── tsconfig.base.json        # Shared TypeScript configuration
```

### `apps/web` — Next.js Frontend + Real-time Server
- **Framework:** Next.js 14 (App Router)
- **State Management:** Zustand
- **Animations:** Framer Motion
- **Styling:** Tailwind CSS + PostCSS
- **Real-time:** PartyKit (WebSocket via Cloudflare Workers)

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Main game entry
│   │   ├── api/          # API routes
│   │   └── t/            # Tracing routes
│   ├── components/       # React components
│   │   ├── home/         # Landing page components
│   │   ├── poker/        # Game-specific components
│   │   └── Table/        # Table component hierarchy
│   ├── hooks/            # Custom React hooks
│   │   ├── useColorScheme.ts
│   │   ├── useIsMobileLayout.ts
│   │   ├── useIsPortrait.ts
│   │   ├── useRaiseAmount.ts
│   │   ├── useRunAnimationTicker.ts
│   │   ├── useSettledRunsCount.ts
│   │   ├── useTableActions.ts
│   │   ├── useTableRuntimeState.ts
│   │   └── useTableSceneModel.ts
│   ├── lib/              # Utilities & pure functions
│   │   ├── actionColors.ts
│   │   ├── avatarColor.ts
│   │   ├── desktopBetLayout.*   # Bet positioning (TypeScript + WASM)
│   │   ├── desktopTableLayout.* # Table layout calculations
│   │   ├── desktopSeatBadgeLayout.*
│   │   ├── showdownRevealState.* # Showdown UI state machine
│   │   ├── showdownUi.*           # Showdown UI logic
│   │   ├── holeCardReveal.*       # Reveal animations
│   │   ├── playerPositionMarkers.* # Position badge layout
│   │   ├── sitDownEligibility.*    # Sit-down validation
│   │   ├── desktopTableLayout.test.mjs
│   │   ├── feedback.test.mjs
│   │   ├── formatCents.ts
│   │   ├── ledger.ts
│   │   ├── party.ts
│   │   ├── phases.ts
│   │   ├── runAnimation.ts
│   │   ├── seatLayout.ts
│   │   ├── showdownTiming.ts
│   │   ├── showdownUi.test.mjs
│   │   └── [other layout & timing utilities]
│   ├── party/            # PartyKit WebSocket server
│   ├── store/            # Zustand stores
│   ├── types/            # App-specific TypeScript types
│   ├── constants/        # Game constants
│   │   └── game.ts
│   └── app/
│       ├── globals.css   # Global Tailwind styles
│       └── layout.tsx    # Root layout
├── public/               # Static assets
│   └── site.webmanifest
├── partykit.json         # PartyKit configuration
├── package.json
├── next.config.js
├── next-env.d.ts
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

### `packages/engine` — Game Logic Engine
Pure game reducer with no side effects. All poker rules, state transitions, and hand evaluation live here.

```
packages/engine/
├── src/
│   ├── reducer.ts        # Main gameReducer(state, event) → state
│   ├── evaluator.ts      # Hand evaluation & ranking
│   ├── deck.ts           # Deck & card utilities
│   ├── feedback.ts       # Game event feedback types
│   ├── showdownTiming.ts # Showdown timer calculations
│   ├── leaveQueue.ts     # Player leave queue logic
│   ├── types.ts          # Engine-specific types
│   └── index.ts          # Public exports
├── test/                 # Jest/Node test files
│   ├── reducer.test.mjs
│   ├── feedback.test.mjs
│   ├── leaveQueue.test.mjs
│   └── showdownTiming.test.mjs
├── package.json
└── tsconfig.json
```

### `packages/shared` — Shared Types
Core types and constants shared between engine and client.

```
packages/shared/
├── src/
│   └── index.ts          # Card, Suit, Rank, GamePhase enums & interfaces
├── package.json
└── tsconfig.json
```

### `scripts` — Automation
- `dev.mjs`: Launches PartyKit development server, waits for health check, then starts Next.js
- `live-qa.mjs`: Live QA test automation script

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Language** | TypeScript 5.0 | Type-safe game logic & UI |
| **Frontend** | Next.js 14 (App Router) | React framework with server components |
| **Real-time** | PartyKit + WebSocket | Multiplayer synchronization via Cloudflare Workers |
| **State** | Zustand | Client-side game state management |
| **UI Framework** | React 18 | Component library |
| **Animation** | Framer Motion 10 | Chip & card animations |
| **Styling** | Tailwind CSS 3.3 | Utility-first CSS |
| **PostCSS** | autoprefixer | CSS vendor prefixes |
| **Monorepo** | pnpm workspaces + Turborepo | Package management & task orchestration |
| **Testing** | Node test runner | Unit & integration tests (native Node.js) |
| **Deployment** | Cloudflare (PartyKit) | Edge computing & WebSocket hosting |
| **CLI** | Node.js scripts | Custom automation (dev launcher, QA) |

---

## Architecture

### High-Level Design

The application follows a **three-tier architecture**:

1. **Game Engine** (pure logic)
2. **WebSocket Server** (authoritative state + timers)
3. **React Client** (visual presentation + user input)

```
┌─────────────────────────────────────────┐
│        React Client (Browser)           │
│  • Zustand state store                  │
│  • Responsive table layout              │
│  • Framer Motion animations             │
│  • Input handling & validation          │
└──────────────┬──────────────────────────┘
               │ WebSocket (PartyKit)
               │ (GAME_EVENT, STATE, PRIVATE)
┌──────────────▼──────────────────────────┐
│    PartyKit Server (per-room)           │
│  • Applies game events to engine        │
│  • Manages private state (hole cards)   │
│  • Runs authoritative timers            │
│  • Broadcasts state diffs to clients    │
└──────────────┬──────────────────────────┘
               │ (pure function)
┌──────────────▼──────────────────────────┐
│   Game Engine (packages/engine)         │
│  • gameReducer(state, event) → state    │
│  • Hand evaluator                       │
│  • Pot & side pot calculation           │
│  • Betting round validation             │
│  • Run-it-multiple-times logic          │
└─────────────────────────────────────────┘
```

### Data Flow

1. **Player Action** → Client sends `GAME_EVENT` via WebSocket
2. **Server Receives** → PartyKit room receives message from player
3. **Validation & Reduction** → Server validates event, applies to engine reducer
4. **State Broadcast** → Server sends `STATE` diff to all clients (public state)
5. **Private State** → Server sends `PRIVATE` message to each player (hole cards, etc.)
6. **Client Update** → Zustand store updates, React re-renders
7. **Animation** → Framer Motion handles chip, card, and UI transitions

### Key Architecture Decisions

#### Authoritative Server-Side Game Logic
- Engine reducer runs **exclusively on the server**
- Clients **cannot** modify game state directly
- Hole cards sent per-player over `PRIVATE` messages — never in public state
- Prevents cheating, clock skew, and inconsistent state

#### Display-Layer Stack Deferral
The engine awards chips immediately at showdown, but animations need time:
- Engine state: stack updated instantly
- Display state: computed with `showdownStartedAt` timestamp + settled-run counter
- Display stack lags behind engine stack until animation completes
- No visual conflicts; source of truth unambiguous

#### Deterministic Run-It-Multiple-Times
When players go all-in and vote to run 2 or 3 times:
- Engine deals multiple boards from **single deck snapshot**
- Each run evaluated independently
- Animations sequenced per-run from `runDealStartedAt` timestamp
- Survives layout remounts (e.g., portrait → landscape mid-hand)

#### Server-Owned Timers
- Turn timers & voting timers fire **on the server**, not client
- Prevents clock skew, eliminates race conditions
- Lagging or malicious client cannot stall the game

#### Responsive Layouts Without Forking
- Single `TableLayout` component checks `useIsPortrait()` hook
- Renders `DesktopTableLayout` (oval CSS, 10 seats at computed angles) or `MobileTableLayout` (5-zone fixed)
- Shared children accept `variant` prop instead of code duplication

---

## Key Systems

### 1. Game Engine (`packages/engine/src/reducer.ts`)
The heart of the application. A pure reducer that processes game events and returns new state.

**Handles:**
- Blinds & ante calculations
- Betting rounds (pre-flop, flop, turn, river, showdown)
- Side pot calculation (multi-way pots, all-in situations)
- Hand evaluation & winner determination
- Run-it-multiple-times vote tracking & board generation
- Player leave queue & seat management

### 2. Hand Evaluator (`packages/engine/src/evaluator.ts`)
Determines hand rankings (high card → royal flush) and compares hands.

### 3. Party WebSocket Server (`apps/web/src/party/index.ts`)
PartyKit room that manages the game session.

**Responsibilities:**
- Accepts events from clients
- Applies them to game engine reducer
- Broadcasts public state to all clients
- Sends private state (hole cards) to individual players
- Runs server timers (turn timer, voting timer)
- Persists session & player ledger to Durable Object storage

**Sub-modules:**
- `playerSessionIdentity.mjs` — Session identity tracking
- `presenceTracking.mjs` — Online/offline player tracking
- `revealTracking.mjs` — Hole card reveal sequencing
- `peekTracking.mjs` — Peek/observe logic
- `publicState.mjs` — Constructs public state diff for broadcast
- `handBoundaryExit.mjs` — Hand end & cleanup logic
- `showdownRevealInit.mjs` — Showdown reveal initialization

### 4. Client State Management (`apps/web/src/store/`)
Zustand stores manage all client-side state:
- Game state (from server broadcasts)
- UI state (modals, animations, selections)
- Display stacks & animations
- Visibility & layout preferences

### 5. Layout & Positioning System
Deterministic layouts for table seats, bet chips, and badges.

**Key utilities:**
- `desktopTableLayout.*` — Oval table; computed seat angles & positions
- `desktopBetLayout.*` — Places bet chips visually on table
- `playerPositionMarkers.*` — Button, small blind, big blind badges
- `showdownRevealState.*` — State machine for sequential hole card reveal animations
- `seatLayout.ts` — Position calculations for 10-seat table

### 6. Animation System
Framer Motion drives all transitions.

**Components:**
- Card animations (flip, slide, reveal)
- UI transitions (modal fades, button states)
- Timer progress bars

### 7. Responsive Design
Mobile-first approach with two complete layouts:
- **Desktop:** Oval table with 10 seats at computed angles; spectator bar on side
- **Mobile:** 5 zones (header, opponent strip, community, hand, actions)

**Hooks:**
- `useIsPortrait()` — Detects portrait orientation
- `useIsMobileLayout()` — Detects mobile viewport
- `useColorScheme()` — Dark/light mode

---

## Directory Guide

### Core Game Logic
- `packages/engine/` — Pure reducer, hand evaluator, game rules
- `packages/shared/` — Card types, game phases, shared constants

### Frontend Application
- `apps/web/src/app/` — Next.js pages & layouts
- `apps/web/src/components/` — React components (home, poker, table)
- `apps/web/src/hooks/` — Custom React hooks (layout, animation, state)
- `apps/web/src/lib/` — Utility functions & calculations (layout, timing, feedback)
- `apps/web/src/party/` — PartyKit WebSocket server logic
- `apps/web/src/store/` — Zustand state stores
- `apps/web/src/types/` — App-specific TypeScript interfaces
- `apps/web/src/constants/` — Game constants

### Testing
- `packages/engine/test/` — Engine reducer & evaluator tests
- `apps/web/src/lib/*.test.mjs` — Layout & calculation tests
- `apps/web/src/party/*.test.mjs` — Server logic tests
- `apps/web/src/components/Table/*.test.mjs` — Component tests

### Configuration
- `turbo.json` — Turborepo task pipeline
- `tsconfig.base.json` — Root TypeScript config
- `pnpm-workspace.yaml` — pnpm workspace definition
- `apps/web/partykit.json` — PartyKit server config
- `apps/web/next.config.js` — Next.js config
- `apps/web/tailwind.config.ts` — Tailwind CSS config

### Deployment & Automation
- `launch_poker.sh` — Production launcher (build + tunnels)
- `scripts/dev.mjs` — Local development launcher
- `scripts/live-qa.mjs` — QA automation script

---

## Setup & Development

### Prerequisites
- **Node:** 18 or higher
- **pnpm:** 10.28.0+ (specified in root `package.json`)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pokington

# Install dependencies (all workspaces)
pnpm install

# Ensure TypeScript is available
pnpm typecheck
```

### Workspace Structure

This monorepo uses **pnpm workspaces** and **Turborepo**:
- `@pokington/engine` — Game logic library
- `@pokington/shared` — Shared types
- `@pokington/web` — Next.js + PartyKit

Each package has its own `package.json` and task scripts.

### Build Entire Monorepo

```bash
# Build all packages (respects Turborepo dependency graph)
pnpm build

# Rebuild specific package
pnpm -C packages/engine build
pnpm -C apps/web build
```

### Type Checking

```bash
# Typecheck all workspaces
pnpm typecheck

# Typecheck specific package
pnpm -C packages/engine typecheck
```

---

## Running Locally

### Quick Start

```bash
pnpm install
pnpm dev
```

This runs the custom dev launcher (`scripts/dev.mjs`) which:
1. Starts PartyKit WebSocket server on port **1999**
2. Waits for health check at `http://127.0.0.1:1999/parties/main/__control__/health`
3. Starts Next.js dev server on port **3000**
4. Opens your browser automatically

### Verify Real-time Backend

```bash
curl http://127.0.0.1:1999/parties/main/__control__/health
```

Expected response:
```json
{"ok":true,"roomId":"__control__","protocolVersion":2}
```

### Parallel Development

If you prefer direct Turborepo control:

```bash
pnpm dev:turbo
```

This starts both PartyKit and Next.js in parallel with Turborepo.

### Manual Server Start

```bash
# Terminal 1: PartyKit WebSocket server
cd apps/web && npm run party

# Terminal 2: Next.js frontend
cd apps/web && npm run dev
```

Then open `http://localhost:3000`.

---

## Testing & Validation

### Run All Tests

```bash
pnpm test
```

This runs:
- `packages/engine/test/*.test.mjs` — Game logic tests
- `apps/web/src/lib/*.test.mjs` — Utility function tests
- `apps/web/src/party/*.test.mjs` — Server logic tests

### Test Specific Package

```bash
# Engine tests
pnpm -C packages/engine test

# Web app tests
pnpm -C apps/web test
```

### Test Output
Tests use Node.js built-in test runner (no external frameworks required):
```bash
# Verbose output
node --test src/**/*.test.mjs --verbose
```

### Type Check Before Deploy

```bash
pnpm typecheck
```

---

## Deployment

### Local Production Build

Build a Next.js standalone app and run with tunnels:

```bash
# Full build + Cloudflare Quick Tunnels
./launch_poker.sh

# Full build, no tunnels (local only)
./launch_poker.sh --local

# Skip build (use previous binary)
./launch_poker.sh --no-build --local
```

The script:
1. Builds Next.js as standalone binary
2. Starts PartyKit server
3. Opens two Cloudflare Quick Tunnels (frontend + WebSocket backend)
4. Prints public URL to stdout

### Environment Variables

For local development, no special setup required. For production (Cloudflare):
- **Cloudflare Workers:** Deploy PartyKit server via `partykit deploy` (uses `partykit.json`)
- **Next.js Frontend:** Run as standalone server (see `launch_poker.sh` for production build)

### Build Output

```
apps/web/.next/standalone/  # Next.js server
apps/web/public/            # Static assets
```

----

## NPM Scripts Reference

### Root (`pokington/`)

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all workspace deps |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start dev (PartyKit + Next.js) |
| `pnpm dev:turbo` | Start dev with Turborepo (parallel) |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm test` | Run all tests |

### Engine (`packages/engine/`)

| Command | Purpose |
|---------|---------|
| `pnpm build` | Compile to `dist/` |
| `pnpm dev` | Watch-mode compilation |
| `pnpm test` | Run test suite |
| `pnpm typecheck` | Type-check only |

### Web (`apps/web/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server (port 3000) |
| `npm run party` | PartyKit dev server (port 1999) |
| `npm run build` | Build Next.js |
| `npm run start` | Run production server |
| `npm run test` | Run all tests |
| `npm run typecheck` | Type-check TypeScript |

---

## Quick Reference

### File Extensions in This Project
- `.ts` — TypeScript source
- `.tsx` — TypeScript + React JSX
- `.mjs` — ES modules (used for server code & tests)
- `.test.mjs` — Test files (Node.js test runner)
- `.d.ts` — Type declarations (auto-generated)

### Key Ports
- `3000` — Next.js frontend
- `1999` — PartyKit WebSocket server

### Key Configuration Files
- `turbo.json` — Build task dependencies
- `pnpm-workspace.yaml` — Workspace roots
- `tsconfig.base.json` — TypeScript compiler options
- `partykit.json` — PartyKit deployment config
- `next.config.js` — Next.js options
- `tailwind.config.ts` — Tailwind CSS theme

---

## Architecture Diagram

```
User Browser (Port 3000)
    ↓
[Next.js React App]
├─ Zustand Store (client-side game state)
├─ Table Components (desktop + mobile)
├─ Framer Motion (animations)
└─ PartySocket (WebSocket client)
    ↓ (WebSocket)
Cloudflare Workers / Local Dev (Port 1999)
    ↓
[PartyKit Room]
├─ Message routing
├─ Private state (hole cards)
├─ Timer management
└─ Durable Object storage (ledger)
    ↓
[Game Engine Reducer]
├─ Blind calculations
├─ Betting logic
├─ Hand evaluation
├─ Pot distribution
└─ Run-it-multiple-times
```

---

## Contributing & Development Workflow

1. **Make changes** — Edit TypeScript files in `apps/web/src/` or `packages/engine/src/`
2. **Type-check** — `pnpm typecheck` catches errors before running
3. **Test locally** — `pnpm dev` starts the full stack
4. **Run tests** — `pnpm test` validates logic
5. **Build** — `pnpm build` compiles all packages
6. **Deploy** — Use `launch_poker.sh` for production builds, deploy PartyKit to Cloudflare

---

## Summary

Pokington is a production-grade multiplayer poker platform built with:
- **Monorepo structure** (pnpm + Turborepo) for shared code
- **Pure game engine** with deterministic logic
- **Real-time WebSocket** server (PartyKit on Cloudflare)
- **Responsive React UI** (desktop & mobile)
- **Comprehensive testing** of game logic & layouts
- **Deployment automation** (Cloudflare + Cloudflare tunnels)

The architecture prioritizes **correctness** (authoritative server, deterministic rules), **performance** (display-layer deferral, optimized animations), and **user experience** (responsive layouts, smooth animations, instant feedback).
