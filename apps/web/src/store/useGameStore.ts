"use client";
import { create } from "zustand";
import PartySocket from "partysocket";
import {
  createInitialState,
  type GameEvent,
  type GameFeedbackCueEnvelope,
  type PendingBoundaryUpdate,
  type WinnerInfo,
  type RunResult,
  type SevenTwoBountyBB,
  type BombPotAnteBB,
} from "@pokington/engine";
import type { Card } from "@pokington/shared";
import {
  toPublicGameState,
  PROTOCOL_VERSION,
  type PublicGameState,
  type PublicEnginePlayer,
  type ServerMessage,
  type LedgerEntry,
  type LedgerRow,
  type PayoutInstruction,
} from "party/types";
import { deriveLedgerRows, derivePayoutInstructions } from "lib/ledger";
import { createJoinToken, getOrCreateClientId, getPartyKitHost } from "lib/party";
import {
  readPersistedAutoPeelPreference,
  writePersistedAutoPeelPreference,
} from "@pokington/ui/web/holeCardReveal";
import { deriveServerRunTiming } from "lib/runTimingFlags.mjs";
import { isTableClearedForNextHand } from "lib/tableVisualState";
import { deriveStreetPauseSnapshot } from "lib/streetSweep.mjs";
import { shouldClearHandScopedState } from "party/handScopedState.mjs";

export interface BombPotAnnouncement {
  kind: "scheduled" | "canceled";
  anteBB: number;
  anteCents: number;
  title: string;
  detail: string;
}

export interface ActionError {
  message: string;
}

export interface TableFeedbackBatch {
  kind: "feedback";
  feedback: GameFeedbackCueEnvelope[];
  gameState: PublicGameState;
}

export interface TableActionErrorFeedback {
  kind: "action_error";
  key: string;
  message: string;
  handNumber: number | null;
}

export type TableFeedbackEvent = TableFeedbackBatch | TableActionErrorFeedback;

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
  revealedHoleCards: Record<string, [Card | null, Card | null]>; // any currently public hole-card slots
  myRevealedCardIndices: Set<0 | 1>; // which of my cards I've revealed to others this hand
  tableNotFound: boolean;

  // UI timing
  viewingSeat: number;
  votingStartedAt: number | null;
  bombPotVotingStartedAt: number | null;

  // Chip sweep animation
  boundaryPausePlayers: {
    id: string;
    seatIndex: number;
    currentBet: number;
    lastAction: string | null;
    isAllIn: boolean;
  }[] | null;
  streetSweeping: boolean;

  runAnnouncement: 1 | 2 | 3 | null;
  isRunItBoard: boolean;
  knownCardCountAtRunIt: number;
  runDealStartedAt: number | null;
  showdownStartedAt: number | null;
  sevenTwoAnnouncement: { winnerName: string; perPlayer: number; total: number } | null;
  bombPotAnnouncement: BombPotAnnouncement | null;
  actionError: ActionError | null;
  autoPeelEnabled: boolean;

  // Actions
  connect: (tableCode: string) => void;
  disconnect: () => void;
  sendEvent: (event: GameEvent) => void;
  sitDown: (seatIndex: number, name: string, buyInCents: number) => void;
  requestBoundaryUpdate: (update: {
    leaveSeat?: boolean;
    moveToSeatIndex?: number | null;
    chipDelta?: number;
  }) => void;
  cancelBoundaryUpdate: () => void;
  standUp: () => void;
  queueLeave: () => void;
  cancelQueuedLeave: () => void;
  leaveQueued: boolean;
  changeSeat: (newSeatIndex: number) => void;
  shuffleSeats: () => void;
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
  setViewingSeat: (seat: number) => void;
  proposeBombPot: (anteBB: BombPotAnteBB) => void;
  voteBombPot: (approve: boolean) => void;
  setAutoPeelEnabled: (enabled: boolean) => void;

  // Derived selectors
  getViewingPlayer: () => PublicEnginePlayer | null;
  getHoleCards: () => [Card, Card] | null;
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
  getBombPotVote: () => PublicGameState["bombPotVote"];
  getBombPotNextHand: () => PublicGameState["bombPotNextHand"];
  isBombPotHand: () => boolean;
  getCommunityCards2: () => Card[];
  getBombPotCooldown: () => string[];
  getViewerPendingBoundaryUpdate: () => PendingBoundaryUpdate | null;

  // Session ledger
  ledger: LedgerEntry[];
  getLedgerRows: () => LedgerRow[];
  getPayoutInstructions: () => PayoutInstruction[];

  // Away status
  awayPlayerIds: string[];

  // Preserves winner seat/name info if a player stands up during showdown.
  showdownPlayerSnapshot: Record<string, PublicEnginePlayer>;

  // Peek tracking (how many cards each player has peeled far enough to identify)
  peekedCounts: Record<string, number>;

  // First-state guard (prevents animation replay on page reload)
  isFirstStateReceived: boolean;
}

