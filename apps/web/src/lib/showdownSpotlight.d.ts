import type { Card } from "@pokington/shared";
import type { Player } from "types/player";

export interface ShowdownSpotlightDisplayCard {
  key: string;
  card: Card | null;
  emphasis: "neutral" | "highlighted" | "dimmed";
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

export function isFullyTabled(cards?: [Card | null, Card | null] | null): boolean;

export function resolveSpotlightPlayer(options?: {
  players?: Array<Player | null>;
  viewerHoleCards?: [Card, Card] | null;
}): ResolvedSpotlightPlayer | null;

export function evaluateSevenCardHand(options?: {
  holeCards?: [Card, Card] | null;
  boardCards?: readonly Card[] | null;
}): { rank: number; tiebreakers: number[]; label: string } | null;

export function mergeEmphasisArrays(
  emphasisArrays?: Array<Array<"neutral" | "highlighted" | "dimmed"> | null | undefined>,
  fallbackLength?: number,
): Array<"neutral" | "highlighted" | "dimmed">;

export function resolveBombPotBoardIndex(options?: {
  holeCards?: [Card, Card] | null;
  boardCards?: readonly Card[] | null;
  boardCards2?: readonly Card[] | null;
  hoveredBoardIndex?: 0 | 1 | null;
}): 0 | 1;

export function buildShowdownSpotlight(options?: {
  playerId?: string | null;
  playerName?: string;
  holeCards?: [Card, Card] | null;
  boardCards?: readonly Card[] | null;
  contextLabel?: string | null;
}): ShowdownSpotlightModel | null;
