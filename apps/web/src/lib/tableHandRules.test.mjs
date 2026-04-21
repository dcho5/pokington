import test from "node:test";
import assert from "node:assert/strict";

import { canPlayerTableOwnHand } from "./tableHandRules.mjs";

function makePlayer(overrides = {}) {
  return {
    id: "p1",
    holeCards: [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "hearts" },
    ],
    hasCards: true,
    isFolded: false,
    sitOutUntilBB: false,
    ...overrides,
  };
}

function makeState(overrides = {}) {
  return {
    phase: "pre-flop",
    needsToAct: ["p1"],
    players: {
      p1: makePlayer(),
      p2: makePlayer({ id: "p2" }),
    },
    ...overrides,
  };
}

test("players can table their own hand off-turn during a live hand by default", () => {
  assert.equal(
    canPlayerTableOwnHand({
      gameState: makeState({ needsToAct: ["p2"] }),
      playerId: "p1",
    }),
    true,
  );
});

test("off-turn live-hand tabling can still be disabled by policy", () => {
  assert.equal(
    canPlayerTableOwnHand({
      gameState: makeState({ needsToAct: ["p2"] }),
      playerId: "p1",
      rules: { allowOffTurnDuringLiveHand: false },
    }),
    false,
  );
});

test("showdown tabling stays available regardless of turn order", () => {
  assert.equal(
    canPlayerTableOwnHand({
      gameState: makeState({ phase: "showdown", needsToAct: [] }),
      playerId: "p1",
      rules: { allowOffTurnDuringLiveHand: false },
    }),
    true,
  );
});
