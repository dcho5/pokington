import type { GamePhase } from "@pokington/shared";

export interface LeaveQueueState {
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

export function shouldQueueLeave({
  phase,
  hasCards,
  currentBet,
  totalContribution,
  sitOutUntilBB,
}: LeaveQueueState): boolean {
  if (!ACTIVE_HAND_PHASES.has(phase)) return false;
  return hasCards || currentBet > 0 || totalContribution > 0 || !sitOutUntilBB;
}
