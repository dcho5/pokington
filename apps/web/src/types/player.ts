import type { Card } from "@pokington/shared";

/** Shared player shape used across all table UI components. */
export interface Player {
  id?: string;
  name: string;
  stack: number;
  isAdmin?: boolean;
  isYou?: boolean;
  isCurrentActor?: boolean;
  currentBet?: number;
  isFolded?: boolean;
  isAllIn?: boolean;
  lastAction?: string | null;
  hasCards?: boolean;
  /** Hole cards exposed only during showdown (null at all other times).
   *  A null slot (e.g. [Card, null]) means that specific card was not revealed. */
  holeCards?: [Card | null, Card | null] | null;
  /** Winning hand label (e.g. "Full House") — set for winners at showdown */
  handLabel?: string;
  /** Win animation type: "full" = sole winner, "partial" = split/side-pot/multi-run */
  winType?: "full" | "partial" | null;
  /** Changes each time this player wins a (new) run — used as animation key */
  winAnimationKey?: string | null;
  /** True when 7-2 game is live and this player can claim the bounty by showing their hand */
  sevenTwoEligible?: boolean;
}
