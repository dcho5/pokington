"use client";
import { create } from "zustand";
import PartySocket from "partysocket";
import {
  createInitialState,
  type GameEvent,
  type WinnerInfo,
  type RunResult,
  type SevenTwoBountyBB,
  type BombPotAnteBB,
} from "@pokington/engine";
import type { Card } from "@pokington/shared";
import {
  toPublicGameState,
  type PublicGameState,
  type PublicEnginePlayer,
  type ServerMessage,
  type LedgerEntry,
  type LedgerRow,
  type PayoutInstruction,
} from "party/types";

// ── UI-facing player shape ──
export interface UIPlayer {
  id: string;
  name: string;
  stack: number;
  seatIndex: number;
  isAdmin?: boolean;
  isYou?: boolean;
  isCurrentActor?: boolean;
  currentBet?: number;
  isFolded?: boolean;
  isAllIn?: boolean;
  lastAction?: string | null;
  hasCards?: boolean;
  isSittingOut?: boolean;
  peekedCount?: number;
  /** Hole cards — populated for revealed opponents at showdown (null slot = card not revealed) */
  holeCards?: [Card | null, Card | null] | null;
  handLabel?: string;
  isAway?: boolean;
}

interface GameStore {
  // Core game state (public — no deck, no opponent hole cards)
  gameState: PublicGameState;

  // Connection / identity
  myUserId: string | null;
  myPlayerId: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected";
  isCreator: boolean;

  // Private hole cards received from server
  myHoleCards: [Card, Card] | null;
  revealedHoleCards: Record<string, [Card | null, Card | null]>; // other players' cards revealed at showdown
  myRevealedCardIndices: Set<0 | 1>; // which of my cards I've revealed to others this hand
  tableNotFound: boolean;

  // UI timing
  viewingSeat: number;
  turnStartedAt: number | null;
  votingStartedAt: number | null;

  // Chip sweep animation
  streetPauseChips: { id: string; seatIndex: number; amount: number }[] | null;
  streetSweeping: boolean;

  turnTimerEnabled: boolean;
  runAnnouncement: 1 | 2 | 3 | null;
  isRunItBoard: boolean;
  knownCardCountAtRunIt: number;
  runDealStartedAt: number | null;
  showdownStartedAt: number | null;
  sevenTwoAnnouncement: { winnerName: string; perPlayer: number; total: number } | null;
  bombPotAnnouncement: { anteBB: number; anteCents: number } | null;

  // Actions
  connect: (tableCode: string) => void;
  disconnect: () => void;
  sendEvent: (event: GameEvent) => void;
  sitDown: (seatIndex: number, name: string, buyInCents: number) => void;
  standUp: () => void;
  queueLeave: () => void;
  leaveQueued: boolean;
  changeSeat: (newSeatIndex: number) => void;
  startHand: () => void;
  fold: () => void;
  check: () => void;
  call: () => void;
  raise: (totalAmount: number) => void;
  allIn: () => void;
  voteRun: (count: 1 | 2 | 3) => void;
  resolveVote: () => void;
  showCards: () => void;
  revealCard: (cardIndex: 0 | 1) => void;
  peekCard: (cardIndex: 0 | 1) => void;
  setSevenTwoBounty: (bountyBB: SevenTwoBountyBB) => void;
  debugSetHoleCards: (playerId: string, cards: [Card, Card]) => void;
  setViewingSeat: (seat: number) => void;
  proposeBombPot: (anteBB: BombPotAnteBB) => void;
  voteBombPot: (approve: boolean) => void;

  getTurnElapsedMs: () => number;