type RunTimingPatch = Pick<
  GameStore,
  "runAnnouncement" | "isRunItBoard" | "knownCardCountAtRunIt" | "runDealStartedAt" | "showdownStartedAt"
>;

const STREET_PAUSE_MS = 1200;
const SWEEP_DURATION_MS = 450;

// Module-level — not reactive state
let _socket: PartySocket | null = null;
let _visibilityHandler: (() => void) | null = null;
let _idleCleanup: (() => void) | null = null;
let sevenTwoAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;
let bombPotAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;
let actionErrorTimer: ReturnType<typeof setTimeout> | null = null;
let boundaryPauseSweepTimer: ReturnType<typeof setTimeout> | null = null;
let boundaryPauseClearTimer: ReturnType<typeof setTimeout> | null = null;
let feedbackSequence = 0;
const feedbackListeners = new Set<(event: TableFeedbackEvent) => void>();

function clearBoundaryPauseTimers() {
  if (boundaryPauseSweepTimer) {
    clearTimeout(boundaryPauseSweepTimer);
    boundaryPauseSweepTimer = null;
  }
  if (boundaryPauseClearTimer) {
    clearTimeout(boundaryPauseClearTimer);
    boundaryPauseClearTimer = null;
  }
}

export function subscribeToTableFeedback(listener: (event: TableFeedbackEvent) => void) {
  feedbackListeners.add(listener);
  return () => {
    feedbackListeners.delete(listener);
  };
}

function emitTableFeedback(event: TableFeedbackEvent) {
  for (const listener of feedbackListeners) {
    listener(event);
  }
}

function getRevealedCardIndices(cards: [Card | null, Card | null] | null | undefined): Set<0 | 1> {
  const indices = new Set<0 | 1>();
  if (cards?.[0]) indices.add(0);
  if (cards?.[1]) indices.add(1);
  return indices;
}

function createPlaceholderPublicGameState(): PublicGameState {
  return toPublicGameState(createInitialState("", { small: 10, big: 25 }));
}

function clonePublicPlayers(players: PublicGameState["players"]): Record<string, PublicEnginePlayer> {
  return Object.fromEntries(
    Object.entries(players).map(([playerId, player]) => [playerId, { ...player }]),
  );
}

function hasNoFurtherActionAgainstAllIn(gameState: PublicGameState): boolean {
  const activePlayers = Object.values(gameState.players).filter(
    (p) => p.hasCards && !p.isFolded && !p.isAllIn
  );
  return activePlayers.length === 1 && activePlayers[0].currentBet >= gameState.roundBet;
}

function getActionableActor(gameState: PublicGameState): PublicEnginePlayer | null {
  const actorId = gameState.needsToAct[0];
  if (!actorId) return null;
  const actor = gameState.players[actorId];
  if (!actor || actor.isFolded || actor.isAllIn || !actor.hasCards || actor.sitOutUntilBB) {
    return null;
  }
  if (hasNoFurtherActionAgainstAllIn(gameState)) return null;
  return actor;
}

