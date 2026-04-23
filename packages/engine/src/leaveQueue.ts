import type { GamePhase } from "@pokington/shared";
import { isCommittedToCurrentHand } from "./seating";

export interface LeaveQueueState {
  phase: GamePhase;
  hasCards: boolean;
  currentBet: number;
  totalContribution: number;
  sitOutUntilBB: boolean;
}

export function shouldQueueLeave({
  phase,
  hasCards,
  currentBet,
  totalContribution,
  sitOutUntilBB,
}: LeaveQueueState): boolean {
  return isCommittedToCurrentHand({
    phase,
    hasCards,
    currentBet,
    totalContribution,
    sitOutUntilBB,
  });
}
