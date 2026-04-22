import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRunItOddsRows,
  createRunItOddsSessionKey,
  lockRunItStreetSnapshot,
  resolveRunItOddsCalculationMode,
} from "./runItOddsPanelModel.mjs";

function c(rank, suit) {
  return { rank, suit };
}

test("pre-flop boards use the sampled calculation path", () => {
  assert.equal(resolveRunItOddsCalculationMode(0), "sampled");
  assert.equal(resolveRunItOddsCalculationMode(2), "sampled");
  assert.equal(resolveRunItOddsCalculationMode(3), "exact");
});

test("street snapshots lock into the timeline without mutating prior streets", () => {
  const history = lockRunItStreetSnapshot({}, {
    runIndex: 1,
    street: "flop",
    percentages: { p1: 62.5, p2: 37.5 },
  });
  const contenders = [
    { playerId: "p1", playerName: "Alex", holeCards: [c("A", "spades"), c("K", "spades")] },
    { playerId: "p2", playerName: "Blake", holeCards: [c("A", "hearts"), c("A", "clubs")] },
  ];

  const rows = buildRunItOddsRows({
    contenders,
    historyByRun: history,
    currentRun: 1,
    currentStreet: "turn",
    currentPercentages: { p1: 70, p2: 30 },
  });

  assert.equal(rows[0].streetPercentages.flop, 62.5);
  assert.equal(rows[1].streetPercentages.flop, 37.5);
  assert.equal(rows[0].streetPercentages.turn, 70);
  assert.equal(rows[1].streetPercentages.turn, 30);
});

test("session keys reset when a new hand or showdown sequence starts", () => {
  const handKey = createRunItOddsSessionKey({
    handNumber: 14,
    showdownStartedAt: 1_000,
    runDealStartedAt: 2_000,
  });
  const nextHandKey = createRunItOddsSessionKey({
    handNumber: 15,
    showdownStartedAt: 1_000,
    runDealStartedAt: 2_000,
  });
  const nextShowdownKey = createRunItOddsSessionKey({
    handNumber: 14,
    showdownStartedAt: 3_000,
    runDealStartedAt: 4_000,
  });

  assert.notEqual(handKey, nextHandKey);
  assert.notEqual(handKey, nextShowdownKey);
});
