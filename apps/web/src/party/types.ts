import type { GameState, EnginePlayer, GameEvent, WinnerInfo, RunResult, SidePot } from "@pokington/engine";
import type { Card, GamePhase } from "@pokington/shared";

// Re-export so consumers only need to import from one place
export type { GameEvent, WinnerInfo, RunResult, SidePot, GamePhase };

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

export function toPublicGameState(state: GameState): PublicGameState {
  const { deck, players, ...rest } = state;
  const publicPlayers: Record<string, PublicEnginePlayer> = {};
  for (const [id, p] of Object.entries(players)) {
    publicPlayers[id] = { ...p, holeCards: null, hasCards: p.holeCards !== null };
  }
  return { ...rest, deckSize: deck.length, players: publicPlayers };
}

// ── Client → Server messages ──
export type ClientMessage =
  | { type: "AUTH"; userId: string }
  | { type: "CONFIGURE"; tableName: string; blinds: { small: number; big: number }; sevenTwoBountyBB: 0 | 1 | 2 | 3 }
  | { type: "GAME_EVENT"; event: GameEvent }
  | { type: "REVEAL_CARD"; cardIndex: 0 | 1 };

// ── Server → Client messages ──
export type ServerMessage =
  | { type: "WELCOME"; yourUserId: string; isCreator: boolean }
  | { type: "STATE"; state: PublicGameState }
  | { type: "PRIVATE"; holeCards: [Card, Card] | null; revealedHoleCards: Record<string, [Card | null, Card | null]> }
  | { type: "ROOM_META"; creatorUserId: string | null; connectedUserIds: string[] }
  | { type: "ERROR"; code: string; message: string };
