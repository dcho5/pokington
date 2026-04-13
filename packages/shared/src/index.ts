// ── Card primitives ──
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';
export type Suit = 'spades'|'hearts'|'diamonds'|'clubs';
export interface Card { rank: Rank; suit: Suit; }

// ── Game state ──
export type GamePhase = 'waiting'|'pre-flop'|'flop'|'turn'|'river'|'voting'|'showdown';
export type LastAction = 'fold'|'check'|'call'|'raise'|'all-in'|null;
