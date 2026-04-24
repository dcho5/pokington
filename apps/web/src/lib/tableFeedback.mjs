export function collectBoardRevealEvents({
  previousCounts = [],
  nextCounts = [],
  handNumber = 0,
  mode = "single",
} = {}) {
  const events = [];
  const totalLanes = Math.max(previousCounts.length, nextCounts.length);

  for (let laneIndex = 0; laneIndex < totalLanes; laneIndex += 1) {
    const previousCount = previousCounts[laneIndex] ?? 0;
    const nextCount = nextCounts[laneIndex] ?? 0;
    for (let cardIndex = previousCount; cardIndex < nextCount; cardIndex += 1) {
      const boardIndex = mode === "bombPot" ? laneIndex : 0;
      const runIndex = mode === "runIt" ? laneIndex : undefined;
      const laneLabel = mode === "runIt" ? `run-${laneIndex}` : `board-${boardIndex}`;
      events.push({
        kind: "board_card_revealed",
        key: `h${handNumber}:board_card_revealed:${laneLabel}:card-${cardIndex}`,
        handNumber,
        boardIndex,
        ...(runIndex != null ? { runIndex } : {}),
        cardIndex,
      });
    }
  }

  return events;
}

export function markFeedbackKey(seenKeys, key, maxEntries = 512) {
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  if (seenKeys.size > maxEntries) {
    const oldest = seenKeys.values().next().value;
    if (oldest) seenKeys.delete(oldest);
  }
  return true;
}
