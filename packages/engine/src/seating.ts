import type { GamePhase } from "@pokington/shared";

export interface SeatUpdateState {
  phase: GamePhase;
  hasCards: boolean;
  currentBet: number;
  totalContribution: number;
  sitOutUntilBB: boolean;
}

const ACTIVE_HAND_PHASES = new Set<GamePhase>([
  "pre-flop",
  "flop",
  "turn",
  "river",
  "voting",
  "showdown",
]);

export function isCommittedToCurrentHand({
  phase,
  hasCards,
  currentBet,
  totalContribution,
  sitOutUntilBB,
}: SeatUpdateState): boolean {
  if (!ACTIVE_HAND_PHASES.has(phase)) return false;
  return hasCards || currentBet > 0 || totalContribution > 0 || !sitOutUntilBB;
}

export function canApplySeatingUpdateImmediately(state: SeatUpdateState): boolean {
  return !isCommittedToCurrentHand(state);
}
