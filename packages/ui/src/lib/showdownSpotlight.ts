import { compareHands, evaluateBest } from "@pokington/engine";
import type { Card } from "@pokington/shared";

export type Emphasis = "neutral" | "highlighted" | "dimmed";

export interface ShowdownSpotlightDisplayCard {
  key: string;
  card: Card | null;
  emphasis: Emphasis;
}

export interface ResolvedSpotlightPlayer {
  source: "selected" | "viewer";
  playerId: string | null;
  playerName: string;
  holeCards: [Card, Card];
}

export interface ShowdownSpotlightModel {
  playerId: string | null;
  playerName: string;
  contextLabel: string | null;
  handLabel: string | null;
  holeCards: [ShowdownSpotlightDisplayCard, ShowdownSpotlightDisplayCard];
  boardCards: ShowdownSpotlightDisplayCard[];
}

interface CardEntry {
  zone: "hole" | "board";
  index: number;
  key: string;
  card: Card;
}

interface Subset {
  entries: CardEntry[];
  hand: ReturnType<typeof evaluateBest>;
}

function hasTwoCards(cards: unknown): cards is [Card, Card] {
  return Array.isArray(cards) && cards.length === 2 && cards[0] != null && cards[1] != null;
}

function visibleCardCount(cards: (Card | null | undefined)[]): number {
  return Array.isArray(cards) ? cards.filter((card) => card != null).length : 0;
}

function hasFiveCards(cards: (Card | null | undefined)[]): boolean {
  return Array.isArray(cards) && cards.length >= 5 && cards.slice(0, 5).every((card) => card != null);
}

function buildEntries(holeCards: [Card, Card], boardCards: (Card | null | undefined)[]): CardEntry[] {
  return [
    ...holeCards.map((card, index) => ({ zone: "hole" as const, index, key: `hole-${index}`, card })),
    ...boardCards.slice(0, 5).filter((card): card is Card => card != null).map((card, index) => ({
      zone: "board" as const, index, key: `board-${index}`, card,
    })),
  ];
}

function compareEntryOrder(a: CardEntry, b: CardEntry): number {
  if (a.zone !== b.zone) return a.zone === "hole" ? -1 : 1;
  return a.index - b.index;
}

function compareBoardFirstPreference(a: Subset, b: Subset): number {
  const aHoleCount = a.entries.filter((e) => e.zone === "hole").length;
  const bHoleCount = b.entries.filter((e) => e.zone === "hole").length;
  if (aHoleCount !== bHoleCount) return bHoleCount - aHoleCount;

  const aBoardIndices = a.entries.filter((e) => e.zone === "board").map((e) => e.index).sort((l, r) => l - r);
  const bBoardIndices = b.entries.filter((e) => e.zone === "board").map((e) => e.index).sort((l, r) => l - r);
  for (let i = 0; i < Math.min(aBoardIndices.length, bBoardIndices.length); i++) {
    if (aBoardIndices[i] !== bBoardIndices[i]) return bBoardIndices[i] - aBoardIndices[i];
  }

  const aOrdered = [...a.entries].sort(compareEntryOrder);
  const bOrdered = [...b.entries].sort(compareEntryOrder);
  for (let i = 0; i < Math.min(aOrdered.length, bOrdered.length); i++) {
    const zoneCompare = compareEntryOrder(aOrdered[i], bOrdered[i]);
    if (zoneCompare !== 0) return -zoneCompare;
  }
  return 0;
}

function pickBestSubset(entries: CardEntry[]): Subset | null {
  let best: Subset | null = null;
  for (let a = 0; a < entries.length - 4; a++) {
    for (let b = a + 1; b < entries.length - 3; b++) {
      for (let c = b + 1; c < entries.length - 2; c++) {
        for (let d = c + 1; d < entries.length - 1; d++) {
          for (let e = d + 1; e < entries.length; e++) {
            const subsetEntries = [entries[a], entries[b], entries[c], entries[d], entries[e]];
            const hand = evaluateBest(subsetEntries.map((entry) => entry.card));
            const candidate: Subset = { entries: subsetEntries, hand };
            if (best == null) { best = candidate; continue; }
            const handCompare = compareHands(candidate.hand, best.hand);
            if (handCompare > 0) { best = candidate; continue; }
            if (handCompare === 0 && compareBoardFirstPreference(candidate, best) > 0) best = candidate;
          }
        }
      }
    }
  }
  return best;
}

function buildDisplayCards(
  cards: (Card | null | undefined)[],
  zone: "hole" | "board",
  highlightedKeys: Set<string> | null,
): ShowdownSpotlightDisplayCard[] {
  return cards.map((card, index) => ({
    key: `${zone}-${index}`,
    card: card ?? null,
    emphasis: card == null || highlightedKeys == null
      ? "neutral"
      : highlightedKeys.has(`${zone}-${index}`)
        ? "highlighted"
        : "dimmed",
  }));
}

