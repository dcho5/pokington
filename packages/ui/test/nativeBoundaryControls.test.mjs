import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveNativeBoundaryControl } from "../dist/lib/nativeBoundaryControls.js";

test("native boundary control is hidden for non-creators", () => {
  assert.equal(
    deriveNativeBoundaryControl({
      phase: "waiting",
      isCreator: false,
      eligiblePlayerCount: 3,
    }),
    null,
  );
  assert.equal(
    deriveNativeBoundaryControl({
      phase: "showdown",
      isCreator: false,
      eligiblePlayerCount: 3,
      nextHandStartsAt: 10_000,
      publicShowdownRevealComplete: true,
    }),
    null,
  );
});

test("native boundary control starts a waiting table with enough players", () => {
  assert.deepEqual(
    deriveNativeBoundaryControl({
      phase: "waiting",
      isCreator: true,
      eligiblePlayerCount: 2,
    }),
    {
      kind: "start",
      label: "Start Game",
      disabled: false,
    },
  );
});

test("native boundary control waits for more players before the first hand", () => {
  assert.deepEqual(
    deriveNativeBoundaryControl({
      phase: "waiting",
      isCreator: true,
      eligiblePlayerCount: 1,
    }),
    {
      kind: "waiting",
      label: "Waiting for more players…",
      disabled: true,
    },
  );
});

test("native boundary control advances showdown after public reveal completion", () => {
  assert.deepEqual(
    deriveNativeBoundaryControl({
      phase: "showdown",
      isCreator: true,
      eligiblePlayerCount: 2,
      nextHandStartsAt: 10_000,
      publicShowdownRevealComplete: true,
    }),
    {
      kind: "next",
      label: "Next Hand",
      disabled: false,
    },
  );
});

test("native boundary control stays hidden while showdown reveal is resolving", () => {
  assert.equal(
    deriveNativeBoundaryControl({
      phase: "showdown",
      isCreator: true,
      eligiblePlayerCount: 2,
      nextHandStartsAt: 10_000,
      publicShowdownRevealComplete: false,
    }),
    null,
  );
});
