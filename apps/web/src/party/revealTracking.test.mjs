import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublicRevealedHoleCards,
  canPubliclyRevealCard,
  cardIndexToMask,
  maskToPublicCards,
} from "./revealTracking.mjs";

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
    needsToAct: ["p1"],
    winners: null,
    showdownKind: "none",
    autoRevealWinningHands: false,
    autoRevealWinningHandsAt: null,
    voluntaryShownPlayerIds: [],
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

test("cardIndexToMask and maskToPublicCards preserve per-card visibility", () => {
  const cards = makePlayer().holeCards;

  assert.equal(cardIndexToMask(0), 1);
  assert.equal(cardIndexToMask(1), 2);
  assert.deepEqual(maskToPublicCards(cards, 1), [cards[0], null]);
  assert.deepEqual(maskToPublicCards(cards, 2), [null, cards[1]]);
  assert.deepEqual(maskToPublicCards(cards, 3), cards);
  assert.equal(maskToPublicCards(cards, 0), null);
});

test("canPubliclyRevealCard allows a new reveal at any point during a live hand", () => {
  const publicShownCardMasks = new Map();

  assert.equal(
    canPubliclyRevealCard({ gameState: makeState(), playerId: "p1", cardIndex: 0, publicShownCardMasks }),
    true,
  );
  assert.equal(
    canPubliclyRevealCard({
      gameState: makeState({ needsToAct: ["p2"] }),
      playerId: "p1",
      cardIndex: 0,
      publicShownCardMasks,
    }),
    true,
  );
  assert.equal(
    canPubliclyRevealCard({
      gameState: makeState({ phase: "waiting" }),
      playerId: "p1",
      cardIndex: 0,
      publicShownCardMasks,
    }),
    false,
  );
});

test("canPubliclyRevealCard rejects stale slots but allows showdown reveal without an active turn", () => {
  const publicShownCardMasks = new Map([["p1", 1]]);

  assert.equal(
    canPubliclyRevealCard({
      gameState: makeState({ phase: "showdown", needsToAct: [] }),
      playerId: "p1",
      cardIndex: 0,
      publicShownCardMasks,
    }),
    false,
  );
  assert.equal(
    canPubliclyRevealCard({
      gameState: makeState({ phase: "showdown", needsToAct: [] }),
      playerId: "p1",
      cardIndex: 1,
      publicShownCardMasks,
    }),
    true,
  );
});

test("buildPublicRevealedHoleCards keeps partial voluntary reveals visible during active play", () => {
  const gameState = makeState();
  const publicShownCardMasks = new Map([
    ["p1", 1],
    ["p2", 2],
  ]);

  assert.deepEqual(buildPublicRevealedHoleCards({ gameState, publicShownCardMasks }), {
    p1: [gameState.players.p1.holeCards[0], null],
    p2: [null, gameState.players.p2.holeCards[1]],
  });
});

test("buildPublicRevealedHoleCards reveals showdown winners without auto-tabling losers", () => {
  const gameState = makeState({
    phase: "showdown",
    autoRevealWinningHands: true,
    showdownKind: "contested",
    winners: [{ playerId: "p1", amount: 200, hand: "Pair" }],
  });

  assert.deepEqual(buildPublicRevealedHoleCards({ gameState, publicShownCardMasks: new Map([["p1", 1]]) }), {
    p1: [gameState.players.p1.holeCards[0], gameState.players.p1.holeCards[1]],
  });
});

test("buildPublicRevealedHoleCards keeps uncontested winners hidden unless they voluntarily show", () => {
  const gameState = makeState({
    phase: "showdown",
    autoRevealWinningHands: false,
    showdownKind: "uncontested",
    winners: [{ playerId: "p1", amount: 200, hand: null }],
    voluntaryShownPlayerIds: ["p2"],
  });

  assert.deepEqual(buildPublicRevealedHoleCards({ gameState, publicShownCardMasks: new Map([["p1", 1]]) }), {
    p1: [gameState.players.p1.holeCards[0], null],
    p2: [gameState.players.p2.holeCards[0], gameState.players.p2.holeCards[1]],
  });
});

test("buildPublicRevealedHoleCards waits for the showdown auto-reveal timestamp", () => {
  const gameState = makeState({
    phase: "showdown",
    autoRevealWinningHands: true,
    autoRevealWinningHandsAt: 5000,
    showdownKind: "contested",
    winners: [{ playerId: "p1", amount: 200, hand: "Pair" }],
  });

  const realNow = Date.now;
  try {
    Date.now = () => 4000;
    assert.deepEqual(buildPublicRevealedHoleCards({ gameState, publicShownCardMasks: new Map() }), {});

    Date.now = () => 5000;
    assert.deepEqual(buildPublicRevealedHoleCards({ gameState, publicShownCardMasks: new Map() }), {
      p1: [gameState.players.p1.holeCards[0], gameState.players.p1.holeCards[1]],
    });
  } finally {
    Date.now = realNow;
  }
});
