import test from "node:test";
import assert from "node:assert/strict";

import {
  restoreHandScopedMapEntries,
  shouldClearHandScopedState,
} from "./handScopedState.mjs";

function makeState(overrides = {}) {
  return {
    phase: "pre-flop",
    handNumber: 12,
    ...overrides,
  };
}

test("clears hand-scoped state when a new hand starts", () => {
  assert.equal(
    shouldClearHandScopedState(
      makeState({ phase: "showdown", handNumber: 12 }),
      makeState({ phase: "pre-flop", handNumber: 13 }),
    ),
    true,
  );
});

test("clears hand-scoped state when showdown collapses back to waiting", () => {
  assert.equal(
    shouldClearHandScopedState(
      makeState({ phase: "showdown", handNumber: 12 }),
      makeState({ phase: "waiting", handNumber: 12 }),
    ),
    true,
  );
});

test("keeps hand-scoped state during the same active hand", () => {
  assert.equal(
    shouldClearHandScopedState(
      makeState({ phase: "turn", handNumber: 12 }),
      makeState({ phase: "river", handNumber: 12 }),
    ),
    false,
  );
});

test("restores tracked entries only when they belong to the current hand", () => {
  const entries = [["p1", 3], ["p2", 1]];

  assert.deepEqual(
    Array.from(restoreHandScopedMapEntries(entries, makeState({ handNumber: 12 }), 12).entries()),
    entries,
  );
  assert.deepEqual(
    Array.from(restoreHandScopedMapEntries(entries, makeState({ handNumber: 13 }), 12).entries()),
    [],
  );
  assert.deepEqual(
    Array.from(restoreHandScopedMapEntries(entries, makeState({ phase: "waiting", handNumber: 12 }), 12).entries()),
    [],
  );
  assert.deepEqual(
    Array.from(restoreHandScopedMapEntries(entries, makeState({ handNumber: 12 }), null).entries()),
    [],
  );
});
