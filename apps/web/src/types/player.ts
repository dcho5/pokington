import type { Card } from "@pokington/shared";

/** Shared player shape used across all table UI components. */
export interface Player {
  id?: string;
  name: string;
  stack: number;
  seatIndex?: number;
  isAdmin?: boolean;
  isYou?: boolean;
  isCurrentActor?: boolean;
  currentBet?: number;
  isFolded?: boolean;
  isAllIn?: boolean;
  lastAction?: string | null;
  hasCards?: boolean;
  /** Hole cards exposed whenever that specific card is public to the table.
   *  A null slot (e.g. [Card, null]) means that specific card was not revealed. */
  holeCards?: [Card | null, Card | null] | null;
  /** Best visible poker hand label (e.g. "Full House", "A high") */
  handLabel?: string;
  /** Win animation type: "full" = sole winner, "partial" = split/side-pot/multi-run */
  winType?: "full" | "partial" | null;
  /** Changes each time this player wins a (new) run — used as animation key */
  winAnimationKey?: string | null;
  /** True when 7-2 game is live and this player can claim the bounty by showing their hand */
  sevenTwoEligible?: boolean;
  /** How many hole cards this player has peeled far enough to identify (0, 1, or 2) */
  peekedCount?: number;
  /** True when the player's browser tab is not visible (Page Visibility API) */
  isAway?: boolean;
}
