import test from "node:test";
import assert from "node:assert/strict";

import {
  ANNOUNCE_DELAY_S,
  CHIP_DURATION_S,
  WINNER_STAGGER_BUFFER_S,
  computeRunTransitions,
  deriveRunAnimationAt,
  getAllInShowdownRevealDelayMs,
  getRunTimings,
  shouldRevealRunsConcurrently,
} from "../dist/index.js";

test("bomb-pot all-ins reveal runs concurrently", () => {
  assert.equal(shouldRevealRunsConcurrently(true, 2), true);
  assert.equal(shouldRevealRunsConcurrently(false, 2), false);

  const sequential = computeRunTransitions(3, 2);
  const concurrent = computeRunTransitions(3, 2, { revealRunsConcurrently: true });

  assert.deepEqual(concurrent, [400, 2900]);
  assert.deepEqual(sequential, [400, 2900, 6500 + 400, 6500 + 2900]);
  assert.equal(sequential.length > concurrent.length, true);
});

test("sequential run timing keeps focus on the completed run until the next reveal starts", () => {
  const runDealStartedAt = 1_000;

  assert.deepEqual(
    deriveRunAnimationAt(runDealStartedAt + 6_899, runDealStartedAt, 3, 2),
    { currentRun: 0, revealedCount: 5 },
  );
  assert.deepEqual(
    deriveRunAnimationAt(runDealStartedAt + 6_900, runDealStartedAt, 3, 2),
    { currentRun: 1, revealedCount: 4 },
  );
});

test("concurrent reveal timing settles both bomb-pot boards together", () => {
  const knownCardCount = 3;
  const runCount = 2;
  const { chipStartS, runIntervalS } = getRunTimings(knownCardCount, {
    revealRunsConcurrently: true,
  });

  assert.equal(runIntervalS, 0);
  assert.equal(chipStartS, 3.4);
  assert.equal(
    getAllInShowdownRevealDelayMs(knownCardCount, runCount, { revealRunsConcurrently: true }),
    (ANNOUNCE_DELAY_S + chipStartS + CHIP_DURATION_S + WINNER_STAGGER_BUFFER_S) * 1000,
  );
});
