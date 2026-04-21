import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveObservedRunState,
  getNextTimedRevealAt,
  getTimedVisibleRunCounts,
  isObservedShowdownRevealComplete,
  isTimedShowdownRevealComplete,
} from "./showdownRevealState.mjs";

test("timed reveal counts progress flop, turn, river in order", () => {
  assert.deepEqual(
    getTimedVisibleRunCounts({
      knownCardCount: 0,
      runCount: 1,
      runDealStartedAt: 1_000,
      now: 1_399,
    }),
    [0],
  );
  assert.deepEqual(
    getTimedVisibleRunCounts({
      knownCardCount: 0,
      runCount: 1,
      runDealStartedAt: 1_000,
      now: 1_400,
    }),
    [3],
  );
  assert.deepEqual(
    getTimedVisibleRunCounts({
      knownCardCount: 0,
      runCount: 1,
      runDealStartedAt: 1_000,
      now: 3_900,
    }),
    [4],
  );
  assert.deepEqual(
    getTimedVisibleRunCounts({
      knownCardCount: 0,
      runCount: 1,
      runDealStartedAt: 1_000,
      now: 6_400,
    }),
    [5],
  );
});

test("next timed reveal skips past already-fired steps without dropping the final reveal", () => {
  assert.equal(
    getNextTimedRevealAt({
      knownCardCount: 3,
      runCount: 1,
      runDealStartedAt: 1_000,
      now: 2_500,
    }),
    3_900,
  );
  assert.equal(
    getNextTimedRevealAt({
      knownCardCount: 3,
      runCount: 1,
      runDealStartedAt: 1_000,
      now: 4_000,
    }),
    null,
  );
  assert.equal(
    getNextTimedRevealAt({
      knownCardCount: 3,
      runCount: 1,
      runDealStartedAt: 1_000,
      now: 6_401,
    }),
    null,
  );
});

test("timed reveal completion only turns true after the final card is due", () => {
  assert.equal(
    isTimedShowdownRevealComplete({
      knownCardCount: 3,
      runCount: 2,
      runDealStartedAt: 1_000,
      now: 10_399,
    }),
    false,
  );
  assert.equal(
    isTimedShowdownRevealComplete({
      knownCardCount: 3,
      runCount: 2,
      runDealStartedAt: 1_000,
      now: 10_400,
    }),
    true,
  );
});

test("observed reveal completion stays false while any public run still has a hidden card", () => {
  const runResults = [
    { board: [{}, {}, {}, {}, {}] },
    { board: [{}, {}, {}, {}] },
  ];

  assert.deepEqual(deriveObservedRunState(runResults, 3, 2), {
    currentRun: 1,
    revealedCount: 4,
  });
  assert.equal(isObservedShowdownRevealComplete(runResults, 3, 2), false);
  assert.equal(
    isObservedShowdownRevealComplete([
      { board: [{}, {}, {}, {}, {}] },
      { board: [{}, {}, {}, {}, {}] },
    ], 3, 2),
    true,
  );
});
