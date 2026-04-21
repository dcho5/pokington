import { canPlayerTableOwnHand } from "../lib/tableHandRules.mjs";

export function cardIndexToMask(cardIndex) {
  return cardIndex === 0 ? 1 : 2;
}

export function maskToPublicCards(holeCards, mask) {
  if (!holeCards || mask === 0) return null;
  return [
    mask & 1 ? holeCards[0] : null,
    mask & 2 ? holeCards[1] : null,
  ];
}

export function canPubliclyRevealCard({
  gameState,
  playerId,
  cardIndex,
  publicShownCardMasks,
}) {
  const bit = cardIndexToMask(cardIndex);
  const shownMask = publicShownCardMasks.get(playerId) ?? 0;
  if ((shownMask & bit) !== 0) return false;

  return canPlayerTableOwnHand({ gameState, playerId });
}

export function buildPublicRevealedHoleCards({
  gameState,
  publicShownCardMasks,
}) {
  const revealedHoleCards = {};

  for (const [playerId, mask] of publicShownCardMasks.entries()) {
    const player = gameState.players[playerId];
    const cards = maskToPublicCards(player?.holeCards ?? null, mask);
    if (cards) {
      revealedHoleCards[playerId] = cards;
    }
  }

  if (gameState.phase !== "showdown") {
    return revealedHoleCards;
  }

  const autoRevealReady =
    gameState.autoRevealWinningHands &&
    (gameState.autoRevealWinningHandsAt == null || Date.now() >= gameState.autoRevealWinningHandsAt);

  if (autoRevealReady) {
    for (const winner of gameState.winners ?? []) {
      const player = gameState.players[winner.playerId];
      if (!player?.holeCards) continue;
      revealedHoleCards[winner.playerId] = [player.holeCards[0], player.holeCards[1]];
    }
  }

  for (const shownPlayerId of gameState.voluntaryShownPlayerIds) {
    const player = gameState.players[shownPlayerId];
    if (!player?.holeCards) continue;
    revealedHoleCards[shownPlayerId] = [player.holeCards[0], player.holeCards[1]];
  }

  return revealedHoleCards;
}
