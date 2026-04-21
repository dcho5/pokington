function removePlayerInPlace(state, playerId) {
  const player = state.players[playerId];
  if (!player) return null;

  delete state.players[playerId];
  state.needsToAct = state.needsToAct.filter((id) => id !== playerId);
  state.closedActors = state.closedActors.filter((id) => id !== playerId);
  state.bombPotCooldown = state.bombPotCooldown.filter((id) => id !== playerId);
  if (state.bombPotVote?.proposedBy === playerId) {
    state.bombPotVote = null;
  } else if (state.bombPotVote && playerId in state.bombPotVote.votes) {
    delete state.bombPotVote.votes[playerId];
  }

  return { playerId, stack: player.stack };
}

export function removePlayersBeforeNextHand(gameState, queuedLeavePlayerIds = []) {
  const nextState = structuredClone(gameState);
  const queuedIds = Array.from(queuedLeavePlayerIds);
  const zeroStackIds = Object.values(nextState.players)
    .filter((player) => player.stack === 0)
    .map((player) => player.id);
  const candidateIds = [...new Set([...queuedIds, ...zeroStackIds])];
  const removedPlayers = [];

  for (const playerId of candidateIds) {
    const removed = removePlayerInPlace(nextState, playerId);
    if (removed) removedPlayers.push(removed);
  }

  return {
    gameState: nextState,
    removedPlayers,
  };
}
