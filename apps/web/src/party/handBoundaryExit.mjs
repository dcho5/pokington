function clonePlayerSnapshot(player) {
  return player ? { ...player } : null;
}

function removePlayerInPlace(state, playerId) {
  const player = state.players[playerId];
  if (!player) return null;

  delete state.players[playerId];
  delete state.pendingBoundaryUpdates[playerId];
  state.needsToAct = state.needsToAct.filter((id) => id !== playerId);
  state.closedActors = state.closedActors.filter((id) => id !== playerId);
  state.bombPotCooldown = state.bombPotCooldown.filter((id) => id !== playerId);
  if (state.bombPotVote?.proposedBy === playerId) {
    state.bombPotVote = null;
  } else if (state.bombPotVote && playerId in state.bombPotVote.votes) {
    delete state.bombPotVote.votes[playerId];
  }

  return clonePlayerSnapshot(player);
}

function canMoveToSeat(state, playerId, seatIndex) {
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= 10) return false;
  return !Object.values(state.players).some((player) => player.id !== playerId && player.seatIndex === seatIndex);
}

export function applyPendingBoundaryUpdates(gameState) {
  const nextState = structuredClone(gameState);
  const updates = Object.values(nextState.pendingBoundaryUpdates ?? {})
    .sort((a, b) => (a.requestedAt ?? 0) - (b.requestedAt ?? 0));
  const realizedTransitions = [];
  const beforeByPlayerId = new Map(
    Object.entries(gameState.players ?? {}).map(([playerId, player]) => [playerId, clonePlayerSnapshot(player)]),
  );

  for (const update of updates) {
    if (!update.leaveSeat) continue;
    const beforePlayer = beforeByPlayerId.get(update.playerId) ?? null;
    const removed = removePlayerInPlace(nextState, update.playerId);
    if (removed && beforePlayer) {
      realizedTransitions.push({
        playerId: update.playerId,
        beforePlayer,
        afterPlayer: null,
      });
    }
  }

  for (const update of updates) {
    if (update.leaveSeat) continue;
    const player = nextState.players[update.playerId];
    const beforePlayer = beforeByPlayerId.get(update.playerId) ?? null;
    if (!player || !beforePlayer) {
      delete nextState.pendingBoundaryUpdates[update.playerId];
      continue;
    }

    if (update.moveToSeatIndex != null && update.moveToSeatIndex !== player.seatIndex && canMoveToSeat(nextState, update.playerId, update.moveToSeatIndex)) {
      player.seatIndex = update.moveToSeatIndex;
    }

    if (Number.isSafeInteger(update.chipDelta) && update.chipDelta !== 0) {
      const nextStack = player.stack + update.chipDelta;
      if (update.chipDelta > 0 || nextStack > 0) {
        player.stack = nextStack;
      }
    }

    if (player.stack > 0) {
      player.sitOutUntilBB = false;
      player.isAllIn = false;
    } else {
      player.isAllIn = true;
    }

    delete nextState.pendingBoundaryUpdates[update.playerId];

    if (player.seatIndex !== beforePlayer.seatIndex || player.stack !== beforePlayer.stack) {
      realizedTransitions.push({
        playerId: update.playerId,
        beforePlayer,
        afterPlayer: clonePlayerSnapshot(player),
      });
    }
  }

  return {
    gameState: nextState,
    realizedTransitions,
  };
}
