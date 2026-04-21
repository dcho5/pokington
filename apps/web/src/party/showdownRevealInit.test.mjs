import test from "node:test";
import assert from "node:assert/strict";

import { deriveKnownCardCountAtShowdown } from "./showdownRevealInit.mjs";

function makeState(overrides = {}) {
  return {
    phase: "waiting",
    communityCards: [],
    communityCards2: [],
    isBombPot: false,
    ...overrides,
  };
}

test("uses previously visible cards for standard showdown reveal timing", () => {
  const prev = makeState({
    phase: "turn",
    communityCards: [{}, {}, {}, {}],
  });
  const next = makeState({
    phase: "showdown",
    communityCards: [{}, {}, {}, {}, {}],
  });

  assert.equal(deriveKnownCardCountAtShowdown(prev, next), 4);
});

test("preserves both bomb-pot flops when a hand jumps from waiting directly to showdown", () => {
  const prev = makeState({ phase: "waiting" });
  const next = makeState({
    phase: "showdown",
    isBombPot: true,
    communityCards: [{}, {}, {}, {}, {}],
    communityCards2: [{}, {}, {}, {}, {}],
  });

  assert.equal(deriveKnownCardCountAtShowdown(prev, next), 3);
});
