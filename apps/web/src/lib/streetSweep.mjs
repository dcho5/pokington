function sumCurrentBets(players) {
  return players.reduce((sum, player) => sum + (player?.currentBet ?? 0), 0);
}

function getLatestConfirmedAction(feedback = []) {
  for (let index = feedback.length - 1; index >= 0; index -= 1) {
    const cue = feedback[index];
    if (cue?.kind === "player_action_confirmed") return cue;
  }
  return null;
}

function resolvePreBoundaryPlayers(prevState, feedback = []) {
  const actionCue = getLatestConfirmedAction(feedback);
  const players = Object.values(prevState.players ?? {}).map((player) => ({ ...player }));

  if (!actionCue) return players;

  return players.map((player) => {
    if (player.id !== actionCue.playerId) return player;
    return {
      ...player,
      currentBet: actionCue.currentBet,
      totalContribution: actionCue.totalContribution,
      isAllIn: actionCue.isAllIn,
      lastAction: actionCue.action,
    };
  });
}

export function deriveStreetPauseSnapshot(prevState, nextState, feedback = []) {
  if (!prevState || !nextState) return null;

  const resolvedPlayers = resolvePreBoundaryPlayers(prevState, feedback);
  const resolvedBetTotal = sumCurrentBets(resolvedPlayers);
  const nextPlayers = Object.values(nextState.players ?? {});
  const nextBetTotal = sumCurrentBets(nextPlayers);
  const actionCue = getLatestConfirmedAction(feedback);
  const boundaryTransitioned =
    nextState.phase !== prevState.phase ||
    (nextState.handNumber ?? 0) > (prevState.handNumber ?? 0);
  const shouldPauseBets =
    resolvedBetTotal > 0 && nextBetTotal === 0 && nextState.phase !== "waiting";
  const shouldPauseAction =
    actionCue &&
    boundaryTransitioned &&
    nextState.phase !== "waiting" &&
    (
      (nextState.players?.[actionCue.playerId]?.lastAction ?? null) !== actionCue.action ||
      (nextState.players?.[actionCue.playerId]?.currentBet ?? 0) !== actionCue.currentBet
    );

  if (!shouldPauseBets && !shouldPauseAction) {
    return null;
  }

  const players = [];
  for (const player of resolvedPlayers) {
    const nextPlayer = nextState.players?.[player.id];
    const returnedExcess = Math.max(
      0,
      (player.totalContribution ?? 0) - (nextPlayer?.totalContribution ?? 0),
    );
    const currentBet = Math.max(
      0,
      (player.currentBet ?? 0) - Math.min(player.currentBet ?? 0, returnedExcess),
    );
    const lastAction = player.lastAction ?? null;

    if (currentBet <= 0 && !lastAction) continue;

    players.push({
      id: player.id,
      seatIndex: player.seatIndex,
      currentBet,
      lastAction,
      isAllIn: player.isAllIn ?? false,
    });
  }

  return players.length > 0 ? players : null;
}
