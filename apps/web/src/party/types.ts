import type {
  GameState,
  EnginePlayer,
  GameEvent,
  WinnerInfo,
  RunResult,
  SidePot,
  SevenTwoBountyBB,
  GameFeedbackCueEnvelope,
} from "@pokington/engine";
import type { Card, GamePhase } from "@pokington/shared";
import { buildPublicGameState } from "./publicState.mjs";

// Re-export so consumers only need to import from one place
export type { GameEvent, WinnerInfo, RunResult, SidePot, GamePhase };
export const PROTOCOL_VERSION = 4;
export const CORE_SEVEN_TWO_BOUNTY_BB = 0;

// ── Public player: same as EnginePlayer but holeCards is always null, hasCards added ──
export type PublicEnginePlayer = Omit<EnginePlayer, "holeCards"> & {
  holeCards: null;
  hasCards: boolean; // true if the player was dealt cards (derived before stripping)
};

// ── Public game state: deck removed, all holeCards nulled ──
export type PublicGameState = Omit<GameState, "deck" | "players"> & {
  deckSize: number;
  players: Record<string, PublicEnginePlayer>;
};

export function toPublicGameState(state: GameState, now = Date.now()): PublicGameState {
  return buildPublicGameState(state, now) as PublicGameState;
}

export type TableStatus = "creating" | "active" | "archived" | "error";

export interface TableBlinds {
  small: number;
  big: number;
}

export interface CreateTableRequest {
  tableName: string;
  blinds: TableBlinds;
  creatorClientId: string;
  sevenTwoBountyBB?: SevenTwoBountyBB;
}

export interface CreateTableResponse {
  code: string;
  tableId: string;
  joinUrl: string;
  status: TableStatus;
}

export interface GetTableResponse {
  exists: boolean;
  status: TableStatus | null;
  tableName: string | null;
  blinds: TableBlinds | null;
}

export interface JoinTableRequest {
  clientId: string;
}

export interface JoinTableResponse {
  token: string;
  tableId: string;
  playerSessionId: string;
  isCreator: boolean;
}

// ── Client → Server messages ──
export type ClientMessage =
  | { type: "AUTH"; token: string; protocolVersion: number }
  | { type: "GAME_EVENT"; event: GameEvent }
  | { type: "REVEAL_CARD"; cardIndex: 0 | 1 }
  | { type: "SET_AWAY"; away: boolean }
  | { type: "PEEK_CARD"; cardIndex: 0 | 1; handNumber: number }
  | { type: "QUEUE_LEAVE" }
  | { type: "CANCEL_QUEUE_LEAVE" };

// ── Session ledger ──

export interface LedgerEntry {
  playerId: string;
  name: string;
  buyIns: number[];      // one entry per SIT_DOWN (cents)
  cashOuts: number[];    // one entry per STAND_UP (cents)
  isSeated: boolean;
  currentStack: number;  // live stack if seated; 0 if not
}

export interface LedgerRow {
  playerId: string;
  name: string;
  totalBuyIn: number;
  totalCashOut: number;  // realized cashOuts + currentStack
  net: number;           // totalCashOut - totalBuyIn
  isSeated: boolean;
}

export interface PayoutInstruction {
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  amount: number;        // cents
}

// ── Server → Client messages ──
export type ServerMessage =
  | { type: "WELCOME"; playerSessionId: string; isCreator: boolean }
  | { type: "TABLE_STATE"; state: PublicGameState; feedback?: GameFeedbackCueEnvelope[] }
  // Includes any currently public hole-card slots for this hand, including the
  // viewer's own public cards so reconnects can restore reveal state locally.
  | { type: "PRIVATE_STATE"; holeCards: [Card, Card] | null; revealedHoleCards: Record<string, [Card | null, Card | null]> }
  | {
      type: "ROOM_PRESENCE";
      connectedPlayerIds: string[];
      awayPlayerIds: string[];
      peekedCounts: Record<string, number>;
      queuedLeavePlayerIds: string[];
    }
  | { type: "LEDGER_STATE"; entries: LedgerEntry[] }
  | { type: "ERROR"; code: string; message: string };
