import test from "node:test";
import assert from "node:assert/strict";

import {
  canStartPublicReveal,
  getInitialPrivateRevealState,
  readPersistedAutoPeelPreference,
  readPersistedPeelState,
  writePersistedAutoPeelPreference,
  writePersistedPeelState,
} from "./holeCardReveal.mjs";

function createLocalStorage() {
  const storage = new Map();
  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };
}

test.afterEach(() => {
  delete globalThis.window;
});

test("public reveal starts for already peeled cards", () => {
  assert.equal(
    canStartPublicReveal({
      isPrivatelyRevealed: true,
      canRevealToOthers: true,
      isRevealedToOthers: false,
      sevenTwoEligible: false,
    }),
    true,
  );
});

test("public reveal stays blocked for face-down cards outside the 7-2 claim flow", () => {
  assert.equal(
    canStartPublicReveal({
      isPrivatelyRevealed: false,
      canRevealToOthers: true,
      isRevealedToOthers: false,
      sevenTwoEligible: false,
    }),
    false,
  );
});

test("7-2 claim windows allow public reveal even when the card is still face-down", () => {
  assert.equal(
    canStartPublicReveal({
      isPrivatelyRevealed: false,
      canRevealToOthers: true,
      isRevealedToOthers: false,
      sevenTwoEligible: true,
    }),
    true,
  );
});

test("public reveal stays blocked once the card is already public", () => {
  assert.equal(
    canStartPublicReveal({
      isPrivatelyRevealed: true,
      canRevealToOthers: true,
      isRevealedToOthers: true,
      sevenTwoEligible: true,
    }),
    false,
  );
});

test("initial private reveal state restores the persisted hand state", () => {
  globalThis.window = { localStorage: createLocalStorage() };
  writePersistedPeelState("table:user:hand:12", [true, false]);

  assert.deepEqual(readPersistedPeelState("table:user:hand:12"), [true, false]);
  assert.deepEqual(
    getInitialPrivateRevealState({
      persistenceKey: "table:user:hand:12",
      autoReveal: false,
    }),
    [true, false],
  );
});

test("auto peel starts a new hand fully peeled without waiting for a follow-up effect", () => {
  globalThis.window = { localStorage: createLocalStorage() };
  writePersistedPeelState("table:user:hand:13", [false, false]);

  assert.deepEqual(
    getInitialPrivateRevealState({
      persistenceKey: "table:user:hand:13",
      autoReveal: true,
    }),
    [true, true],
  );
});

test("auto peel preference round-trips through local storage", () => {
  globalThis.window = { localStorage: createLocalStorage() };

  assert.equal(readPersistedAutoPeelPreference(), false);
  writePersistedAutoPeelPreference(true);
  assert.equal(readPersistedAutoPeelPreference(), true);
  writePersistedAutoPeelPreference(false);
  assert.equal(readPersistedAutoPeelPreference(), false);
});
