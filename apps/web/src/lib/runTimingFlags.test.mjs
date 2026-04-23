import test from "node:test";
import assert from "node:assert/strict";

import { deriveServerRunTiming } from "./runTimingFlags.mjs";

test("regular showdowns do not surface a run-it announcement", () => {
  const timing = deriveServerRunTiming({
    phase: "showdown",
    isBombPot: false,
    runCount: 1,
    runResults: [{ board: [], winners: [] }],
    knownCardCountAtRunIt: 5,
    showdownStartedAt: 1_000,
    runDealStartedAt: null,
    communityCards: Array(5).fill({ rank: "A", suit: "spades" }),
  });

  assert.equal(timing.runAnnouncement, null);
  assert.equal(timing.isRunItBoard, false);
});

test("voted run-it once keeps the announcement banner during the delay window", () => {
  const timing = deriveServerRunTiming({
    phase: "showdown",
    isBombPot: false,
    runCount: 1,
    runResults: [{ board: [], winners: [] }],
    knownCardCountAtRunIt: 3,
    showdownStartedAt: 1_000,
    runDealStartedAt: null,
    communityCards: Array(3).fill({ rank: "A", suit: "spades" }),
  });

  assert.equal(timing.runAnnouncement, 1);
  assert.equal(timing.isRunItBoard, true);
});

test("single-run all-in reveals stay animated without using the announcement banner", () => {
  const timing = deriveServerRunTiming({
    phase: "showdown",
    isBombPot: false,
    runCount: 1,
    runResults: [{ board: [], winners: [] }],
    knownCardCountAtRunIt: 4,
    showdownStartedAt: 1_000,
    runDealStartedAt: 1_000,
    communityCards: Array(4).fill({ rank: "A", suit: "spades" }),
  });

  assert.equal(timing.runAnnouncement, null);
  assert.equal(timing.isRunItBoard, true);
});