export const useGameStore = create<GameStore>((set, get) => {

  // Called on every TABLE_STATE message from the server.
  // Detects phase transitions and fires UI-layer side effects (animations, timers, announcements).
  function handleIncomingState(
    prev: PublicGameState | null,
    next: PublicGameState,
    feedback: GameFeedbackCueEnvelope[] = [],
    isFirstReceive = false,
  ) {
    const timingPatch = deriveServerRunTiming(next) as RunTimingPatch;
    const snapshotPatch =
      next.phase === "showdown"
        ? { showdownPlayerSnapshot: prev?.phase === "showdown" ? get().showdownPlayerSnapshot : clonePublicPlayers(next.players) }
        : { showdownPlayerSnapshot: {} };

    if (isFirstReceive) {
      const { viewingSeat, myPlayerId } = get();
      const myPlayer = myPlayerId ? next.players[myPlayerId] : null;
      set({
        gameState: next,
        isFirstStateReceived: true,
        actionError: null,
        votingStartedAt: next.runItVotingStartedAt ?? null,
        bombPotVotingStartedAt: next.bombPotVotingStartedAt ?? null,
        ...timingPatch,
        ...snapshotPatch,
        ...(viewingSeat === -1 && myPlayer ? { viewingSeat: myPlayer.seatIndex } : {}),
      });
      return;
    }

    const hadSevenTwoTrigger = !!prev?.sevenTwoBountyTrigger;
    const hadBombPotNextHand = !!prev?.bombPotNextHand;
    const wasBombPot = prev?.isBombPot ?? false;
    const advancedHand = (next.handNumber ?? 0) > (prev?.handNumber ?? 0);
    const shouldClearRevealedCards = prev ? shouldClearHandScopedState(prev, next) : false;

    // ── Street transition: live bets cleared ──
    const boundaryPauseSnapshot = prev ? deriveStreetPauseSnapshot(prev, next, feedback) : null;
    const streetTransitioned = boundaryPauseSnapshot !== null;

    if (streetTransitioned && prev) {
      clearBoundaryPauseTimers();
      set({ boundaryPausePlayers: boundaryPauseSnapshot, streetSweeping: false });
      boundaryPauseSweepTimer = setTimeout(
        () => set({ streetSweeping: true }),
        STREET_PAUSE_MS - SWEEP_DURATION_MS,
      );
      boundaryPauseClearTimer = setTimeout(() => {
        set({ boundaryPausePlayers: null, streetSweeping: false });
        boundaryPauseSweepTimer = null;
        boundaryPauseClearTimer = null;
      }, STREET_PAUSE_MS);
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
      set({
        bombPotAnnouncement: {
          kind: "scheduled",
          anteBB: next.bombPotNextHand.anteBB,
          anteCents,
          title: "BOMB POT!",
          detail: `${next.bombPotNextHand.anteBB}x BB ante next hand`,
        },
      });
      bombPotAnnouncementTimer = setTimeout(() => set({ bombPotAnnouncement: null }), 3_000);
    }

    // ── Bomb pot canceled before hand start ──
    if (hadBombPotNextHand && !next.bombPotNextHand && !next.isBombPot && advancedHand && prev?.bombPotNextHand) {
      const anteCents = prev.bombPotNextHand.anteBB * next.blinds.big;
      if (bombPotAnnouncementTimer) clearTimeout(bombPotAnnouncementTimer);
      set({
        bombPotAnnouncement: {
          kind: "canceled",
          anteBB: prev.bombPotNextHand.anteBB,
          anteCents,
          title: "Bomb Pot Canceled",
          detail: "A stack (or more) came up short, so this hand returns to standard blinds.",
        },
      });
      bombPotAnnouncementTimer = setTimeout(() => set({ bombPotAnnouncement: null }), 4_000);
    }

    // ── Bomb pot hand started ──
    if (!wasBombPot && next.isBombPot) {
      set({ bombPotAnnouncement: null });
    }

    // ── Table fully cleared between hands ──
    if (isTableClearedForNextHand(next)) {
      set({
        runAnnouncement: null,
        votingStartedAt: null,
        bombPotVotingStartedAt: null,
        isRunItBoard: false,
        knownCardCountAtRunIt: 0,
        runDealStartedAt: null,
        showdownStartedAt: null,
        revealedHoleCards: {},
        myRevealedCardIndices: new Set(),
      });
    }

    // ── New hand: reset animation state and per-card reveal ──
    if (prev && next.handNumber > prev.handNumber) {
      set({
        runAnnouncement: null,
        votingStartedAt: null,
        bombPotVotingStartedAt: null,
        isRunItBoard: false,
        knownCardCountAtRunIt: 0,
        runDealStartedAt: null,
        showdownStartedAt: null,
        revealedHoleCards: {},
        myRevealedCardIndices: new Set(),
      });
    }

    if (shouldClearRevealedCards) {
      set({
        revealedHoleCards: {},
        myRevealedCardIndices: new Set(),
      });
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

    set({
      gameState: next,
      actionError: null,
      votingStartedAt: next.runItVotingStartedAt ?? null,
      bombPotVotingStartedAt: next.bombPotVotingStartedAt ?? null,
      ...timingPatch,
      ...snapshotPatch,
    });
  }

  return {
    gameState: createPlaceholderPublicGameState(),
    myUserId: null,
    myPlayerId: null,
    connectionStatus: "disconnected",
    isCreator: false,
    tableNotFound: false,
    myHoleCards: null,
    revealedHoleCards: {},
    myRevealedCardIndices: new Set<0 | 1>(),
    viewingSeat: -1,
    votingStartedAt: null,
    bombPotVotingStartedAt: null,
    boundaryPausePlayers: null,
    streetSweeping: false,

    runAnnouncement: null,
    isRunItBoard: false,
    knownCardCountAtRunIt: 0,
    runDealStartedAt: null,
    showdownStartedAt: null,
    sevenTwoAnnouncement: null,
    bombPotAnnouncement: null,
    actionError: null,
    autoPeelEnabled: readPersistedAutoPeelPreference(),
    ledger: [],
    awayPlayerIds: [],
    showdownPlayerSnapshot: {},
    peekedCounts: {},
    leaveQueued: false,
    isFirstStateReceived: false,

    connect: (tableCode) => {
      if (_socket) { _socket.close(); _socket = null; }
      clearBoundaryPauseTimers();
      if (actionErrorTimer) {
        clearTimeout(actionErrorTimer);
        actionErrorTimer = null;
      }

      const clientId = getOrCreateClientId();
      set({
        gameState: createPlaceholderPublicGameState(),
        myUserId: clientId,
        myPlayerId: null,
        connectionStatus: "connecting",
        isCreator: false,
        myHoleCards: null,
        revealedHoleCards: {},
        myRevealedCardIndices: new Set<0 | 1>(),
        tableNotFound: false,
        viewingSeat: -1,
        votingStartedAt: null,
        bombPotVotingStartedAt: null,
        boundaryPausePlayers: null,
        streetSweeping: false,
        runAnnouncement: null,
        isRunItBoard: false,
        knownCardCountAtRunIt: 0,
        runDealStartedAt: null,
        showdownStartedAt: null,
        sevenTwoAnnouncement: null,
        bombPotAnnouncement: null,
        actionError: null,
        ledger: [],
        awayPlayerIds: [],
        showdownPlayerSnapshot: {},
        peekedCounts: {},
        leaveQueued: false,
        isFirstStateReceived: false,
      });

      const host = getPartyKitHost();
      void (async () => {
        let joinToken: Awaited<ReturnType<typeof createJoinToken>>;
        try {
          joinToken = await createJoinToken(tableCode, { clientId });
        } catch (error) {
          const code = error instanceof Error ? error.message : "";
          set({
            connectionStatus: "disconnected",
            tableNotFound: code === "TABLE_NOT_FOUND" || code === "TABLE_NOT_ACTIVE",
          });
          return;
        }

        set({
          myPlayerId: joinToken.playerSessionId,
          isCreator: joinToken.isCreator,
        });

        _socket = new PartySocket({ host, room: tableCode });

        _socket.addEventListener("open", () => {
          set({ connectionStatus: "connected" });
          _socket?.send(JSON.stringify({ type: "AUTH", token: joinToken.token, protocolVersion: PROTOCOL_VERSION }));
          _socket?.send(JSON.stringify({ type: "SET_AWAY", away: typeof document !== "undefined" ? document.hidden : false }));
        });

        _socket.addEventListener("message", (evt: MessageEvent) => {
          let msg: ServerMessage;
          try { msg = JSON.parse(evt.data as string) as ServerMessage; } catch { return; }

          switch (msg.type) {
            case "WELCOME":
              set({ isCreator: msg.isCreator, myPlayerId: msg.playerSessionId });
              break;
            case "TABLE_STATE": {
              const { gameState: prev, isFirstStateReceived } = get();
              if (get().tableNotFound) set({ tableNotFound: false });
              const isFirstReceive = !isFirstStateReceived;
              handleIncomingState(prev, msg.state, msg.feedback ?? [], isFirstReceive);
              if (!isFirstReceive && msg.feedback && msg.feedback.length > 0) {
                emitTableFeedback({
                  kind: "feedback",
                  feedback: msg.feedback,
                  gameState: get().gameState,
                });
              }
              break;
            }
            case "PRIVATE_STATE":
              set((state) => ({
                myHoleCards: msg.holeCards,
                revealedHoleCards: msg.revealedHoleCards,
                myRevealedCardIndices: getRevealedCardIndices(
                  state.myPlayerId ? msg.revealedHoleCards[state.myPlayerId] : null
                ),
              }));
              break;
            case "ROOM_PRESENCE": {
              const newAwayIds: string[] = msg.awayPlayerIds ?? [];
              const newPeekedCounts: Record<string, number> = msg.peekedCounts ?? {};
              const queuedLeavePlayerIds: string[] = msg.queuedLeavePlayerIds ?? [];
              const {
                awayPlayerIds: prevAwayIds,
                peekedCounts: prevPeekedCounts,
                myPlayerId,
                leaveQueued: prevLeaveQueued,
              } = get();

              const awayChanged =
                prevAwayIds.length !== newAwayIds.length ||
                prevAwayIds.some((id, i) => id !== newAwayIds[i]);
              const prevPeekKeys = Object.keys(prevPeekedCounts);
              const newPeekKeys = Object.keys(newPeekedCounts);
              const peekedChanged =
                prevPeekKeys.length !== newPeekKeys.length ||
                newPeekKeys.some(k => prevPeekedCounts[k] !== newPeekedCounts[k]);
              const nextLeaveQueued = myPlayerId != null && queuedLeavePlayerIds.includes(myPlayerId);
              const leaveQueuedChanged = prevLeaveQueued !== nextLeaveQueued;

              if (!awayChanged && !peekedChanged && !leaveQueuedChanged) break;

              const patch: Record<string, unknown> = {};
              if (awayChanged) patch.awayPlayerIds = newAwayIds;
              if (peekedChanged) patch.peekedCounts = newPeekedCounts;
              if (leaveQueuedChanged) patch.leaveQueued = nextLeaveQueued;
              set(patch);
              break;
            }
            case "LEDGER_STATE":
              set({ ledger: msg.entries });
              break;
            case "ERROR": {
              if (msg.code === "ACTION_REJECTED") {
                if (actionErrorTimer) clearTimeout(actionErrorTimer);
                set({ actionError: { message: msg.message } });
                emitTableFeedback({
                  kind: "action_error",
                  key: `action_error:${feedbackSequence += 1}`,
                  message: msg.message,
                  handNumber: get().gameState.handNumber ?? null,
                });
                actionErrorTimer = setTimeout(() => {
                  set({ actionError: null });
                  actionErrorTimer = null;
                }, 4_500);
                break;
              }
              const isTableError = msg.code === "TABLE_NOT_FOUND" || msg.code === "TABLE_NOT_ACTIVE";
              const shouldDisconnect =
                isTableError || msg.code === "INVALID_JOIN_TOKEN" || msg.code === "PROTOCOL_VERSION_MISMATCH";
              if (shouldDisconnect) {
                clearBoundaryPauseTimers();
                if (actionErrorTimer) {
                  clearTimeout(actionErrorTimer);
                  actionErrorTimer = null;
                }
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
                if (_socket) {
                  _socket.close();
                  _socket = null;
                }
                set({
                  gameState: createPlaceholderPublicGameState(),
                  connectionStatus: "disconnected",
                  isCreator: false,
                  myHoleCards: null,
                  revealedHoleCards: {},
                  myRevealedCardIndices: new Set<0 | 1>(),
                  tableNotFound: isTableError,
                  viewingSeat: -1,
                  votingStartedAt: null,
                  bombPotVotingStartedAt: null,
                  boundaryPausePlayers: null,
                  streetSweeping: false,
                  runAnnouncement: null,
                  isRunItBoard: false,
                  knownCardCountAtRunIt: 0,
                  runDealStartedAt: null,
                  showdownStartedAt: null,
                  sevenTwoAnnouncement: null,
                  bombPotAnnouncement: null,
                  actionError: null,
                  ledger: [],
                  awayPlayerIds: [],
                  showdownPlayerSnapshot: {},
                  peekedCounts: {},
                  leaveQueued: false,
                  isFirstStateReceived: false,
                });
              }
              break;
            }
          }
        });

        _socket.addEventListener("close", () => set({ connectionStatus: "disconnected" }));

        if (typeof document !== "undefined") {
          if (_visibilityHandler) document.removeEventListener("visibilitychange", _visibilityHandler);
          if (_idleCleanup) _idleCleanup();

          const handleVisibilityChange = () => {
            if (_socket) {
              _socket.send(JSON.stringify({ type: "SET_AWAY", away: document.hidden }));
            }
          };
          document.addEventListener("visibilitychange", handleVisibilityChange);
          _visibilityHandler = handleVisibilityChange;

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
      })();
    },

    disconnect: () => {
      clearBoundaryPauseTimers();
      if (actionErrorTimer) {
        clearTimeout(actionErrorTimer);
        actionErrorTimer = null;
      }
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
      set({
        gameState: createPlaceholderPublicGameState(),
        myUserId: null,
        myPlayerId: null,
        connectionStatus: "disconnected",
        isCreator: false,
        myHoleCards: null,
        revealedHoleCards: {},
        myRevealedCardIndices: new Set<0 | 1>(),
        tableNotFound: false,
        viewingSeat: -1,
        votingStartedAt: null,
        bombPotVotingStartedAt: null,
        boundaryPausePlayers: null,
        streetSweeping: false,
        runAnnouncement: null,
        isRunItBoard: false,
        knownCardCountAtRunIt: 0,
        runDealStartedAt: null,
        showdownStartedAt: null,
        sevenTwoAnnouncement: null,
        bombPotAnnouncement: null,
        actionError: null,
        ledger: [],
        awayPlayerIds: [],
        showdownPlayerSnapshot: {},
        peekedCounts: {},
        leaveQueued: false,
        isFirstStateReceived: false,
      });
    },

    sendEvent: (event) => {
      if (!_socket) return;
      if (get().actionError) set({ actionError: null });
      _socket.send(JSON.stringify({ type: "GAME_EVENT", event }));
    },

    sitDown: (seatIndex, name, buyInCents) => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({ type: "TAKE_SEAT", playerId: myPlayerId, name, seatIndex, buyIn: buyInCents });
      set({ viewingSeat: seatIndex, leaveQueued: false });
    },

    requestBoundaryUpdate: ({ leaveSeat = false, moveToSeatIndex = null, chipDelta = 0 }) => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({
        type: "REQUEST_BOUNDARY_UPDATE",
        playerId: myPlayerId,
        leaveSeat,
        moveToSeatIndex,
        chipDelta,
      });
      if (moveToSeatIndex != null) {
        set({ viewingSeat: moveToSeatIndex });
      }
    },

    cancelBoundaryUpdate: () => {
      const myPlayerId = get().myPlayerId;
      if (!myPlayerId) return;
      get().sendEvent({ type: "CANCEL_BOUNDARY_UPDATE", playerId: myPlayerId });
      set({ leaveQueued: false });
    },

    standUp: () => {
      get().requestBoundaryUpdate({ leaveSeat: true });
      const phase = get().gameState.phase;
      if (phase === "waiting" || phase === "showdown") {
        set({ viewingSeat: -1, leaveQueued: false });
      }
    },

    queueLeave: () => {
      get().requestBoundaryUpdate({ leaveSeat: true });
      set({ leaveQueued: true });
    },

    cancelQueuedLeave: () => {
      get().cancelBoundaryUpdate();
      set({ leaveQueued: false });
    },

    changeSeat: (newSeatIndex: number) => {
      get().requestBoundaryUpdate({ moveToSeatIndex: newSeatIndex });
      set({ viewingSeat: newSeatIndex, leaveQueued: false });
    },

    shuffleSeats: () => {
      get().sendEvent({ type: "SHUFFLE_SEATS" });
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
      get().sendEvent({ type: "VOTE_RUN", playerId: myPlayerId, count });
    },

    resolveVote: () => {
      get().sendEvent({ type: "RESOLVE_VOTE" });
    },

    showCards: () => {
      const hiddenIndices = ([0, 1] as const).filter((index) => !get().myRevealedCardIndices.has(index));
      for (const index of hiddenIndices) {
        get().revealCard(index);
      }
    },

    revealCard: (cardIndex) => {
      if (!_socket) return;
      _socket.send(JSON.stringify({ type: "REVEAL_CARD", cardIndex }));
    },

    peekCard: (cardIndex) => {
      if (!_socket) return;
      _socket.send(JSON.stringify({
        type: "PEEK_CARD",
        cardIndex,
        handNumber: get().gameState.handNumber,
      }));
    },

    setSevenTwoBounty: (bountyBB) => {
      get().sendEvent({ type: "SET_SEVEN_TWO_BOUNTY", bountyBB });
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

    setAutoPeelEnabled: (enabled) => {
      writePersistedAutoPeelPreference(enabled);
      set({ autoPeelEnabled: enabled });
    },

    // ── Derived selectors ──

    getViewingPlayer: () => {
      const { gameState, viewingSeat } = get();
      return Object.values(gameState.players).find((p) => p.seatIndex === viewingSeat) ?? null;
    },

    getHoleCards: () => get().myHoleCards,

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

    getCurrentActorId: () => getActionableActor(get().gameState)?.id ?? null,

    isViewerTurn: () => {
      const { myPlayerId, gameState } = get();
      return !!myPlayerId && getActionableActor(gameState)?.id === myPlayerId;
    },

    getCallAmount: () => {
      const { gameState } = get();
      const actor = getActionableActor(gameState);
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
      const actor = getActionableActor(gameState);
      if (!actor) return false;
      return actor.currentBet === gameState.roundBet;
    },

    canRaise: () => {
      const { gameState } = get();
      const actor = getActionableActor(gameState);
      if (!actor) return false;
      return !gameState.closedActors.includes(actor.id);
    },

    canAllIn: () => {
      const { gameState } = get();
      const actor = getActionableActor(gameState);
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

    getSevenTwoBountyBB: () => get().gameState.sevenTwoBountyBB,
    getVoluntaryShownPlayerIds: () => get().gameState.voluntaryShownPlayerIds,
    getSevenTwoBountyTrigger: () => get().gameState.sevenTwoBountyTrigger,
    getBombPotVote: () => get().gameState.bombPotVote,
    getBombPotNextHand: () => get().gameState.bombPotNextHand,
    isBombPotHand: () => get().gameState.isBombPot,
    getCommunityCards2: () => get().gameState.communityCards2,
    getBombPotCooldown: () => get().gameState.bombPotCooldown,
    getViewerPendingBoundaryUpdate: () => {
      const { myPlayerId, gameState } = get();
      return myPlayerId ? gameState.pendingBoundaryUpdates?.[myPlayerId] ?? null : null;
    },

    getLedgerRows: () => deriveLedgerRows(get().ledger),

    getPayoutInstructions: () => derivePayoutInstructions(get().getLedgerRows()),
  };
});
