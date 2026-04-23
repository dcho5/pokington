import test from "node:test";
import assert from "node:assert/strict";

import {
  canAcceptPeek,
  getBroadcastPeekedCounts,
  peekMaskCount,
} from "./peekTracking.mjs";

function makePlayer(overrides = {}) {
  return {
    id: "p1",
    name: "Player 1",
    seatIndex: 0,
    stack: 1000,
    holeCards: [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "hearts" },
    ],
    currentBet: 0,
    totalContribution: 0,
    isFolded: false,
    isAllIn: false,
    lastAction: null,
    sitOutUntilBB: false,
    ...overrides,
  };
}

function makeState(overrides = {}) {
  return {
    phase: "pre-flop",
    handNumber: 12,
    players: {
      p1: makePlayer(),
      p2: makePlayer({
        id: "p2",
        name: "Player 2",
        seatIndex: 1,
      }),
    },
    ...overrides,
  };
}

test("peekMaskCount reports 0, 1, or 2 peeked cards from the bitmask", () => {
  assert.equal(peekMaskCount(0), 0);
  assert.equal(peekMaskCount(1), 1);
  assert.equal(peekMaskCount(2), 1);
  assert.equal(peekMaskCount(3), 2);
});

test("canAcceptPeek accepts only a live peek from the current hand", () => {
  const gameState = makeState();

  assert.equal(canAcceptPeek({ gameState, playerId: "p1", handNumber: 12 }), true);
  assert.equal(canAcceptPeek({ gameState, playerId: "p1", handNumber: 11 }), false);
  assert.equal(canAcceptPeek({ gameState: makeState({ phase: "waiting" }), playerId: "p1", handNumber: 12 }), false);
  assert.equal(canAcceptPeek({ gameState: makeState({ phase: "showdown" }), playerId: "p1", handNumber: 12 }), false);
});

test("canAcceptPeek rejects stale or impossible player states", () => {
  assert.equal(
    canAcceptPeek({
      gameState: makeState({ players: { p1: makePlayer({ holeCards: null }) } }),
      playerId: "p1",
      handNumber: 12,
    }),
    false,
  );

  assert.equal(
    canAcceptPeek({
      gameState: makeState({ players: { p1: makePlayer({ isFolded: true }) } }),
      playerId: "p1",
      handNumber: 12,
    }),
    false,
  );

  assert.equal(
    canAcceptPeek({
      gameState: makeState({ players: { p1: makePlayer({ sitOutUntilBB: true }) } }),
      playerId: "p1",
      handNumber: 12,
    }),
    false,
  );

  assert.equal(canAcceptPeek({ gameState: makeState(), playerId: "missing", handNumber: 12 }), false);
});

test("getBroadcastPeekedCounts hides peek state once the hand is no longer active", () => {
  const peekedCardMasks = new Map([
    ["p1", 3],
    ["p2", 1],
  ]);

  assert.deepEqual(getBroadcastPeekedCounts(makeState({ phase: "waiting" }), peekedCardMasks), {});
});

test("getBroadcastPeekedCounts preserves peek state through showdown", () => {
  const peekedCardMasks = new Map([
    ["p1", 3],
    ["p2", 1],
  ]);

  assert.deepEqual(getBroadcastPeekedCounts(makeState({ phase: "showdown" }), peekedCardMasks), {
    p1: 2,
    p2: 1,
  });
});

test("getBroadcastPeekedCounts filters stale masks and preserves valid one-card/two-card peeks", () => {
  const gameState = makeState({
    players: {
      p1: makePlayer(),
      p2: makePlayer({
        id: "p2",
        holeCards: null,
      }),
      p3: makePlayer({
        id: "p3",
        seatIndex: 2,
        sitOutUntilBB: true,
      }),
      p4: makePlayer({
        id: "p4",
        seatIndex: 3,
      }),
    },
  });

  const peekedCardMasks = new Map([
    ["p1", 3],
    ["p2", 1],
    ["p3", 2],
    ["p4", 1],
    ["ghost", 3],
  ]);

  assert.deepEqual(getBroadcastPeekedCounts(gameState, peekedCardMasks), { p1: 2, p4: 1 });
});

test("getBroadcastPeekedCounts prevents previous-hand masks from leaking into a fresh deal", () => {
  const nextHandState = makeState({
    handNumber: 13,
    players: {
      p1: makePlayer({ holeCards: null }),
      p2: makePlayer({
        id: "p2",
        seatIndex: 1,
        holeCards: null,
      }),
    },
  });
  const stalePeekedCardMasks = new Map([
    ["p1", 3],
    ["p2", 1],
  ]);

  assert.deepEqual(getBroadcastPeekedCounts(nextHandState, stalePeekedCardMasks), {});
});