  // Derived selectors
  getPlayers: () => (UIPlayer | null)[];
  getViewingPlayer: () => PublicEnginePlayer | null;
  getHoleCards: () => [Card, Card] | null;
  getHandStrength: () => string | null;
  getCommunityCards: () => Card[];
  getPot: () => number;
  getTotalPotWithBets: () => number;
  getPhase: () => PublicGameState["phase"];
  getWinners: () => WinnerInfo[] | null;
  getRunItVotes: () => Record<string, 1 | 2 | 3>;
  getRunCount: () => 1 | 2 | 3;
  getRunResults: () => RunResult[];
  getCurrentActorId: () => string | null;
  isViewerTurn: () => boolean;
  getSevenTwoBountyBB: () => SevenTwoBountyBB;
  getVoluntaryShownPlayerIds: () => string[];
  getSevenTwoBountyTrigger: () => PublicGameState["sevenTwoBountyTrigger"];
  getCallAmount: () => number;
  getMinRaise: () => number;
  canCheck: () => boolean;
  canRaise: () => boolean;
  canAllIn: () => boolean;
  isFirstBet: () => boolean;
  getRoundBet: () => number;
  getHandNumber: () => number;
  getViewerStack: () => number;
  isViewerAdmin: () => boolean;
  setTurnTimerEnabled: (enabled: boolean) => void;
  toggleTimer: (enabled: boolean) => void;
  getBombPotVote: () => PublicGameState["bombPotVote"];
  getBombPotNextHand: () => PublicGameState["bombPotNextHand"];
  isBombPotHand: () => boolean;
  getCommunityCards2: () => Card[];
  getBombPotCooldown: () => string[];

  // Session ledger
  ledger: LedgerEntry[];
  getLedgerRows: () => LedgerRow[];
  getPayoutInstructions: () => PayoutInstruction[];

  // Away status
  awayPlayerIds: string[];

  // Peek tracking (how many cards each player has peeked at)
  peekedCounts: Record<string, number>;

  // First-state guard (prevents animation replay on page reload)
  isFirstStateReceived: boolean;
}

const TOTAL_SEATS = 10;
const STREET_PAUSE_MS = 1200;
const SWEEP_DURATION_MS = 450;
const ANNOUNCEMENT_MS = 3500;

// Module-level — not reactive state
let _socket: PartySocket | null = null;
let _visibilityHandler: (() => void) | null = null;
let _idleCleanup: (() => void) | null = null;
let sevenTwoAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;
let bombPotAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;

// getPlayers() memoization cache — returns stable references when inputs haven't changed
let _cachedPlayers: (UIPlayer | null)[] = Array(TOTAL_SEATS).fill(null);
let _cachedPlayersKey = "";

function playersKey(s: {
  gameState: PublicGameState;
  viewingSeat: number;
  myPlayerId: string | null;
  isCreator: boolean;
  streetPauseChips: { id: string; seatIndex: number; amount: number }[] | null;
  revealedHoleCards: Record<string, [Card | null, Card | null]>;
  awayPlayerIds: string[];
  peekedCounts: Record<string, number>;
}): string {
  const gs = s.gameState;
  const players = Object.values(gs.players);
  // Build a fingerprint of all inputs that affect getPlayers() output
  let key = `${gs.phase}|${gs.needsToAct[0] ?? ""}|${s.viewingSeat}|${s.myPlayerId}|${s.isCreator}|`;
  key += s.awayPlayerIds.join(",") + "|";
  key += JSON.stringify(s.peekedCounts) + "|";
  if (s.streetPauseChips) key += s.streetPauseChips.map(c => `${c.id}:${c.amount}`).join(",");
  key += "|";
  for (const p of players) {
    key += `${p.id}:${p.seatIndex}:${p.stack}:${p.currentBet}:${p.isFolded}:${p.isAllIn}:${p.lastAction}:${p.hasCards}:${p.sitOutUntilBB}|`;
  }
  // Include revealed hole cards for showdown
  if (gs.phase === "showdown") {
    for (const [id, cards] of Object.entries(s.revealedHoleCards)) {
      key += `${id}:${cards[0]?.rank ?? ""}${cards[0]?.suit ?? ""}-${cards[1]?.rank ?? ""}${cards[1]?.suit ?? ""}|`;
    }
  }
  // Include winners for uncontested detection
  if (gs.winners) {
    key += gs.winners.map(w => `${w.playerId}:${w.hand}`).join(",");
  }
  return key;
}

function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("pokington_user_id");
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem("pokington_user_id", id);
  }
  return id;
}

