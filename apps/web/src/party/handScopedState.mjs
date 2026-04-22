export function shouldClearHandScopedState(prevGameState, nextGameState) {
  if (!nextGameState) return true;
  if (nextGameState.phase === "waiting") return true;
  if (!prevGameState) return false;

  return (
    nextGameState.handNumber !== prevGameState.handNumber ||
    (prevGameState.phase === "showdown" && nextGameState.phase !== "showdown")
  );
}

export function restoreHandScopedMapEntries(entries, gameState, trackedHandNumber) {
  if (!gameState || gameState.phase === "waiting") return new Map();
  if (trackedHandNumber == null || trackedHandNumber !== gameState.handNumber) return new Map();
  return new Map(entries ?? []);
}
