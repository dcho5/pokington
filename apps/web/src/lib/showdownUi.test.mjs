import test from "node:test";
import assert from "node:assert/strict";

import {
  getNextHandAutoStartAt,
  getShowdownCountdownSeconds,
  getShowdownCountdownDelayMs,
  getShowdownCountdownStartAt,
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

test("next-hand auto-start time is anchored to the showdown start, not the reconnect time", () => {
  assert.equal(
    getNextHandAutoStartAt({
      phase: "showdown",
      animatedShowdownReveal: true,
      revealRunsConcurrently: false,
      knownCardCount: 3,
      runCount: 2,
      showdownStartedAt: 1_000,
      countdownSeconds: 10,
    }),
    getShowdownCountdownStartAt({
      phase: "showdown",
      animatedShowdownReveal: true,
      revealRunsConcurrently: false,
      knownCardCount: 3,
      runCount: 2,
      showdownStartedAt: 1_000,
    }) + 10_000,
  );
});

test("countdown seconds resume from the server timestamp after a reconnect", () => {
  assert.equal(
    getShowdownCountdownSeconds({
      phase: "showdown",
      nextHandStartsAt: 15_000,
      now: 5_100,
    }),
    10,
  );
  assert.equal(
    getShowdownCountdownSeconds({
      phase: "showdown",
      nextHandStartsAt: 15_000,
      now: 14_250,
    }),
    1,
  );
  assert.equal(
    getShowdownCountdownSeconds({
      phase: "showdown",
      nextHandStartsAt: 15_000,
      now: 15_000,
    }),
    null,
  );
});
