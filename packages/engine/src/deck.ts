import type { Card, Rank, Suit } from "./types";

// Web Crypto API — available in all modern browsers and Node.js 19+.
// Declare minimal type since this package doesn't include DOM lib.
declare const crypto: { getRandomValues<T extends ArrayBufferView>(array: T): T };

/** Uniform random integer in [0, max) using rejection sampling to avoid modulo bias. */
function cryptoRandomInt(max: number): number {
  if (max <= 1) return 0;
  // Use plain JS Number arithmetic (not bitwise >>>0) to avoid uint32 overflow
  // when max divides 2^32 evenly (e.g. max=2: limit would be 4294967296, not 0).
  const limit = 4294967296 - (4294967296 % max);
  const buf = new Uint32Array(1);
  let val: number;
  do {
    crypto.getRandomValues(buf);
    val = buf[0]; // Uint32: [0, 4294967295]; limit is at most 4294967296, so val < limit always holds when no bias exists
  } while (val >= limit);
  return val % max;
}

const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

/** Create a fresh 52-card deck (unshuffled). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle using CSPRNG (in-place, returns same array). */
export function shuffle(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
