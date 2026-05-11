import { compareHands, evaluate7 } from "./evaluator";
import type { Card } from "./types";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;

export const RUN_IT_ODDS_STREETS = ["pre", "flop", "turn", "river"] as const;

export type RunItOddsStreet = (typeof RUN_IT_ODDS_STREETS)[number];
export type RunItOddsCalculationMode = "sampled" | "exact" | "final";

export interface RunItOddsPlayerLike {
  id?: string | null;
  name?: string | null;
  hasCards?: boolean | null;
  isFolded?: boolean | null;
  holeCards?: [Card | null, Card | null] | null;
}

export interface RunItOddsContender {
  playerId: string;
  playerName?: string | null;
  holeCards: [Card, Card];
}

export interface RunItOddsContext {
  contenders: RunItOddsContender[];
  currentRun: number;
  knownBoard: Card[];
  knownBoardCount: number;
  priorRunCards: Card[];
  remainingDeck: Card[];
  street: RunItOddsStreet;
  mode: RunItOddsCalculationMode;
  contextKey: string;
}

const FULL_DECK: Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));

export function cardKey(card: Card) {
  return `${card.rank}:${card.suit}`;
}

export function getRunItOddsStreet(boardCount = 0): RunItOddsStreet {
  if (boardCount >= 5) return "river";
  if (boardCount >= 4) return "turn";
  if (boardCount >= 3) return "flop";
  return "pre";
}

export function resolveRunItOddsCalculationMode(boardCount = 0): RunItOddsCalculationMode {
  if (boardCount >= 5) return "final";
  if (boardCount >= 3) return "exact";
  return "sampled";
}

export function getLiveRunItPlayers(players: Array<RunItOddsPlayerLike | null> = []) {
  return players.filter((player): player is RunItOddsPlayerLike => (
    !!player &&
    !!player.id &&
    !!player.hasCards &&
    !player.isFolded
  ));
}

export function getFullyRevealedHoleCards(
  player: RunItOddsPlayerLike | null | undefined,
): [Card, Card] | null {
  if (!player?.holeCards?.[0] || !player?.holeCards?.[1]) return null;
  return [player.holeCards[0], player.holeCards[1]];
}

export function getRunItOddsContenders(players: Array<RunItOddsPlayerLike | null> = []): RunItOddsContender[] {
  return getLiveRunItPlayers(players)
    .map<RunItOddsContender | null>((player) => {
      const holeCards = getFullyRevealedHoleCards(player);
      if (!holeCards || !player.id) return null;
      return {
        playerId: player.id,
        playerName: player.name,
        holeCards,
      };
    })
    .filter((contender): contender is RunItOddsContender => contender != null);
}

export function shouldShowRunItOddsPanel({
  phase,
  players = [],
  runResults = [],
}: {
  phase?: string;
  players?: Array<RunItOddsPlayerLike | null>;
  runResults?: Array<{ board?: Card[] }>;
} = {}) {
  if (phase !== "showdown") return false;
  if ((runResults?.length ?? 0) < 1) return false;
  const livePlayers = getLiveRunItPlayers(players);
  if (livePlayers.length < 2) return false;
  return livePlayers.every((player) => getFullyRevealedHoleCards(player));
}

function normalizePercentages(shares: Record<string, number>, playerIds: string[], total: number) {
  return Object.fromEntries(
    playerIds.map((playerId) => [playerId, total > 0 ? (shares[playerId] ?? 0) * 100 / total : 0]),
  );
}

function scoreBoard(contenders: RunItOddsContender[], board: Card[]) {
  const shares: Record<string, number> = Object.fromEntries(
    contenders.map((contender) => [contender.playerId, 0]),
  );
  let bestHand: ReturnType<typeof evaluate7> | null = null;
  let winners: string[] = [];

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

function mergeShares(target: Record<string, number>, source: Record<string, number>) {
  for (const [playerId, share] of Object.entries(source)) {
    target[playerId] = (target[playerId] ?? 0) + share;
  }
}

export function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildRunItOddsContext({
  players = [],
  runResults = [],
  currentRun = 0,
}: {
  players?: Array<RunItOddsPlayerLike | null>;
  runResults?: Array<{ board?: Card[] }>;
  currentRun?: number;
} = {}): RunItOddsContext {
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

export function calculateFinalRunItOdds(context: RunItOddsContext) {
  const shares = scoreBoard(context.contenders, context.knownBoard);
  return normalizePercentages(shares, context.contenders.map((contender) => contender.playerId), 1);
}

export function calculateExactRunItOdds(context: RunItOddsContext) {
  const missingCards = Math.max(0, 5 - context.knownBoard.length);
  if (missingCards === 0) return calculateFinalRunItOdds(context);

  const playerIds = context.contenders.map((contender) => contender.playerId);
  const aggregateShares: Record<string, number> = Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
  let outcomeCount = 0;

  if (missingCards === 1) {
    for (let index = 0; index < context.remainingDeck.length; index += 1) {
      mergeShares(
        aggregateShares,
        scoreBoard(context.contenders, [...context.knownBoard, context.remainingDeck[index]!]),
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
          context.remainingDeck[first]!,
          context.remainingDeck[second]!,
        ]),
      );
      outcomeCount += 1;
    }
  }

  return normalizePercentages(aggregateShares, playerIds, outcomeCount);
}

function drawCards(cards: Card[], rng: () => number, drawCount: number) {
  const deck = cards.slice();
  const drawn: Card[] = [];
  for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
    const nextIndex = Math.floor(rng() * deck.length);
    drawn.push(deck[nextIndex]!);
    deck[nextIndex] = deck[deck.length - 1]!;
    deck.pop();
  }
  return drawn;
}

export function createMonteCarloOddsAccumulator(
  context: RunItOddsContext,
  options: { sampleCount?: number; rng?: () => number } = {},
) {
  const sampleCount = Math.max(1, options.sampleCount ?? 20000);
  const rng = options.rng ?? Math.random;
  const playerIds = context.contenders.map((contender) => contender.playerId);
  const aggregateShares: Record<string, number> = Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
  let completed = 0;

  return {
    sampleCount,
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
