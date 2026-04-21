import {
  ANNOUNCE_DELAY_S,
  CHIP_DURATION_S,
  getRunTimings,
} from "@pokington/engine";

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

function buildRunChips(runWinners, baseDelay, runIndex, handNumber) {
  const seen = new Set();
  const chips = [];

  for (const winner of runWinners) {
    const tier = seen.has(winner.playerId) ? 1 : 0;
    if (!seen.has(winner.playerId)) {
      seen.add(winner.playerId);
    }

    const tierCount = chips.filter((chip) => chip.runIndex === runIndex && chip.tier === tier).length;
    const delaySeconds =
      tier === 0
        ? baseDelay + tierCount * 0.35
        : baseDelay + 0.8 + tierCount * 0.35;

    chips.push({
      winner,
      delaySeconds,
      chipKey: `h${handNumber}:winner_chip_landed:r${runIndex}:t${tier}:${winner.playerId}:${tierCount}`,
      runIndex,
      tier,
    });
  }

  return chips;
}

export function buildWinnerChipFeedbackPlan({
  winners = [],
  runResults,
  handNumber = 0,
  knownCardCount = 0,
  revealRunsConcurrently = false,
} = {}) {
  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount, { revealRunsConcurrently });

  if (runResults && runResults.length > 1) {
    return runResults.flatMap((run, runIndex) =>
      buildRunChips(
        run.winners ?? [],
        ANNOUNCE_DELAY_S + runIndex * runIntervalS + chipStartS,
        runIndex,
        handNumber,
      ),
    );
  }

  if (runResults && runResults.length === 1) {
    return buildRunChips(
      runResults[0].winners ?? [],
      ANNOUNCE_DELAY_S + chipStartS,
      0,
      handNumber,
    );
  }

  return winners.map((winner, index) => ({
    winner,
    delaySeconds: 0.4 + index * 0.35,
    chipKey: `h${handNumber}:winner_chip_landed:r0:t0:${winner.playerId}:${index}`,
    runIndex: 0,
    tier: 0,
  }));
}

export function buildWinnerChipLandingEvents(options = {}) {
  return buildWinnerChipFeedbackPlan(options).map((chip) => ({
    kind: "winner_chip_landed",
    key: chip.chipKey,
    handNumber: options.handNumber ?? 0,
    playerId: chip.winner.playerId,
    amount: chip.winner.amount,
    runIndex: chip.runIndex,
    tier: chip.tier,
    delayMs: Math.round((chip.delaySeconds + CHIP_DURATION_S) * 1000),
  }));
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
