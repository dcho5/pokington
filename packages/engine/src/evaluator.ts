import type { Card, Rank, HandResult } from "./types";

// ── Rank numeric values ──
const RANK_VALUE: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

// Hand categories (higher = better)
const HIGH_CARD = 0;
const ONE_PAIR = 1;
const TWO_PAIR = 2;
const THREE_KIND = 3;
const STRAIGHT = 4;
const FLUSH = 5;
const FULL_HOUSE = 6;
const FOUR_KIND = 7;
const STRAIGHT_FLUSH = 8;

// ── 5-card evaluator ──
function evaluate5(cards: Card[]): HandResult {
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight: 5 consecutive, all unique
  if (new Set(values).size === 5 && values[0] - values[4] === 4) {
    isStraight = true;
    straightHigh = values[0];
  }
  // Wheel: A-2-3-4-5
  if (
    values[0] === 14 &&
    values[1] === 5 &&
    values[2] === 4 &&
    values[3] === 3 &&
    values[4] === 2
  ) {
    isStraight = true;
    straightHigh = 5;
  }

  // Count rank frequencies
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  // Sort groups: most frequent first, then by rank value
  const groups = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0]
  );

  // Classify hand
  if (isFlush && isStraight) {
    return {
      rank: STRAIGHT_FLUSH,
      tiebreakers: [straightHigh],
      label: straightHigh === 14 ? "Royal Flush" : "Straight Flush",
    };
  }
  if (groups[0][1] === 4) {
    return {
      rank: FOUR_KIND,
      tiebreakers: [groups[0][0], groups[1][0]],
      label: "Four of a Kind",
    };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      rank: FULL_HOUSE,
      tiebreakers: [groups[0][0], groups[1][0]],
      label: "Full House",
    };
  }
  if (isFlush) {
    return { rank: FLUSH, tiebreakers: values, label: "Flush" };
  }
  if (isStraight) {
    return { rank: STRAIGHT, tiebreakers: [straightHigh], label: "Straight" };
  }
  if (groups[0][1] === 3) {
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return {
      rank: THREE_KIND,
      tiebreakers: [groups[0][0], ...kickers],
      label: "Three of a Kind",
    };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return {
      rank: TWO_PAIR,
      tiebreakers: [...pairs, groups[2][0]],
      label: "Two Pair",
    };
  }
  if (groups[0][1] === 2) {
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return {
      rank: ONE_PAIR,
      tiebreakers: [groups[0][0], ...kickers],
      label: "One Pair",
    };
  }
  return { rank: HIGH_CARD, tiebreakers: values, label: "High Card" };
}

// ── Compare two hand results: positive if a wins, negative if b wins, 0 = tie ──
export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (
    let i = 0;
    i < Math.min(a.tiebreakers.length, b.tiebreakers.length);
    i++
  ) {
    if (a.tiebreakers[i] !== b.tiebreakers[i])
      return a.tiebreakers[i] - b.tiebreakers[i];
  }
  return 0;
}

// ── N-card evaluator: best 5 from any N >= 5 ──
export function evaluateBest(cards: Card[]): HandResult {
  if (cards.length === 5) return evaluate5(cards);
  const n = cards.length;
  let best: HandResult | null = null;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const result = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareHands(result, best) > 0) best = result;
          }
  return best!;
}

// ── 7-card evaluator: best 5 out of 7 ──
export function evaluate7(cards: Card[]): HandResult {
  return evaluateBest(cards);
}
