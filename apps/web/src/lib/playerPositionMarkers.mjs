/**
 * @param {{
 *   isDealer?: boolean;
 *   isSmallBlind?: boolean;
 *   isBigBlind?: boolean;
 *   playerCount?: number;
 * }} [options]
 */
export function getPlayerPositionMarkers({
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  playerCount,
} = {}) {
  const markers = [];
  const isHeadsUpDealerSmallBlind = playerCount === 2 && isDealer && isSmallBlind;
  const showSmallBlind = isSmallBlind && !isHeadsUpDealerSmallBlind;

  if (isDealer) markers.push("dealer");
  if (showSmallBlind) markers.push("smallBlind");
  if (isBigBlind) markers.push("bigBlind");

  return markers;
}
