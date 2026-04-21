export interface StreetSweepPlayerLike {
  id: string;
  seatIndex: number;
  currentBet?: number;
  totalContribution?: number;
}

export interface StreetSweepStateLike {
  phase?: string;
  players?: Record<string, StreetSweepPlayerLike | null | undefined>;
}

export function deriveStreetPauseChips(
  prevState?: StreetSweepStateLike | null,
  nextState?: StreetSweepStateLike | null,
): { id: string; seatIndex: number; amount: number }[] | null;
