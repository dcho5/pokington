import test from "node:test";
import assert from "node:assert/strict";

import { shouldQueueLeave } from "../dist/index.js";

test("showdown players with cards and contribution must queue leave", () => {
  assert.equal(shouldQueueLeave({
    phase: "showdown",
    hasCards: true,
    currentBet: 0,
    totalContribution: 200,
    sitOutUntilBB: false,
  }), true);
});

test("folded players who already contributed still must queue leave", () => {
  assert.equal(shouldQueueLeave({
    phase: "turn",
    hasCards: false,
    currentBet: 0,
    totalContribution: 150,
    sitOutUntilBB: false,
  }), true);
});

test("new mid-hand entrants still sitting out can leave immediately", () => {
  assert.equal(shouldQueueLeave({
    phase: "flop",
    hasCards: false,
    currentBet: 0,
    totalContribution: 0,
    sitOutUntilBB: true,
  }), false);
});

test("waiting players can leave immediately", () => {
  assert.equal(shouldQueueLeave({
    phase: "waiting",
    hasCards: false,
    currentBet: 0,
    totalContribution: 0,
    sitOutUntilBB: false,
  }), false);
});
