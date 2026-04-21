export function deriveStreetPauseChips(prevState, nextState) {
  if (!prevState || !nextState) return null;

  const prevPlayers = Object.values(prevState.players ?? {});
  const prevBetTotal = prevPlayers.reduce((sum, player) => sum + (player?.currentBet ?? 0), 0);
  const nextBetTotal = Object.values(nextState.players ?? {}).reduce(
    (sum, player) => sum + (player?.currentBet ?? 0),
    0,
  );

  if (prevBetTotal <= 0 || nextBetTotal !== 0 || nextState.phase === "waiting") {
    return null;
  }

  const chips = [];
  for (const player of prevPlayers) {
    if (!player || (player.currentBet ?? 0) <= 0) continue;

    const nextPlayer = nextState.players?.[player.id];
    const returnedExcess = Math.max(
      0,
      (player.totalContribution ?? 0) - (nextPlayer?.totalContribution ?? 0),
    );
    const amount = Math.max(0, (player.currentBet ?? 0) - Math.min(player.currentBet ?? 0, returnedExcess));

    if (amount <= 0) continue;

    chips.push({
      id: player.id,
      seatIndex: player.seatIndex,
      amount,
    });
  }

  return chips.length > 0 ? chips : null;
}