export const useGameStore = create<GameStore>((set, get) => {

  // Called on every STATE message from the server.
  // Detects phase transitions and fires UI-layer side effects (animations, timers, announcements).
  function handleIncomingState(prev: PublicGameState | null, next: PublicGameState, isFirstReceive = false) {
    // On page reload: skip all animation triggers and jump straight to settled state.
    // Without this guard, the dummy "waiting" prev state causes all animation branches to fire.
    if (isFirstReceive) {
      const isShowdown = next.phase === "showdown";
      const hasRunResults = (next.runResults?.length ?? 0) > 0;
      // Auto-sync viewingSeat from myPlayerId
      const { viewingSeat, myPlayerId } = get();
      const myPlayer = myPlayerId ? next.players[myPlayerId] : null;
      set({
        gameState: next,
        isFirstStateReceived: true,
        ...(isShowdown ? {
          // Use timestamp 0 so elapsed time is huge → useSettledRunsCount returns max settled
          showdownStartedAt: 0,
          runDealStartedAt: hasRunResults ? 0 : null,
          isRunItBoard: hasRunResults,
          knownCardCountAtRunIt: hasRunResults ? next.communityCards.length : 0,
        } : {}),
        ...(viewingSeat === -1 && myPlayer ? { viewingSeat: myPlayer.seatIndex } : {}),
        // Sync turn timer start for ongoing hands (only when timer is enabled)
        ...(get().turnTimerEnabled && next.needsToAct.length > 0 ? { turnStartedAt: Date.now() } : { turnStartedAt: null }),
      });
      return;
    }

    const beforePhase = prev?.phase ?? "waiting";
    const beforeCardCount = prev?.communityCards.length ?? 0;
    const hadSevenTwoTrigger = !!prev?.sevenTwoBountyTrigger;
    const hadBombPotNextHand = !!prev?.bombPotNextHand;
    const wasBombPot = prev?.isBombPot ?? false;

    // ── Street transition: live bets cleared ──
    const prevBets = prev ? Object.values(prev.players).reduce((s, p) => s + p.currentBet, 0) : 0;
    const nextBets = Object.values(next.players).reduce((s, p) => s + p.currentBet, 0);
    const streetTransitioned = prevBets > 0 && nextBets === 0 && next.phase !== "waiting";

    if (streetTransitioned && prev) {
      const snapshot = Object.values(prev.players)
        .filter((p) => p.currentBet > 0)
        .map((p) => ({ id: p.id, seatIndex: p.seatIndex, amount: p.currentBet }));
      set({ streetPauseChips: snapshot, streetSweeping: false });
      setTimeout(() => set({ streetSweeping: true }), STREET_PAUSE_MS - SWEEP_DURATION_MS);
      setTimeout(() => set({ streetPauseChips: null, streetSweeping: false }), STREET_PAUSE_MS);
    }

    // ── Voting phase entered ──
    const PLAYING_PHASES = ["pre-flop", "flop", "turn", "river"];
    if (PLAYING_PHASES.includes(beforePhase) && next.phase === "voting") {
      set({ votingStartedAt: Date.now(), isRunItBoard: true, knownCardCountAtRunIt: beforeCardCount });
    }

    // ── Direct showdown (all-in or bomb pot) ──
    if (PLAYING_PHASES.includes(beforePhase) && next.phase === "showdown") {
      const now = Date.now();
      set({ showdownStartedAt: now });
      const activePlayers = Object.values(next.players).filter((p) => !p.isFolded);
      const allInCount = activePlayers.filter((p) => p.isAllIn).length;
      if (activePlayers.length >= 2 && allInCount === activePlayers.length) {
        set({ isRunItBoard: true, knownCardCountAtRunIt: beforeCardCount, runDealStartedAt: now });
      } else if (next.isBombPot) {
        set({ isRunItBoard: true, knownCardCountAtRunIt: beforeCardCount, runDealStartedAt: now });
      }
    }

    // ── Voting resolved → showdown ──
    if (beforePhase === "voting" && next.phase === "showdown") {
      set({ votingStartedAt: null, showdownStartedAt: Date.now() });
      set({ runAnnouncement: next.runCount as 1 | 2 | 3 });
      setTimeout(() => set({ runAnnouncement: null, runDealStartedAt: Date.now() }), ANNOUNCEMENT_MS);
    }

    // ── 7-2 bounty triggered ──
    if (!hadSevenTwoTrigger && next.sevenTwoBountyTrigger) {
      const trigger = next.sevenTwoBountyTrigger;
      const winner = next.players[trigger.winnerId];
      if (sevenTwoAnnouncementTimer) clearTimeout(sevenTwoAnnouncementTimer);
      set({ sevenTwoAnnouncement: { winnerName: winner?.name ?? "Unknown", perPlayer: trigger.perPlayer, total: trigger.totalCollected } });
      sevenTwoAnnouncementTimer = setTimeout(() => set({ sevenTwoAnnouncement: null }), 5_500);
    }

    // ── Bomb pot vote passed ──
    if (!hadBombPotNextHand && next.bombPotNextHand) {
      const anteCents = next.bombPotNextHand.anteBB * next.blinds.big;
      if (bombPotAnnouncementTimer) clearTimeout(bombPotAnnouncementTimer);
      set({ bombPotAnnouncement: { anteBB: next.bombPotNextHand.anteBB, anteCents } });
      bombPotAnnouncementTimer = setTimeout(() => set({ bombPotAnnouncement: null }), 3_000);
    }

    // ── Bomb pot hand started ──
    if (!wasBombPot && next.isBombPot) {
      set({ bombPotAnnouncement: null, isRunItBoard: true, knownCardCountAtRunIt: 5 });
    }

    // ── New hand: reset animation state and per-card reveal ──
    if (prev && next.handNumber > prev.handNumber) {
      set({ runAnnouncement: null, votingStartedAt: null, isRunItBoard: false, knownCardCountAtRunIt: 0, runDealStartedAt: null, showdownStartedAt: null, myRevealedCardIndices: new Set() });
    }

    // ── Auto-sync viewingSeat from myPlayerId on reconnect ──
    const { viewingSeat, myPlayerId, leaveQueued } = get();
    if (viewingSeat === -1 && myPlayerId && next.players[myPlayerId]) {
      set({ viewingSeat: next.players[myPlayerId].seatIndex });
    }

    // ── Leave-queued: player was removed by server, clean up client ──
    if (leaveQueued && myPlayerId && !next.players[myPlayerId]) {
      set({ leaveQueued: false, viewingSeat: -1 });
    }

    // ── Turn timer: reset when actor changes ──
    if (next.needsToAct[0] !== prev?.needsToAct[0]) {
      set({ turnStartedAt: get().turnTimerEnabled && next.needsToAct.length > 0 ? Date.now() : null });
    }

    set({ gameState: next });
  }

  return {
    gameState: toPublicGameState(createInitialState("", { small: 10, big: 25 })),
    myUserId: null,
    myPlayerId: null,
    connectionStatus: "disconnected",
    isCreator: false,
    tableNotFound: false,
    myHoleCards: null,
    revealedHoleCards: {},
    myRevealedCardIndices: new Set<0 | 1>(),
    viewingSeat: -1,
    turnStartedAt: null,
    votingStartedAt: null,
    streetPauseChips: null,
    streetSweeping: false,
    turnTimerEnabled: true,
    runAnnouncement: null,
    isRunItBoard: false,
    knownCardCountAtRunIt: 0,
    runDealStartedAt: null,
    showdownStartedAt: null,
    sevenTwoAnnouncement: null,
    bombPotAnnouncement: null,
    ledger: [],
    awayPlayerIds: [],
    peekedCounts: {},
    leaveQueued: false,
    isFirstStateReceived: false,

    connect: (tableCode) => {
      if (_socket) { _socket.close(); _socket = null; }

      const userId = getOrCreateUserId();
      const playerId = `user_${userId.slice(0, 8)}`;
      set({ myUserId: userId, myPlayerId: playerId, connectionStatus: "connecting" });

      const host = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PARTYKIT_HOST)
        || "localhost:1999";

      _socket = new PartySocket({ host, room: tableCode });

      _socket.addEventListener("open", () => {
        set({ connectionStatus: "connected" });
        _socket!.send(JSON.stringify({ type: "AUTH", userId }));
      });

      _socket.addEventListener("message", (evt: MessageEvent) => {
        let msg: ServerMessage;
        try { msg = JSON.parse(evt.data as string) as ServerMessage; } catch { return; }

        switch (msg.type) {
          case "WELCOME": {
            set({ isCreator: msg.isCreator });
            if (msg.isCreator && typeof window !== "undefined") {
              const raw = sessionStorage.getItem(`table_config_${tableCode}`);
              if (raw) {
                _socket?.send(JSON.stringify({ type: "CONFIGURE", ...JSON.parse(raw) }));
                sessionStorage.removeItem(`table_config_${tableCode}`);
              }
            }
            break;
          }
          case "STATE": {
            const { gameState: prev, isFirstStateReceived } = get();
            handleIncomingState(prev, msg.state, !isFirstStateReceived);
            break;
          }
          case "PRIVATE": {
            set({ myHoleCards: msg.holeCards, revealedHoleCards: msg.revealedHoleCards });
            break;
          }
          case "ROOM_META": {
            const newTimerEnabled = msg.turnTimerEnabled;
            const newAwayIds: string[] = msg.awayPlayerIds ?? [];
            const newPeekedCounts: Record<string, number> = msg.peekedCounts ?? {};
            const {
              turnTimerEnabled: wasEnabled,
              awayPlayerIds: prevAwayIds,
              peekedCounts: prevPeekedCounts,
              gameState: gs,
              turnStartedAt: existingTimer,
            } = get();
            const currentActor = gs.needsToAct[0] ?? null;
            const isActorAway = currentActor != null && newAwayIds.includes(currentActor);

            let timerUpdate: { turnStartedAt: number | null } | Record<string, never> = {};
            if (!newTimerEnabled && !isActorAway) {
              if (existingTimer !== null) timerUpdate = { turnStartedAt: null };
            } else if ((!wasEnabled && newTimerEnabled && gs.needsToAct.length > 0) ||
                       (isActorAway && !existingTimer)) {
              timerUpdate = { turnStartedAt: Date.now() };
            }

            // Diff fields to skip no-op set() (ROOM_META fires on every peek).
            const timerChanged = newTimerEnabled !== wasEnabled;
            const awayChanged =
              prevAwayIds.length !== newAwayIds.length ||
              prevAwayIds.some((id, i) => id !== newAwayIds[i]);
            const prevPeekKeys = Object.keys(prevPeekedCounts);
            const newPeekKeys = Object.keys(newPeekedCounts);
            const peekedChanged =
              prevPeekKeys.length !== newPeekKeys.length ||
              newPeekKeys.some(k => prevPeekedCounts[k] !== newPeekedCounts[k]);
            const hasTimerUpdate = Object.keys(timerUpdate).length > 0;

            if (!timerChanged && !awayChanged && !peekedChanged && !hasTimerUpdate) break;

            const patch: Record<string, unknown> = { ...timerUpdate };
            if (timerChanged) patch.turnTimerEnabled = newTimerEnabled;
            if (awayChanged) patch.awayPlayerIds = newAwayIds;
            if (peekedChanged) patch.peekedCounts = newPeekedCounts;
            set(patch);
            break;
          }
          case "LEDGER":
            set({ ledger: msg.entries });
            break;
          case "ERROR":
            if (msg.code === "TABLE_NOT_FOUND") set({ tableNotFound: true });
            break;
        }
      });

      _socket.addEventListener("close", () => set({ connectionStatus: "disconnected" }));

      // Page Visibility API: notify server when tab goes away/returns
      if (typeof document !== "undefined") {
        // Tear down any handlers left over from a previous connect()
        if (_visibilityHandler) document.removeEventListener("visibilitychange", _visibilityHandler);
        if (_idleCleanup) _idleCleanup();

        const handleVisibilityChange = () => {
          if (_socket) {
            _socket.send(JSON.stringify({ type: "SET_AWAY", away: document.hidden }));
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        _visibilityHandler = handleVisibilityChange;

        // Inactivity-based away: 2 minutes of no interaction → away
        const IDLE_MS = 120_000;
        const THROTTLE_MS = 200;
        let lastActivity = Date.now();
        let lastThrottleTime = 0;
        let idleAway = false;
        const onActivity = () => {
          const now = Date.now();
          if (now - lastThrottleTime < THROTTLE_MS) return;
          lastThrottleTime = now;
          lastActivity = now;
          if (idleAway) {
            idleAway = false;
            if (_socket) _socket.send(JSON.stringify({ type: "SET_AWAY", away: false }));
          }
        };
        const idleInterval = setInterval(() => {
          if (!idleAway && Date.now() - lastActivity > IDLE_MS) {
            idleAway = true;
            if (_socket) _socket.send(JSON.stringify({ type: "SET_AWAY", away: true }));
          }
        }, 10_000);
        document.addEventListener("mousemove", onActivity, { passive: true });
        document.addEventListener("keydown", onActivity);
        document.addEventListener("touchstart", onActivity, { passive: true });
        _idleCleanup = () => {
          clearInterval(idleInterval);
          document.removeEventListener("mousemove", onActivity);
          document.removeEventListener("keydown", onActivity);
          document.removeEventListener("touchstart", onActivity);
        };
      }
    },

    disconnect: () => {
      if (typeof document !== "undefined") {
        if (_visibilityHandler) {
          document.removeEventListener("visibilitychange", _visibilityHandler);
          _visibilityHandler = null;
        }
        if (_idleCleanup) {
          _idleCleanup();
          _idleCleanup = null;
        }
      }
      if (_socket) { _socket.close(); _socket = null; }
      set({ connectionStatus: "disconnected", isFirstStateReceived: false, awayPlayerIds: [], peekedCounts: {}, ledger: [] });
    },

    sendEvent: (event) => {
      if (!_socket) return;
      _socket.send(JSON.stringify({ type: "GAME_EVENT", event }));
    },

    sitDown: (seatIndex, name, buyInCents) => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({ type: "SIT_DOWN", playerId: myPlayerId, name, seatIndex, buyIn: buyInCents });
      set({ viewingSeat: seatIndex });
    },

    standUp: () => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({ type: "STAND_UP", playerId: myPlayerId });
      set({ viewingSeat: -1 });
    },

    queueLeave: () => {
      if (!_socket) return;
      _socket.send(JSON.stringify({ type: "QUEUE_LEAVE" }));
      set({ leaveQueued: true });
    },

    changeSeat: (newSeatIndex: number) => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      const player = get().gameState.players[myPlayerId];
      if (!player) return;
      get().sendEvent({ type: "STAND_UP", playerId: myPlayerId });
      get().sendEvent({ type: "SIT_DOWN", playerId: myPlayerId, name: player.name, seatIndex: newSeatIndex, buyIn: player.stack });
      set({ viewingSeat: newSeatIndex });
    },

    startHand: () => {
      // Animation state is reset when handNumber actually increments in the
      // STATE handler, not here — a no-op START_HAND (< 2 players) would
      // corrupt display-deferred pot/stack values.
      get().sendEvent({ type: "START_HAND" });
    },

    fold: () => {
      const actorId = get().getCurrentActorId();
      if (!actorId || actorId !== get().myPlayerId) return;
      get().sendEvent({ type: "PLAYER_ACTION", playerId: actorId, action: "fold" });
    },

    check: () => {
      const actorId = get().getCurrentActorId();
      if (!actorId || actorId !== get().myPlayerId) return;
      get().sendEvent({ type: "PLAYER_ACTION", playerId: actorId, action: "check" });
    },

    call: () => {
      const actorId = get().getCurrentActorId();
      if (!actorId || actorId !== get().myPlayerId) return;
      get().sendEvent({ type: "PLAYER_ACTION", playerId: actorId, action: "call" });
    },

    raise: (totalAmount) => {
      const actorId = get().getCurrentActorId();
      if (!actorId || actorId !== get().myPlayerId) return;
      get().sendEvent({ type: "PLAYER_ACTION", playerId: actorId, action: "raise", amount: totalAmount });
    },

    allIn: () => {
      const actorId = get().getCurrentActorId();
      if (!actorId || actorId !== get().myPlayerId) return;
      get().sendEvent({ type: "PLAYER_ACTION", playerId: actorId, action: "all-in" });
    },

    voteRun: (count) => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      const player = get().gameState.players[myPlayerId];
      if (!player || player.isFolded || get().gameState.phase !== "voting") return;
      get().sendEvent({ type: "VOTE_RUN", playerId: myPlayerId, count });
    },

    resolveVote: () => {
      if (get().gameState.phase !== "voting") return;
      get().sendEvent({ type: "RESOLVE_VOTE" });
    },

    showCards: () => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({ type: "SHOW_CARDS", playerId: myPlayerId });
    },

    revealCard: (cardIndex) => {
      if (!_socket) return;
      if (get().myRevealedCardIndices.has(cardIndex)) return;
      set((s) => ({ myRevealedCardIndices: new Set([...s.myRevealedCardIndices, cardIndex]) }));
      _socket.send(JSON.stringify({ type: "REVEAL_CARD", cardIndex }));
    },

    peekCard: (cardIndex) => {
      if (!_socket) return;
      _socket.send(JSON.stringify({ type: "PEEK_CARD", cardIndex }));
    },

    setSevenTwoBounty: (bountyBB) => {
      get().sendEvent({ type: "SET_SEVEN_TWO_BOUNTY", bountyBB });
    },

    debugSetHoleCards: (playerId, cards) => {
      get().sendEvent({ type: "SET_HOLE_CARDS", playerId, cards });
    },

    setViewingSeat: (seat) => set({ viewingSeat: seat }),

    proposeBombPot: (anteBB) => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({ type: "PROPOSE_BOMB_POT", playerId: myPlayerId, anteBB });
    },

    voteBombPot: (approve) => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({ type: "VOTE_BOMB_POT", playerId: myPlayerId, approve });
    },

    getTurnElapsedMs: () => {
      const { turnStartedAt } = get();
      return turnStartedAt != null ? Date.now() - turnStartedAt : 0;
    },

    // ── Derived selectors ──

    getPlayers: () => {
      const state = get();
      const { gameState, viewingSeat, myPlayerId, revealedHoleCards, streetPauseChips, isCreator, awayPlayerIds } = state;

      // Return cached result if inputs haven't changed
      const key = playersKey(state);
      if (key === _cachedPlayersKey) return _cachedPlayers;

      const players = Object.values(gameState.players);
      const currentActorId = gameState.needsToAct[0] ?? null;

      const result: (UIPlayer | null)[] = Array(TOTAL_SEATS).fill(null);
      for (const p of players) {
        const pauseBet = streetPauseChips?.find((c) => c.id === p.id)?.amount;

        result[p.seatIndex] = {
          id: p.id,
          name: p.name,
          stack: p.stack,
          seatIndex: p.seatIndex,
          isAdmin: isCreator && p.id === myPlayerId,
          // Use myPlayerId for identity when available (real multiplayer), fall back to viewingSeat (DebugPanel)
          isYou: myPlayerId ? p.id === myPlayerId : p.seatIndex === viewingSeat,
          isCurrentActor: p.id === currentActorId,
          currentBet: pauseBet ?? p.currentBet,
          isFolded: p.isFolded,
          isAllIn: p.isAllIn,
          lastAction: p.lastAction,
          hasCards: p.hasCards && !p.isFolded,
          isSittingOut: p.sitOutUntilBB,
          peekedCount: state.peekedCounts[p.id] ?? 0,
          isAway: awayPlayerIds.includes(p.id),
          // Never expose own hole cards in the player array — they're shown exclusively in the
          // hand panel via the separate `holeCards` prop (store.myHoleCards). Only include
          // other players' voluntarily or auto-revealed cards at showdown.
          holeCards: gameState.phase === "showdown" && p.id !== myPlayerId
            ? (revealedHoleCards[p.id] ?? null)
            : null,
        };
      }
      _cachedPlayers = result;
      _cachedPlayersKey = key;
      return result;
    },

    getViewingPlayer: () => {
      const { gameState, viewingSeat } = get();
      return Object.values(gameState.players).find((p) => p.seatIndex === viewingSeat) ?? null;
    },

    getHoleCards: () => get().myHoleCards,

    getHandStrength: () => null,

    getCommunityCards: () => get().gameState.communityCards,
    getPot: () => get().gameState.pot,

    getTotalPotWithBets: () => {
      const { gameState } = get();
      const bets = Object.values(gameState.players).reduce((sum, p) => sum + p.currentBet, 0);
      return gameState.pot + bets;
    },

    getPhase: () => get().gameState.phase,
    getWinners: () => get().gameState.winners,
    getRunItVotes: () => get().gameState.runItVotes,
    getRunCount: () => get().gameState.runCount,
    getRunResults: () => get().gameState.runResults,

    getCurrentActorId: () => get().gameState.needsToAct[0] ?? null,

    isViewerTurn: () => {
      const { myPlayerId, gameState } = get();
      return !!myPlayerId && gameState.needsToAct[0] === myPlayerId;
    },

    getCallAmount: () => {
      const { gameState } = get();
      const actorId = gameState.needsToAct[0];
      if (!actorId) return 0;
      const actor = gameState.players[actorId];
      if (!actor) return 0;
      return Math.min(gameState.roundBet - actor.currentBet, actor.stack);
    },

    getMinRaise: () => {
      const { gameState } = get();
      const { roundBet, lastLegalRaiseIncrement, blinds, isBlindIncomplete } = gameState;
      if (isBlindIncomplete) return blinds.big;
      return roundBet + Math.max(lastLegalRaiseIncrement, blinds.big);
    },

    canCheck: () => {
      const { gameState } = get();
      const actorId = gameState.needsToAct[0];
      if (!actorId) return false;
      const actor = gameState.players[actorId];
      if (!actor) return false;
      return actor.currentBet === gameState.roundBet;
    },

    canRaise: () => {
      const { gameState } = get();
      const actorId = gameState.needsToAct[0];
      if (!actorId) return false;
      return !gameState.closedActors.includes(actorId);
    },

    canAllIn: () => {
      const { gameState } = get();
      const actorId = gameState.needsToAct[0];
      if (!actorId) return false;
      const actor = gameState.players[actorId];
      return !!actor && actor.stack > 0 && !actor.isAllIn;
    },

    isFirstBet: () => {
      const { gameState } = get();
      return gameState.roundBet === 0 && gameState.phase !== "pre-flop";
    },

    getRoundBet: () => get().gameState.roundBet,
    getHandNumber: () => get().gameState.handNumber,
    getViewerStack: () => get().getViewingPlayer()?.stack ?? 0,
    isViewerAdmin: () => get().isCreator,
    setTurnTimerEnabled: (enabled) => set({ turnTimerEnabled: enabled }),
    toggleTimer: (enabled) => {
      set({ turnTimerEnabled: enabled });
      if (_socket) _socket.send(JSON.stringify({ type: "SET_TIMER", enabled }));
    },
    getSevenTwoBountyBB: () => get().gameState.sevenTwoBountyBB,
    getVoluntaryShownPlayerIds: () => get().gameState.voluntaryShownPlayerIds,
    getSevenTwoBountyTrigger: () => get().gameState.sevenTwoBountyTrigger,
    getBombPotVote: () => get().gameState.bombPotVote,
    getBombPotNextHand: () => get().gameState.bombPotNextHand,
    isBombPotHand: () => get().gameState.isBombPot,
    getCommunityCards2: () => get().gameState.communityCards2,
    getBombPotCooldown: () => get().gameState.bombPotCooldown,

    getLedgerRows: () => get().ledger.map((entry): LedgerRow => {
      const totalBuyIn = entry.buyIns.reduce((s, v) => s + v, 0);
      const totalCashOut = entry.cashOuts.reduce((s, v) => s + v, 0) + entry.currentStack;
      return { playerId: entry.playerId, name: entry.name, totalBuyIn, totalCashOut, net: totalCashOut - totalBuyIn, isSeated: entry.isSeated };
    }),

    getPayoutInstructions: () => {
      const rows = get().getLedgerRows();
      const creditors = rows.filter(r => r.net > 0).map(r => ({ ...r, rem: r.net })).sort((a, b) => b.rem - a.rem);
      const debtors = rows.filter(r => r.net < 0).map(r => ({ ...r, rem: -r.net })).sort((a, b) => b.rem - a.rem);
      const out: PayoutInstruction[] = [];
      let ci = 0, di = 0;
      while (ci < creditors.length && di < debtors.length) {
        const amount = Math.min(creditors[ci].rem, debtors[di].rem);
        if (amount > 0) out.push({ fromPlayerId: debtors[di].playerId, fromName: debtors[di].name, toPlayerId: creditors[ci].playerId, toName: creditors[ci].name, amount });
        creditors[ci].rem -= amount;
        debtors[di].rem -= amount;
        if (creditors[ci].rem === 0) ci++;
        if (debtors[di].rem === 0) di++;
      }
      return out;
    },
  };
});
