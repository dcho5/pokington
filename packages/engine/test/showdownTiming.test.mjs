import test from "node:test";
import assert from "node:assert/strict";

import {
  ANNOUNCE_DELAY_S,
  POST_REVEAL_SETTLE_S,
  computeRunTransitions,
  deriveRunAnimationAt,
  getAllInShowdownRevealDelayMs,
  getRunTimings,
  shouldAnnounceRunIt,
  shouldRevealRunsConcurrently,
} from "../dist/index.js";

test("bomb-pot all-ins reveal runs concurrently", () => {
  assert.equal(shouldRevealRunsConcurrently(true, 2), true);
  assert.equal(shouldRevealRunsConcurrently(false, 2), false);

  const sequential = computeRunTransitions(3, 2);
  const concurrent = computeRunTransitions(3, 2, { revealRunsConcurrently: true });

  assert.deepEqual(concurrent, [400, 2900]);
  assert.deepEqual(sequential, [400, 2900, 4100 + 400, 4100 + 2900]);
  assert.equal(sequential.length > concurrent.length, true);
});

test("sequential run timing keeps focus on the completed run until the next reveal starts", () => {
  const runDealStartedAt = 1_000;

  assert.deepEqual(
    deriveRunAnimationAt(runDealStartedAt + 4_499, runDealStartedAt, 3, 2),
    { currentRun: 0, revealedCount: 5 },
  );
  assert.deepEqual(
    deriveRunAnimationAt(runDealStartedAt + 4_500, runDealStartedAt, 3, 2),
    { currentRun: 1, revealedCount: 4 },
  );
});

test("concurrent reveal timing settles both bomb-pot boards together", () => {
  const knownCardCount = 3;
  const runCount = 2;
  const { settleDelayS, runIntervalS } = getRunTimings(knownCardCount, {
    revealRunsConcurrently: true,
  });

  assert.equal(runIntervalS, 0);
  assert.equal(settleDelayS, 2.9 + POST_REVEAL_SETTLE_S);
  assert.equal(
    getAllInShowdownRevealDelayMs(knownCardCount, runCount, { revealRunsConcurrently: true }),
    (ANNOUNCE_DELAY_S + settleDelayS) * 1000,
  );
});

test("run-it announcements require an actual animated showdown window", () => {
  assert.equal(shouldAnnounceRunIt({
    runCount: 1,
    knownCardCount: 5,
    showdownStartedAt: 1_000,
    runDealStartedAt: null,
  }), false);

  assert.equal(shouldAnnounceRunIt({
    runCount: 1,
    knownCardCount: 3,
    showdownStartedAt: 1_000,
    runDealStartedAt: null,
  }), true);

  assert.equal(shouldAnnounceRunIt({
    runCount: 2,
    knownCardCount: 5,
    showdownStartedAt: 1_000,
    runDealStartedAt: null,
  }), true);

  assert.equal(shouldAnnounceRunIt({
    isBombPotHand: true,
    runCount: 2,
    knownCardCount: 3,
    showdownStartedAt: 1_000,
    runDealStartedAt: null,
  }), false);
});
