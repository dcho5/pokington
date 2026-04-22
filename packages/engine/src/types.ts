import type { Card, Rank, Suit, GamePhase, LastAction } from "@pokington/shared";

// Re-export shared types for convenience
export type { Card, Rank, Suit, GamePhase, LastAction };

// 7-2 bounty multiplier (in big blinds). 0 = off.
export type SevenTwoBountyBB = 0 | 2 | 4 | 8;
// Bomb pot ante (in big blinds).
export type BombPotAnteBB = 2 | 4 | 8;
export const RUN_IT_VOTING_TIMEOUT_MS = 30_000;
export const BOMB_POT_VOTING_TIMEOUT_MS = 30_000;

// ── Engine-internal player ──
export interface EnginePlayer {
  id: string;
  name: string;
  seatIndex: number;
  stack: number; // integer cents
  holeCards: [Card, Card] | null;
  currentBet: number;      // cents wagered in current betting round
  totalContribution: number; // cumulative cents wagered this entire hand (all streets)
  isFolded: boolean;
  isAllIn: boolean;
  lastAction: LastAction;
  sitOutUntilBB: boolean; // new players sit out until BB reaches their seat
}

// ── Side pot ──
export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[]; // non-folded players eligible to win this pot
}

export interface PendingBoundaryUpdate {
  playerId: string;
  leaveSeat: boolean;
  moveToSeatIndex: number | null;
  chipDelta: number;
  requestedAt: number;
}

// ── Full game state (engine-internal, contains hidden info) ──
export interface GameState {
  phase: GamePhase;
  deck: Card[];
  players: Record<string, EnginePlayer>; // keyed by player ID
  communityCards: Card[];
  pot: number;       // accumulated pot from completed streets (cents)
  roundBet: number;  // current highest bet this betting round
  lastLegalRaiseIncrement: number; // size of the last full legal raise; defaults to bigBlind
  isBlindIncomplete: boolean; // true when BB posted less than blinds.big (completion rule applies)
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  blinds: { small: number; big: number };
  handNumber: number;
  tableName: string;
  needsToAct: string[];   // ordered queue of player IDs
  closedActors: string[]; // players who matched the current bet; can only call/fold on partial re-open
  sidePots: SidePot[];    // populated at showdown
  winners: WinnerInfo[] | null;
  showdownKind: ShowdownKind;
  // Run-it-multiple-times
  runItVotes: Record<string, 1 | 2 | 3>; // votes during 'voting' phase
  runItVotingStartedAt: number | null;
  runCount: 1 | 2 | 3;   // resolved run count (1 = default)
  runResults: RunResult[]; // per-run boards + winners, populated at showdown
  autoRevealWinningHands: boolean; // true only when showdown is contested and winners must table
  autoRevealWinningHandsAt: number | null; // server-side release time for auto-revealed winning hands
  knownCardCountAtRunIt: number; // server-owned public board visibility anchor for animated runouts
  runDealStartedAt: number | null; // server-owned start timestamp for public board dealing
  showdownStartedAt: number | null; // server-owned showdown timestamp for synchronized reconnects
  nextHandStartsAt: number | null; // server-owned hand-boundary timer for synchronized reconnects
  // 7-2 Offsuit side game (table-level, set before first hand)
  sevenTwoBountyBB: SevenTwoBountyBB;  // 0 = off; N = N × bigBlind per player
  sevenTwoBountyTrigger: {           // non-null at showdown when bounty fires
    winnerId: string;
    perPlayer: number;               // cents collected from each player
    totalCollected: number;          // total added to winner's stack
  } | null;
  voluntaryShownPlayerIds: string[]; // players who explicitly showed their hand this round
  // Bomb pot
  communityCards2: Card[];
  isBombPot: boolean;
  bombPotVote: {
    anteBB: BombPotAnteBB;
    proposedBy: string;
    votes: Record<string, boolean>;
  } | null;
  bombPotVotingStartedAt: number | null;
  bombPotNextHand: { anteBB: BombPotAnteBB } | null;
  bombPotCooldown: string[]; // player IDs who proposed this orbit
  pendingBoundaryUpdates: Record<string, PendingBoundaryUpdate>;
}

export type ShowdownKind = "none" | "contested" | "uncontested";

export interface WinnerInfo {
  playerId: string;
  amount: number;
  hand: string | null; // actual evaluated hand only; null when the pot was won uncontested
}

