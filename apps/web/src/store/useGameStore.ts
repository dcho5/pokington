"use client";
import { create } from "zustand";
import PartySocket from "partysocket";
import {
  createInitialState,
  type GameEvent,
  type WinnerInfo,
  type RunResult,
} from "@pokington/engine";
import type { Card } from "@pokington/shared";
import {
  toPublicGameState,
  type PublicGameState,
  type PublicEnginePlayer,
  type ServerMessage,
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
  /** Hole cards — populated for revealed opponents at showdown (null slot = card not revealed) */
  holeCards?: [Card | null, Card | null] | null;
  handLabel?: string;
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
  setSevenTwoBounty: (bountyBB: 0 | 1 | 2 | 3) => void;
  debugSetHoleCards: (playerId: string, cards: [Card, Card]) => void;
  setViewingSeat: (seat: number) => void;
  proposeBombPot: (anteBB: 1 | 2 | 3 | 4 | 5) => void;
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
  getSevenTwoBountyBB: () => 0 | 1 | 2 | 3;
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
  getBombPotVote: () => PublicGameState["bombPotVote"];
  getBombPotNextHand: () => PublicGameState["bombPotNextHand"];
  isBombPotHand: () => boolean;
  getCommunityCards2: () => Card[];
  getBombPotCooldown: () => string[];
}

const TOTAL_SEATS = 10;
const STREET_PAUSE_MS = 1200;
const SWEEP_DURATION_MS = 450;
const ANNOUNCEMENT_MS = 3500;

// Module-level — not reactive state
let _socket: PartySocket | null = null;
let sevenTwoAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;
let bombPotAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;

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
  function handleIncomingState(prev: PublicGameState | null, next: PublicGameState) {
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
    const { viewingSeat, myPlayerId } = get();
    if (viewingSeat === -1 && myPlayerId && next.players[myPlayerId]) {
      set({ viewingSeat: next.players[myPlayerId].seatIndex });
    }

    // ── Turn timer: reset when actor changes ──
    if (next.needsToAct[0] !== prev?.needsToAct[0]) {
      set({ turnStartedAt: next.needsToAct.length > 0 ? Date.now() : null });
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
            const prev = get().gameState;
            handleIncomingState(prev, msg.state);
            break;
          }
          case "PRIVATE": {
            set({ myHoleCards: msg.holeCards, revealedHoleCards: msg.revealedHoleCards });
            break;
          }
          case "ROOM_META":
            break;
          case "ERROR":
            if (msg.code === "TABLE_NOT_FOUND") set({ tableNotFound: true });
            break;
        }
      });

      _socket.addEventListener("close", () => set({ connectionStatus: "disconnected" }));
    },

    disconnect: () => {
      if (_socket) { _socket.close(); _socket = null; }
      set({ connectionStatus: "disconnected" });
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
      set({ viewingSeat: -1, myPlayerId: null });
    },

    startHand: () => {
      // Reset animation state immediately (local UI concern)
      set({ runAnnouncement: null, votingStartedAt: null, isRunItBoard: false, knownCardCountAtRunIt: 0, runDealStartedAt: null, showdownStartedAt: null });
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
      const { gameState, viewingSeat, myPlayerId, myHoleCards, revealedHoleCards, streetPauseChips, isCreator } = get();
      const players = Object.values(gameState.players);
      const currentActorId = gameState.needsToAct[0] ?? null;
      const isUncontested =
        gameState.winners?.length === 1 &&
        (gameState.winners[0].hand === "Uncontested" || gameState.winners[0].hand === "Last standing");

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
          // Never expose own hole cards in the player array — they're shown exclusively in the
          // hand panel via the separate `holeCards` prop (store.myHoleCards). Only include
          // other players' voluntarily or auto-revealed cards at showdown.
          holeCards: gameState.phase === "showdown" && p.id !== myPlayerId
            ? (revealedHoleCards[p.id] ?? null)
            : null,
        };
      }
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
    getSevenTwoBountyBB: () => get().gameState.sevenTwoBountyBB,
    getVoluntaryShownPlayerIds: () => get().gameState.voluntaryShownPlayerIds,
    getSevenTwoBountyTrigger: () => get().gameState.sevenTwoBountyTrigger,
    getBombPotVote: () => get().gameState.bombPotVote,
    getBombPotNextHand: () => get().gameState.bombPotNextHand,
    isBombPotHand: () => get().gameState.isBombPot,
    getCommunityCards2: () => get().gameState.communityCards2,
    getBombPotCooldown: () => get().gameState.bombPotCooldown,
  };
});
