// ── Card primitives ──
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';
export type Suit = 'spades'|'hearts'|'diamonds'|'clubs';
export interface Card { rank: Rank; suit: Suit; }

/** Converts an integer cent value to a formatted dollar string, e.g. 1050 -> "$10.50". */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Parse a dollar string like "$12.50" or "12.50" to cents. Returns null if invalid. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Blind level cent values corresponding 1-to-1 with BLIND_OPTIONS. */
export const BLIND_CENTS: Array<{ small: number; big: number }> = [
  { small: 10, big: 25 },
  { small: 25, big: 50 },
  { small: 50, big: 100 },
  { small: 100, big: 200 },
];

/** Blind level options shown on the home / create-table UI. */
export const BLIND_OPTIONS = [
  "10¢ / 25¢",
  "25¢ / 50¢",
  "50¢ / $1",
  "$1 / $2",
] as const;

/** 7-2 offsuit bounty multiplier options. */
export const BOUNTY_OPTIONS = [
  "Off",
  "2x BB",
  "4x BB",
  "8x BB",
] as const;

/** Cent values corresponding 1-to-1 with BOUNTY_OPTIONS (index 0 = off). */
export const BOUNTY_VALUES = [0, 2, 4, 8] as const;

/** Bomb pot ante multipliers supported by both UI and engine. */
export const BOMB_POT_ANTE_BB_VALUES = [2, 4, 8] as const;

/**
 * Returns the three standard buy-in preset amounts (in dollars)
 * for a given big-blind size in cents.
 */
export function getBuyInPresets(bigBlindCents: number) {
  const bb = bigBlindCents / 100;
  return [
    { label: "50×", dollars: bb * 50 },
    { label: "100×", dollars: bb * 100 },
    { label: "200×", dollars: bb * 200 },
  ];
}

// ── Game state ──
export type GamePhase = 'waiting'|'pre-flop'|'flop'|'turn'|'river'|'voting'|'showdown';
export type LastAction = 'fold'|'check'|'call'|'raise'|'all-in'|null;
