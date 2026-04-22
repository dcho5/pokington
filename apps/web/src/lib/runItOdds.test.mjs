import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRunItOddsContext,
  calculateExactRunItOdds,
  calculateFinalRunItOdds,
  cardKey,
  getRunItOddsContenders,
  shouldShowRunItOddsPanel,
} from "./runItOdds.mjs";
import { compareHands, evaluate7 } from "@pokington/engine";

function c(rank, suit) {
  return { rank, suit };
}

function createPlayer({
  id,
  name,
  holeCards,
  hasCards = true,
  isFolded = false,
}) {
  return {
    id,
    name,
    hasCards,
    isFolded,
    holeCards,
  };
}

function scoreReference(contenders, board) {
  const wins = Object.fromEntries(contenders.map((contender) => [contender.playerId, 0]));
  let best = null;
  let winners = [];

  for (const contender of contenders) {
    const hand = evaluate7([...board, ...contender.holeCards]);
    if (!best || compareHands(hand, best) > 0) {
      best = hand;
      winners = [contender.playerId];
      continue;
    }
    if (compareHands(hand, best) === 0) winners.push(contender.playerId);
  }

  for (const winnerId of winners) {
    wins[winnerId] += 1 / winners.length;
  }
  return wins;
}

function enumerateReference(context) {
  const missing = 5 - context.knownBoard.length;
  const totals = Object.fromEntries(context.contenders.map((contender) => [contender.playerId, 0]));
  let outcomes = 0;

  if (missing === 0) {
    return calculateFinalRunItOdds(context);
  }

  if (missing === 1) {
    for (const river of context.remainingDeck) {
      const shares = scoreReference(context.contenders, [...context.knownBoard, river]);
      for (const [playerId, share] of Object.entries(shares)) totals[playerId] += share;
      outcomes += 1;
    }
  } else {
    for (let first = 0; first < context.remainingDeck.length - 1; first += 1) {
      for (let second = first + 1; second < context.remainingDeck.length; second += 1) {
        const shares = scoreReference(context.contenders, [
          ...context.knownBoard,
          context.remainingDeck[first],
          context.remainingDeck[second],
        ]);
        for (const [playerId, share] of Object.entries(shares)) totals[playerId] += share;
        outcomes += 1;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(totals).map(([playerId, share]) => [playerId, share * 100 / outcomes]),
  );
}

test("visibility gating requires every live contender to be fully tabled", () => {
  const players = [
    createPlayer({
      id: "p1",
      name: "Alex",
      holeCards: [c("A", "spades"), c("A", "hearts")],
    }),
    createPlayer({
      id: "p2",
      name: "Blake",
      holeCards: [c("K", "spades"), null],
    }),
  ];

  assert.equal(shouldShowRunItOddsPanel({
    phase: "showdown",
    players,
    runResults: [{ board: [] }, { board: [] }],
  }), false);
  assert.equal(getRunItOddsContenders(players).length, 1);
});

test("exact flop odds match exhaustive reference enumeration", () => {
  const players = [
    createPlayer({
      id: "p1",
      name: "Alex",
      holeCards: [c("A", "spades"), c("K", "spades")],
    }),
    createPlayer({
      id: "p2",
      name: "Blake",
      holeCards: [c("A", "hearts"), c("A", "clubs")],
    }),
  ];
  const context = buildRunItOddsContext({
    players,
    runResults: [{ board: [c("Q", "spades"), c("J", "spades"), c("2", "diamonds")] }],
    currentRun: 0,
  });

  assert.deepEqual(calculateExactRunItOdds(context), enumerateReference(context));
});

test("exact turn odds count the remaining river outs correctly", () => {
  const context = buildRunItOddsContext({
    players: [
      createPlayer({
        id: "p1",
        name: "Alex",
        holeCards: [c("A", "hearts"), c("A", "spades")],
      }),
      createPlayer({
        id: "p2",
        name: "Blake",
        holeCards: [c("K", "hearts"), c("K", "diamonds")],
      }),
    ],
    runResults: [{ board: [c("2", "clubs"), c("3", "diamonds"), c("4", "hearts"), c("9", "spades")] }],
    currentRun: 0,
  });

  const odds = calculateExactRunItOdds(context);

  assert.equal(odds.p1.toFixed(4), (42 * 100 / 44).toFixed(4));
  assert.equal(odds.p2.toFixed(4), (2 * 100 / 44).toFixed(4));
});

test("later runs remove earlier full boards from the remaining deck", () => {
  const context = buildRunItOddsContext({
    players: [
      createPlayer({
        id: "p1",
        name: "Alex",
        holeCards: [c("A", "hearts"), c("A", "spades")],
      }),
      createPlayer({
        id: "p2",
        name: "Blake",
        holeCards: [c("K", "hearts"), c("K", "diamonds")],
      }),
    ],
    runResults: [
      { board: [c("K", "clubs"), c("7", "clubs"), c("8", "clubs"), c("9", "clubs"), c("T", "clubs")] },
      { board: [c("2", "clubs"), c("3", "diamonds"), c("4", "hearts"), c("9", "spades")] },
    ],
    currentRun: 1,
  });

  const odds = calculateExactRunItOdds(context);

  assert.equal(context.remainingDeck.some((card) => cardKey(card) === cardKey(c("K", "clubs"))), false);
  assert.equal(odds.p2.toFixed(4), (1 * 100 / 39).toFixed(4));
});

test("river resolution returns deterministic split percentages", () => {
  const context = buildRunItOddsContext({
    players: [
      createPlayer({
        id: "p1",
        name: "Alex",
        holeCards: [c("2", "clubs"), c("3", "clubs")],
      }),
      createPlayer({
        id: "p2",
        name: "Blake",
        holeCards: [c("4", "diamonds"), c("5", "diamonds")],
      }),
    ],
    runResults: [{ board: [c("A", "spades"), c("K", "spades"), c("Q", "hearts"), c("J", "clubs"), c("T", "diamonds")] }],
    currentRun: 0,
  });

  assert.deepEqual(calculateFinalRunItOdds(context), {
    p1: 50,
    p2: 50,
  });
});
