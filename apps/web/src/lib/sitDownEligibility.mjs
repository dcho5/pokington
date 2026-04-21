function isWaitingPhase(phase) {
  return !phase || phase === "waiting";
}

export function classifySitDownRequest({ phase, myPlayerId, players, seatIndex }) {
  const viewer = myPlayerId ? players?.[myPlayerId] ?? null : null;

  if (!viewer) return "new-seat";
  if (viewer.stack === 0 && (isWaitingPhase(phase) || phase === "showdown")) {
    return viewer.seatIndex === seatIndex ? "rebuy" : "blocked";
  }
  if (isWaitingPhase(phase)) return "change-seat";
  return "blocked";
}
