import test from "node:test";
import assert from "node:assert/strict";

import { createDeck, createInitialState, gameReducer, shouldAutoRevealWinningHands } from "../dist/index.js";

test("pre-flop runouts use standard flop-turn-river burn order", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "voting";
  state.deck = createDeck();
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 0,
      holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
      currentBet: 0,
      totalContribution: 100,
      isFolded: false,
      isAllIn: true,
      lastAction: null,
      sitOutUntilBB: false,
    },
    b: {
      id: "b",
      name: "B",
      seatIndex: 1,
      stack: 0,
      holeCards: [{ rank: "Q", suit: "spades" }, { rank: "J", suit: "spades" }],
      currentBet: 0,
      totalContribution: 100,
      isFolded: false,
      isAllIn: true,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };

  state = gameReducer(state, { type: "RESOLVE_VOTE" });

  assert.deepEqual(state.runResults[0].board, [
    { rank: "K", suit: "clubs" },
    { rank: "Q", suit: "clubs" },
    { rank: "J", suit: "clubs" },
    { rank: "9", suit: "clubs" },
    { rank: "7", suit: "clubs" },
  ]);
});

test("zero-stack players are excluded from new hands", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  for (const [playerId, seatIndex, buyIn] of [
    ["a", 0, 1000],
    ["b", 1, 1000],
    ["c", 2, 0],
  ]) {
    state = gameReducer(state, {
      type: "SIT_DOWN",
      playerId,
      name: playerId.toUpperCase(),
      seatIndex,
      buyIn,
    });
  }

  state = gameReducer(state, { type: "START_HAND" });

  assert.equal(state.players.c.holeCards, null);
  assert.equal(state.players.c.isFolded, true);
  assert.equal(state.players.c.isAllIn, true);
  assert.deepEqual(state.needsToAct, ["a", "b"]);
  assert.equal(state.smallBlindSeatIndex, 0);
  assert.equal(state.bigBlindSeatIndex, 1);
});

test("heads-up short small blind all-ins skip the covered big blind action", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 10 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });

  state = gameReducer(state, { type: "START_HAND" });

  assert.ok(state.players.a.holeCards);
  assert.ok(state.players.b.holeCards);
  assert.equal(state.players.a.isAllIn, true);
  assert.equal(state.players.a.currentBet, 10);
  assert.equal(state.phase, "voting");
  assert.deepEqual(state.needsToAct, []);
  assert.equal(state.winners, null);
  assert.deepEqual(state.communityCards, []);
});

test("matched all-ins do not leave the covering player with extra action", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });

  state = gameReducer(state, { type: "START_HAND" });
  assert.equal(state.needsToAct[0], "a");

  state = gameReducer(state, { type: "PLAYER_ACTION", playerId: "a", action: "call" });

  assert.equal(state.players.a.isAllIn, true);
  assert.equal(state.players.a.totalContribution, 50);
  assert.equal(state.players.b.totalContribution, 50);
  assert.equal(state.phase, "voting");
  assert.equal(state.pot, 100);
  assert.deepEqual(state.needsToAct, []);
  assert.equal(state.winners, null);
});

test("mid-hand stand up is ignored once a player is committed", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 1000 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });
  state = gameReducer(state, { type: "START_HAND" });

  const before = JSON.stringify(state);
  const next = gameReducer(state, { type: "STAND_UP", playerId: "a" });

  assert.equal(JSON.stringify(next), before);
  assert.deepEqual(Object.keys(next.players).sort(), ["a", "b"]);
});

test("showdown falls back to waiting when fewer than two stacks are ready for the next hand", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "showdown";
  state.handNumber = 4;
  state.dealerSeatIndex = 0;
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 1200,
      holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
    b: {
      id: "b",
      name: "B",
      seatIndex: 1,
      stack: 0,
      holeCards: [{ rank: "Q", suit: "spades" }, { rank: "J", suit: "spades" }],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: true,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };

  state = gameReducer(state, { type: "START_HAND" });

  assert.equal(state.phase, "waiting");
  assert.equal(state.players.a.holeCards, null);
  assert.deepEqual(state.needsToAct, []);
  assert.equal(state.smallBlindSeatIndex, -1);
  assert.equal(state.bigBlindSeatIndex, -1);
});

test("a table that falls back to waiting can start immediately after another player sits", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "showdown";
  state.dealerSeatIndex = 0;
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 1200,
      holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };

  state = gameReducer(state, { type: "START_HAND" });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 1200 });
  state = gameReducer(state, { type: "START_HAND" });

  assert.equal(state.phase, "pre-flop");
  assert.ok(state.players.a.holeCards);
  assert.ok(state.players.b.holeCards);
  assert.equal(state.players.b.sitOutUntilBB, false);
  assert.deepEqual(state.needsToAct, ["b", "a"]);
});

