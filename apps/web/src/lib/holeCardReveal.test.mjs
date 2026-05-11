import test from "node:test";
import assert from "node:assert/strict";

import {
  canStartRevealHoldInteraction,
  canStartPublicReveal,
  createInitialPeelCardState,
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

test("reveal hold interaction can replay once the card is already public", () => {
  assert.equal(
    canStartRevealHoldInteraction({
      isPrivatelyRevealed: true,
      canRevealToOthers: true,
      isRevealedToOthers: true,
      sevenTwoEligible: false,
    }),
    true,
  );
});

test("reveal hold interaction still respects reveal capability", () => {
  assert.equal(
    canStartRevealHoldInteraction({
      isPrivatelyRevealed: true,
      canRevealToOthers: false,
      isRevealedToOthers: true,
      sevenTwoEligible: false,
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

test("initially revealed cards still need to report their first peek upstream", () => {
  assert.deepEqual(
    createInitialPeelCardState({ revealed: true }),
    {
      initialProgress: 1,
      hasRevealed: true,
      hasPeekedEnough: false,
    },
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

test("auto peel preference round-trips through async storage", async () => {
  const storage = createLocalStorage();
  const asyncStorage = {
    async getItem(key) {
      return storage.getItem(key);
    },
    async setItem(key, value) {
      storage.setItem(key, value);
    },
    async removeItem(key) {
      storage.removeItem(key);
    },
  };

  assert.equal(await readPersistedAutoPeelPreference(asyncStorage), false);
  await writePersistedAutoPeelPreference(true, asyncStorage);
  assert.equal(await readPersistedAutoPeelPreference(asyncStorage), true);
  await writePersistedAutoPeelPreference(false, asyncStorage);
  assert.equal(await readPersistedAutoPeelPreference(asyncStorage), false);
});