export function isUncontestedWinnerHandLabel(hand: string): boolean {
  return hand === "Uncontested" || hand === "Last standing";
}

function inferShowdownKind(winners: WinnerInfo[] | null | undefined): ShowdownKind {
  if (!winners || winners.length === 0) return "none";
  if (winners.length === 1 && winners[0].hand === null) return "uncontested";
  if (
    winners.length === 1 &&
    typeof winners[0].hand === "string" &&
    isUncontestedWinnerHandLabel(winners[0].hand)
  ) {
    return "uncontested";
  }
  return "contested";
}

export function isUncontestedShowdown(
  winners: WinnerInfo[] | null | undefined,
  showdownKind?: ShowdownKind | null,
): boolean {
  return (showdownKind ?? inferShowdownKind(winners)) === "uncontested";
}

export function shouldAutoRevealWinningHands(
  winners: WinnerInfo[] | null | undefined,
  showdownKind?: ShowdownKind | null,
): boolean {
  return !!winners && winners.length > 0 && (showdownKind ?? inferShowdownKind(winners)) === "contested";
}

export interface RunResult {
  board: Card[];        // full 5-card board for this run
  winners: WinnerInfo[]; // winners specifically on this run's board
}

// ── Hand evaluation result ──
export interface HandResult {
  rank: number; // 0 (high card) – 8 (straight flush)
  tiebreakers: number[];
  label: string;
}

// ── Events (discriminated union) ──
export type GameEvent =
  | { type: "SIT_DOWN"; playerId: string; name: string; seatIndex: number; buyIn: number }
  | { type: "TAKE_SEAT"; playerId: string; name: string; seatIndex: number; buyIn: number }
  | { type: "CHANGE_SEAT"; playerId: string; seatIndex: number }
  | { type: "STAND_UP"; playerId: string }
  | {
      type: "REQUEST_BOUNDARY_UPDATE";
      playerId: string;
      leaveSeat: boolean;
      moveToSeatIndex: number | null;
      chipDelta: number;
    }
  | { type: "CANCEL_BOUNDARY_UPDATE"; playerId: string }
  | { type: "START_HAND" }
  | {
      type: "PLAYER_ACTION";
      playerId: string;
      action: "fold" | "check" | "call" | "raise" | "all-in";
      amount?: number; // total bet for raise
    }
  | { type: "VOTE_RUN"; playerId: string; count: 1 | 2 | 3 }
  | { type: "RESOLVE_VOTE" }  // force-resolve with current votes (timer expired)
  | { type: "SET_SEVEN_TWO_BOUNTY"; bountyBB: SevenTwoBountyBB } // pre-game config only
  | { type: "SHOW_CARDS"; playerId: string }   // voluntary card reveal at showdown
  | { type: "PROPOSE_BOMB_POT"; playerId: string; anteBB: BombPotAnteBB }
  | { type: "VOTE_BOMB_POT"; playerId: string; approve: boolean };

// ── Initial (empty) state factory ──
export function createInitialState(
  tableName: string,
  blinds: { small: number; big: number },
  options?: { sevenTwoBountyBB?: SevenTwoBountyBB }
): GameState {
  return {
    phase: "waiting",
    deck: [],
    players: {},
    communityCards: [],
    pot: 0,
    roundBet: 0,
    lastLegalRaiseIncrement: blinds.big,
    isBlindIncomplete: false,
    dealerSeatIndex: -1,
    smallBlindSeatIndex: -1,
    bigBlindSeatIndex: -1,
    blinds,
    handNumber: 0,
    tableName,
    needsToAct: [],
    closedActors: [],
    sidePots: [],
    winners: null,
    showdownKind: "none",
    runItVotes: {},
    runItVotingStartedAt: null,
    runCount: 1,
    runResults: [],
    autoRevealWinningHands: false,
    autoRevealWinningHandsAt: null,
    knownCardCountAtRunIt: 0,
    runDealStartedAt: null,
    showdownStartedAt: null,
    nextHandStartsAt: null,
    sevenTwoBountyBB: options?.sevenTwoBountyBB ?? 0,
    sevenTwoBountyTrigger: null,
    voluntaryShownPlayerIds: [],
    communityCards2: [],
    isBombPot: false,
    bombPotVote: null,
    bombPotVotingStartedAt: null,
    bombPotNextHand: null,
    bombPotCooldown: [],
    pendingBoundaryUpdates: {},
  };
}