test("players without cards are excluded from last-standing and turn-order logic", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "pre-flop";
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 1000,
      holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
      currentBet: 0,
      totalContribution: 0,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
    b: {
      id: "b",
      name: "B",
      seatIndex: 1,
      stack: 1000,
      holeCards: [{ rank: "Q", suit: "spades" }, { rank: "J", suit: "spades" }],
      currentBet: 0,
      totalContribution: 0,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
    ghost: {
      id: "ghost",
      name: "Ghost",
      seatIndex: 2,
      stack: 1000,
      holeCards: null,
      currentBet: 0,
      totalContribution: 0,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };
  state.needsToAct = ["a"];

  state = gameReducer(state, { type: "PLAYER_ACTION", playerId: "a", action: "fold" });

  assert.equal(state.phase, "showdown");
  assert.deepEqual(state.winners, [{ playerId: "b", amount: 0, hand: null }]);
  assert.equal(state.showdownKind, "uncontested");
  assert.equal(state.autoRevealWinningHands, false);
});

test("uncontested last-standing winners stay hidden and do not auto-collect the 7-2 bounty", () => {
  let state = createInitialState("table", { small: 25, big: 50 }, { sevenTwoBountyBB: 2 });
  state.phase = "pre-flop";
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 1000,
      holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
      currentBet: 0,
      totalContribution: 0,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
    b: {
      id: "b",
      name: "B",
      seatIndex: 1,
      stack: 1000,
      holeCards: [{ rank: "7", suit: "clubs" }, { rank: "2", suit: "hearts" }],
      currentBet: 0,
      totalContribution: 0,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };
  state.needsToAct = ["a"];

  state = gameReducer(state, { type: "PLAYER_ACTION", playerId: "a", action: "fold" });

  assert.equal(state.phase, "showdown");
  assert.deepEqual(state.winners, [{ playerId: "b", amount: 0, hand: null }]);
  assert.equal(state.showdownKind, "uncontested");
  assert.equal(state.autoRevealWinningHands, false);
  assert.equal(state.sevenTwoBountyTrigger, null);
  assert.equal(state.players.a.stack, 1000);
  assert.equal(state.players.b.stack, 1000);
});

test("shouldAutoRevealWinningHands only turns on for contested showdowns", () => {
  assert.equal(shouldAutoRevealWinningHands(null), false);
  assert.equal(shouldAutoRevealWinningHands([{ playerId: "a", amount: 100, hand: null }], "uncontested"), false);
  assert.equal(shouldAutoRevealWinningHands([{ playerId: "a", amount: 100, hand: "Last standing" }]), false);
  assert.equal(shouldAutoRevealWinningHands([{ playerId: "a", amount: 100, hand: "Uncontested" }]), false);
  assert.equal(shouldAutoRevealWinningHands([{ playerId: "a", amount: 100, hand: "Pair" }]), true);
  assert.equal(
    shouldAutoRevealWinningHands([
      { playerId: "a", amount: 50, hand: "Pair" },
      { playerId: "b", amount: 50, hand: "Pair" },
    ]),
    true,
  );
});

test("scheduled bomb pots are canceled if a next-hand entrant can no longer cover the ante", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "showdown";
  state.handNumber = 7;
  state.dealerSeatIndex = 0;
  state.bombPotNextHand = { anteBB: 4 };
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 1000,
      holeCards: [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
    b: {
      id: "b",
      name: "B",
      seatIndex: 1,
      stack: 190,
      holeCards: [{ rank: "Q", suit: "spades" }, { rank: "J", suit: "spades" }],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
    c: {
      id: "c",
      name: "C",
      seatIndex: 2,
      stack: 1000,
      holeCards: [{ rank: "9", suit: "clubs" }, { rank: "9", suit: "diamonds" }],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };

  state = gameReducer(state, { type: "START_HAND" });

  assert.equal(state.handNumber, 8);
  assert.equal(state.isBombPot, false);
  assert.equal(state.bombPotNextHand, null);
  assert.equal(state.phase, "pre-flop");
  assert.equal(state.roundBet, 50);
  assert.equal(
    state.players.a.totalContribution + state.players.b.totalContribution + state.players.c.totalContribution,
    75,
  );
  assert.equal(state.pot, 0);
  assert.deepEqual(state.communityCards, []);
  assert.deepEqual(state.communityCards2, []);
});

test("sit-down ignores malformed non-numeric buy-ins", () => {
  const state = createInitialState("table", { small: 25, big: 50 });

  const next = gameReducer(state, {
    type: "SIT_DOWN",
    playerId: "a",
    name: "A",
    seatIndex: 3,
    buyIn: "32500",
  });

  assert.equal(next, state);
  assert.deepEqual(next.players, {});
});
