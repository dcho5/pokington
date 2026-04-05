// ── Card primitives ──
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';
export type Suit = 'spades'|'hearts'|'diamonds'|'clubs';
export interface Card { rank: Rank; suit: Suit; }

// ── Game state ──
export type GamePhase = 'waiting'|'pre-flop'|'flop'|'turn'|'river'|'voting'|'showdown';
export type LastAction = 'fold'|'check'|'call'|'raise'|'all-in'|null;

export interface PublicPlayerState {
  id: string;
  name: string;
  seatIndex: number;
  stack: number;          // integer cents
  isFolded: boolean;
  isCurrentActor: boolean;
  lastAction: LastAction;
  cardCount: 0 | 2;
}

export interface PrivateStatePayload {
  holeCards: [Card, Card] | null;
  handStrength: string | null;   // "Flush", "Two Pair", etc.
}

export interface TableStatePayload {
  tableName: string;
  handNumber: number;
  phase: GamePhase;
  players: Record<string, PublicPlayerState>;
  communityCards: Card[];
  pot: number;            // integer cents
  blinds: { small: number; big: number };
  dealerSeatIndex: number;
}

export const MAX_PLAYERS = 10;
export const DEFAULT_SMALL_BLIND = 10;
export const DEFAULT_BIG_BLIND = 25;
