import { compareHands, evaluate7 } from "@pokington/engine";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["spades", "hearts", "diamonds", "clubs"];

export const RUN_IT_ODDS_STREETS = ["pre", "flop", "turn", "river"];

const FULL_DECK = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));

/**
 * @param {import("@pokington/shared").Card} card
 */
export function cardKey(card) {
  return `${card.rank}:${card.suit}`;
}

/**
 * @param {number} boardCount
 */
export function getRunItOddsStreet(boardCount = 0) {
  if (boardCount >= 5) return "river";
  if (boardCount >= 4) return "turn";
  if (boardCount >= 3) return "flop";
  return "pre";
}

/**
 * @param {number} boardCount
 */
export function resolveRunItOddsCalculationMode(boardCount = 0) {
  if (boardCount >= 5) return "final";
  if (boardCount >= 3) return "exact";
  return "sampled";
}

/**
 * @param {Array<import("types/player").Player | null>} players
 */
export function getLiveRunItPlayers(players = []) {
  return players.filter((player) => (
    player &&
    player.id &&
    player.hasCards &&
    !player.isFolded
  ));
}

/**
 * @param {import("types/player").Player | null | undefined} player
 * @returns {[import("@pokington/shared").Card, import("@pokington/shared").Card] | null}
 */
export function getFullyRevealedHoleCards(player) {
  if (!player?.holeCards?.[0] || !player?.holeCards?.[1]) return null;
  return [player.holeCards[0], player.holeCards[1]];
}

/**
 * @param {Array<import("types/player").Player | null>} players
 */
export function getRunItOddsContenders(players = []) {
  return getLiveRunItPlayers(players)
    .map((player) => {
      const holeCards = getFullyRevealedHoleCards(player);
      if (!holeCards || !player?.id) return null;
      return {
        playerId: player.id,
        playerName: player.name,
        holeCards,
      };
    })
    .filter(Boolean);
}

/**
 * @param {{
 *   phase?: string;
 *   players?: Array<import("types/player").Player | null>;
 *   runResults?: Array<{ board?: import("@pokington/shared").Card[] }>;
 * }} options
 */
export function shouldShowRunItOddsPanel({
  phase,
  players = [],
  runResults = [],
} = {}) {
  if (phase !== "showdown") return false;
  if ((runResults?.length ?? 0) < 2) return false;
  const livePlayers = getLiveRunItPlayers(players);
  if (livePlayers.length < 2) return false;
  return livePlayers.every((player) => getFullyRevealedHoleCards(player));
}

/**
 * @param {Record<string, number>} shares
 * @param {string[]} playerIds
 * @param {number} total
 */
function normalizePercentages(shares, playerIds, total) {
  return Object.fromEntries(
    playerIds.map((playerId) => [playerId, total > 0 ? (shares[playerId] ?? 0) * 100 / total : 0]),
  );
}

/**
 * @param {Array<{ playerId: string; holeCards: [import("@pokington/shared").Card, import("@pokington/shared").Card] }>} contenders
 * @param {import("@pokington/shared").Card[]} board
 */
function scoreBoard(contenders, board) {
  const shares = Object.fromEntries(contenders.map((contender) => [contender.playerId, 0]));
  let bestHand = null;
  /** @type {string[]} */
  let winners = [];

  for (const contender of contenders) {
    const hand = evaluate7([...board, ...contender.holeCards]);
    if (!bestHand || compareHands(hand, bestHand) > 0) {
      bestHand = hand;
      winners = [contender.playerId];
      continue;
    }
    if (compareHands(hand, bestHand) === 0) {
      winners.push(contender.playerId);
    }
  }

  const splitShare = winners.length > 0 ? 1 / winners.length : 0;
  for (const winnerId of winners) {
    shares[winnerId] += splitShare;
  }

  return shares;
}

/**
 * @param {Record<string, number>} target
 * @param {Record<string, number>} source
 */
function mergeShares(target, source) {
  for (const [playerId, share] of Object.entries(source)) {
    target[playerId] = (target[playerId] ?? 0) + share;
  }
}

/**
 * @param {number} seed
 */
export function createSeededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * @param {string} value
 */
export function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * @param {{
 *   players?: Array<import("types/player").Player | null>;
 *   runResults?: Array<{ board?: import("@pokington/shared").Card[] }>;
 *   currentRun?: number;
 * }} options
 */
