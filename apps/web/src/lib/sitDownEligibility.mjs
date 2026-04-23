import { canApplySeatingUpdateImmediately } from "@pokington/engine";

function canViewerChangeSeats(phase, viewer) {
  if (!viewer) return false;
  if (!phase || phase === "waiting" || phase === "showdown") return true;
  return canApplySeatingUpdateImmediately({
    phase,
    hasCards: viewer.hasCards === true,
    currentBet: viewer.currentBet ?? 0,
    totalContribution: viewer.totalContribution ?? 0,
    sitOutUntilBB: viewer.sitOutUntilBB ?? false,
  });
}

export function classifySitDownRequest({ phase, myPlayerId, players, seatIndex }) {
  const viewer = myPlayerId ? players?.[myPlayerId] ?? null : null;

  if (!viewer) return "new-seat";
  if (viewer.stack === 0 && viewer.seatIndex === seatIndex) return "rebuy";
  if (canViewerChangeSeats(phase, viewer)) return "change-seat";
  return "blocked";
}
