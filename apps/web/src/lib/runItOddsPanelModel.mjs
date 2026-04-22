import { RUN_IT_ODDS_STREETS, getRunItOddsStreet, resolveRunItOddsCalculationMode } from "./runItOdds.mjs";

export { RUN_IT_ODDS_STREETS, getRunItOddsStreet, resolveRunItOddsCalculationMode };

/**
 * @param {{
 *   handNumber?: number;
 *   showdownStartedAt?: number | null;
 *   runDealStartedAt?: number | null;
 * }} options
 */
export function createRunItOddsSessionKey({
  handNumber = 0,
  showdownStartedAt = null,
  runDealStartedAt = null,
} = {}) {
  return `${handNumber}:${showdownStartedAt ?? "no-showdown"}:${runDealStartedAt ?? "no-run-deal"}`;
}

/**
 * @param {Record<number, Record<string, Record<string, number>>>} historyByRun
 * @param {{
 *   runIndex: number;
 *   street: string;
 *   percentages: Record<string, number>;
 * }} update
 */
export function lockRunItStreetSnapshot(historyByRun, { runIndex, street, percentages }) {
  return {
    ...historyByRun,
    [runIndex]: {
      ...(historyByRun[runIndex] ?? {}),
      [street]: { ...percentages },
    },
  };
}

/**
 * @param {Record<number, Record<string, Record<string, number>>>} historyByRun
 * @param {number} runIndex
 * @param {string} street
 * @param {string} playerId
 */
function getLatestResolvedPercentage(historyByRun, runIndex, street, playerId) {
  const streetIndex = RUN_IT_ODDS_STREETS.indexOf(street);
  for (let index = streetIndex; index >= 0; index -= 1) {
    const value = historyByRun?.[runIndex]?.[RUN_IT_ODDS_STREETS[index]]?.[playerId];
    if (typeof value === "number") return value;
  }
  return null;
}

/**
 * @param {{
 *   contenders: Array<{
 *     playerId: string;
 *     playerName: string;
 *     holeCards: [import("@pokington/shared").Card, import("@pokington/shared").Card];
 *   }>;
 *   historyByRun?: Record<number, Record<string, Record<string, number>>>;
 *   currentRun: number;
 *   currentStreet: string;
 *   currentPercentages?: Record<string, number>;
 * }} options
 */
export function buildRunItOddsRows({
  contenders,
  historyByRun = {},
  currentRun,
  currentStreet,
  currentPercentages = {},
}) {
  return contenders.map((contender) => {
    const streetPercentages = Object.fromEntries(
      RUN_IT_ODDS_STREETS.map((street) => {
        if (street === currentStreet && typeof currentPercentages[contender.playerId] === "number") {
          return [street, currentPercentages[contender.playerId]];
        }
        return [street, historyByRun?.[currentRun]?.[street]?.[contender.playerId] ?? null];
      }),
    );

    return {
      ...contender,
      currentPercentage:
        typeof currentPercentages[contender.playerId] === "number"
          ? currentPercentages[contender.playerId]
          : getLatestResolvedPercentage(historyByRun, currentRun, currentStreet, contender.playerId),
      streetPercentages,
    };
  });
}
