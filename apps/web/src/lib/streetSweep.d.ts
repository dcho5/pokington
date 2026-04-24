export interface StreetSweepPlayerLike {
  id: string;
  seatIndex: number;
  currentBet?: number;
  totalContribution?: number;
  lastAction?: string | null;
  isAllIn?: boolean;
}

export interface StreetSweepStateLike {
  phase?: string;
  handNumber?: number;
  players?: Record<string, StreetSweepPlayerLike | null | undefined>;
}

export interface StreetPauseSnapshotPlayer {
  id: string;
  seatIndex: number;
  currentBet: number;
  lastAction: string | null;
  isAllIn: boolean;
}

export interface StreetPauseFeedbackCueLike {
  kind: "player_action_confirmed";
  playerId: string;
  action: string;
  currentBet: number;
  totalContribution: number;
  isAllIn: boolean;
}

export function deriveStreetPauseSnapshot(
  prevState?: StreetSweepStateLike | null,
  nextState?: StreetSweepStateLike | null,
  feedback?: StreetPauseFeedbackCueLike[],
): StreetPauseSnapshotPlayer[] | null;
