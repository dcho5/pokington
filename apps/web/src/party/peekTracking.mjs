const ACTIVE_PEEK_PHASES = new Set(["pre-flop", "flop", "turn", "river", "voting"]);

export function peekMaskCount(mask) {
  return (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0);
}

export function canAcceptPeek({ gameState, playerId, handNumber }) {
  if (!ACTIVE_PEEK_PHASES.has(gameState.phase)) return false;
  if (handNumber !== gameState.handNumber) return false;

  const player = gameState.players[playerId];
  if (!player) return false;
  if (!player.holeCards) return false;
  if (player.isFolded) return false;
  if (player.sitOutUntilBB) return false;

  return true;
}

export function getBroadcastPeekedCounts(gameState, peekedCardMasks) {
  if (!ACTIVE_PEEK_PHASES.has(gameState.phase)) return {};

  return Object.fromEntries(
    Array.from(peekedCardMasks.entries())
      .filter(([playerId]) => {
        const player = gameState.players[playerId];
        return !!player && !!player.holeCards && !player.sitOutUntilBB;
      })
      .map(([playerId, mask]) => [playerId, peekMaskCount(mask)]),
  );
}
