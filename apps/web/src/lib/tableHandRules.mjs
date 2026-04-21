const LIVE_TABLE_HAND_PHASES = new Set(["pre-flop", "flop", "turn", "river", "voting"]);

export const DEFAULT_TABLE_HAND_RULES = Object.freeze({
  // Keep this centralized so a future table-level toggle can swap the policy
  // without reopening every reveal callsite.
  allowOffTurnDuringLiveHand: true,
});

function playerStillHasHand(player) {
  return !!player && (player.holeCards != null || player.hasCards === true);
}

export function canPlayerTableOwnHand({
  gameState,
  playerId,
  rules = DEFAULT_TABLE_HAND_RULES,
}) {
  const player = gameState.players?.[playerId];
  if (!playerStillHasHand(player) || player.sitOutUntilBB) return false;

  if (gameState.phase === "showdown") return true;
  if (!LIVE_TABLE_HAND_PHASES.has(gameState.phase)) return false;
  if (player.isFolded) return false;

  if (rules.allowOffTurnDuringLiveHand) {
    return true;
  }

  return gameState.needsToAct?.[0] === playerId;
}