export function isFullyTabled(cards?: [Card | null, Card | null] | null): boolean {
  return hasTwoCards(cards);
}

export function resolveSpotlightPlayer(options: {
  players?: Array<{ id?: string | null; name: string; isYou?: boolean } | null>;
  viewerHoleCards?: [Card, Card] | null;
} = {}): ResolvedSpotlightPlayer | null {
  const { players = [], viewerHoleCards = null } = options;
  const viewer = players.find((player) => player?.isYou);
  if (viewer && hasTwoCards(viewerHoleCards)) {
    return {
      source: "viewer",
      playerId: viewer.id ?? null,
      playerName: viewer.name,
      holeCards: viewerHoleCards,
    };
  }
  return null;
}

export function evaluateSevenCardHand(options: {
  holeCards?: [Card, Card] | null;
  boardCards?: readonly Card[] | null;
} = {}): { rank: number; tiebreakers: number[]; label: string } | null {
  const { holeCards = null, boardCards = [] } = options;
  const visibleBoardCards = Array.isArray(boardCards)
    ? boardCards.slice(0, 5).filter((card): card is Card => card != null)
    : [];
  if (!hasTwoCards(holeCards) || holeCards.length + visibleBoardCards.length < 5) return null;
  return evaluateBest([...holeCards, ...visibleBoardCards]);
}

export function mergeEmphasisArrays(
  emphasisArrays: Array<Array<Emphasis> | null | undefined> = [],
  fallbackLength = 0,
): Emphasis[] {
  const normalizedArrays = emphasisArrays.filter(
    (value): value is Emphasis[] => Array.isArray(value) && value.length > 0,
  );
  const maxLength = normalizedArrays.reduce((max, value) => Math.max(max, value.length), fallbackLength);
  return Array.from({ length: maxLength }, (_, index) => {
    const values = normalizedArrays.map((value) => value[index] ?? "neutral").filter(Boolean);
    if (values.includes("highlighted")) return "highlighted";
    if (values.includes("dimmed")) return "dimmed";
    return "neutral";
  });
}

export function resolveBombPotBoardIndex(options: {
  holeCards?: [Card, Card] | null;
  boardCards?: readonly Card[] | null;
  boardCards2?: readonly Card[] | null;
  hoveredBoardIndex?: 0 | 1 | null;
} = {}): 0 | 1 {
  const { holeCards = null, boardCards = [], boardCards2 = [], hoveredBoardIndex = null } = options;
  if (hoveredBoardIndex === 0 || hoveredBoardIndex === 1) return hoveredBoardIndex;

  const board1Ready = hasFiveCards(boardCards as (Card | null | undefined)[]);
  const board2Ready = hasFiveCards(boardCards2 as (Card | null | undefined)[]);
  if (board1Ready && !board2Ready) return 0;
  if (board2Ready && !board1Ready) return 1;
  if (!board1Ready && !board2Ready) return 0;

  const hand1 = evaluateSevenCardHand({ holeCards, boardCards: boardCards as Card[] });
  const hand2 = evaluateSevenCardHand({ holeCards, boardCards: boardCards2 as Card[] });
  if (!hand1 && !hand2) return 0;
  if (!hand1) return 1;
  if (!hand2) return 0;
  return compareHands(hand2, hand1) > 0 ? 1 : 0;
}

export function buildShowdownSpotlight(options: {
  playerId?: string | null;
  playerName?: string;
  holeCards?: [Card, Card] | null;
  boardCards?: readonly (Card | null | undefined)[] | null;
  contextLabel?: string | null;
} = {}): ShowdownSpotlightModel | null {
  const { playerId = null, playerName = "", holeCards = null, boardCards = [], contextLabel = null } = options;
  if (!hasTwoCards(holeCards)) return null;

  const visibleBoardCards = (boardCards ?? []).slice(0, 5) as (Card | null | undefined)[];
  const highlightKeys =
    holeCards.length + visibleCardCount(visibleBoardCards) >= 5
      ? new Set(pickBestSubset(buildEntries(holeCards, visibleBoardCards))?.entries.map((entry) => entry.key) ?? [])
      : null;
  const hand = highlightKeys == null ? null : evaluateSevenCardHand({ holeCards, boardCards: visibleBoardCards.filter((c): c is Card => c != null) });

  return {
    playerId,
    playerName,
    contextLabel,
    handLabel: hand?.label ?? null,
    holeCards: buildDisplayCards(holeCards, "hole", highlightKeys) as [ShowdownSpotlightDisplayCard, ShowdownSpotlightDisplayCard],
    boardCards: buildDisplayCards(Array.from({ length: 5 }, (_, i) => visibleBoardCards[i] ?? null), "board", highlightKeys),
  };
}