export function buildRunItOddsContext({
  players = [],
  runResults = [],
  currentRun = 0,
} = {}) {
  const contenders = getRunItOddsContenders(players);
  const knownBoard = [...(runResults[currentRun]?.board ?? [])];
  const priorRunCards = runResults
    .slice(0, currentRun)
    .flatMap((run) => run?.board?.length === 5 ? run.board : []);
  const deadCardSet = new Set([
    ...contenders.flatMap((contender) => contender.holeCards.map(cardKey)),
    ...knownBoard.map(cardKey),
    ...priorRunCards.map(cardKey),
  ]);
  const remainingDeck = FULL_DECK.filter((card) => !deadCardSet.has(cardKey(card)));
  const street = getRunItOddsStreet(knownBoard.length);
  const mode = resolveRunItOddsCalculationMode(knownBoard.length);

  return {
    contenders,
    currentRun,
    knownBoard,
    knownBoardCount: knownBoard.length,
    priorRunCards,
    remainingDeck,
    street,
    mode,
    contextKey: [
      currentRun,
      street,
      contenders.map((contender) => `${contender.playerId}:${contender.holeCards.map(cardKey).join(",")}`).join("|"),
      knownBoard.map(cardKey).join(","),
      priorRunCards.map(cardKey).join(","),
    ].join("::"),
  };
}

/**
 * @param {ReturnType<typeof buildRunItOddsContext>} context
 */
export function calculateFinalRunItOdds(context) {
  const shares = scoreBoard(context.contenders, context.knownBoard);
  return normalizePercentages(shares, context.contenders.map((contender) => contender.playerId), 1);
}

/**
 * @param {ReturnType<typeof buildRunItOddsContext>} context
 */
export function calculateExactRunItOdds(context) {
  const missingCards = Math.max(0, 5 - context.knownBoard.length);
  if (missingCards === 0) return calculateFinalRunItOdds(context);

  const playerIds = context.contenders.map((contender) => contender.playerId);
  const aggregateShares = Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
  let outcomeCount = 0;

  if (missingCards === 1) {
    for (let index = 0; index < context.remainingDeck.length; index += 1) {
      mergeShares(
        aggregateShares,
        scoreBoard(context.contenders, [...context.knownBoard, context.remainingDeck[index]]),
      );
      outcomeCount += 1;
    }
    return normalizePercentages(aggregateShares, playerIds, outcomeCount);
  }

  for (let first = 0; first < context.remainingDeck.length - 1; first += 1) {
    for (let second = first + 1; second < context.remainingDeck.length; second += 1) {
      mergeShares(
        aggregateShares,
        scoreBoard(context.contenders, [
          ...context.knownBoard,
          context.remainingDeck[first],
          context.remainingDeck[second],
        ]),
      );
      outcomeCount += 1;
    }
  }

  return normalizePercentages(aggregateShares, playerIds, outcomeCount);
}

/**
 * @param {import("@pokington/shared").Card[]} cards
 * @param {() => number} rng
 * @param {number} drawCount
 */
function drawCards(cards, rng, drawCount) {
  const deck = cards.slice();
  const drawn = [];
  for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
    const nextIndex = Math.floor(rng() * deck.length);
    drawn.push(deck[nextIndex]);
    deck[nextIndex] = deck[deck.length - 1];
    deck.pop();
  }
  return drawn;
}

/**
 * @param {ReturnType<typeof buildRunItOddsContext>} context
 * @param {{ sampleCount?: number; rng?: () => number }} [options]
 */
export function createMonteCarloOddsAccumulator(context, options = {}) {
  const sampleCount = Math.max(1, options.sampleCount ?? 20000);
  const rng = options.rng ?? Math.random;
  const playerIds = context.contenders.map((contender) => contender.playerId);
  const aggregateShares = Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
  let completed = 0;

  return {
    sampleCount,
    /**
     * @param {number} batchSize
     */
    runBatch(batchSize = 1000) {
      const drawsRemaining = Math.max(0, 5 - context.knownBoard.length);
      const batchTotal = Math.min(batchSize, sampleCount - completed);

      for (let batchIndex = 0; batchIndex < batchTotal; batchIndex += 1) {
        const sampledBoard = drawsRemaining > 0
          ? [...context.knownBoard, ...drawCards(context.remainingDeck, rng, drawsRemaining)]
          : context.knownBoard;
        mergeShares(aggregateShares, scoreBoard(context.contenders, sampledBoard));
      }

      completed += batchTotal;
      return {
        completed,
        sampleCount,
        done: completed >= sampleCount,
        percentages: normalizePercentages(aggregateShares, playerIds, completed),
      };
    },
  };
}
