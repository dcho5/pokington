import test from "node:test";
import assert from "node:assert/strict";

import {
  getShowdownCountdownDelayMs,
  hasCompletedShowdownPresentation,
} from "./showdownUi.mjs";

test("showdown presentation is incomplete until the public reveal is finished", () => {
  assert.equal(
    hasCompletedShowdownPresentation({
      settledRunCount: 2,
      runCount: 2,
      publicShowdownRevealComplete: false,
    }),
    false,
  );
  assert.equal(
    hasCompletedShowdownPresentation({
      settledRunCount: 2,
      runCount: 2,
      publicShowdownRevealComplete: true,
    }),
    true,
  );
});

test("countdown stays blocked until the public showdown reveal is complete", () => {
  assert.equal(
    getShowdownCountdownDelayMs({
      phase: "showdown",
      animatedShowdownReveal: true,
      publicShowdownRevealComplete: false,
      knownCardCount: 3,
      runCount: 2,
      showdownStartedAt: 1_000,
      now: 20_000,
    }),
    null,
  );
});

test("countdown starts immediately once animation time has passed and the public reveal is complete", () => {
  assert.equal(
    getShowdownCountdownDelayMs({
      phase: "showdown",
      animatedShowdownReveal: true,
      publicShowdownRevealComplete: true,
      knownCardCount: 3,
      runCount: 2,
      showdownStartedAt: 1_000,
      now: 20_000,
    }),
    0,
  );
});
