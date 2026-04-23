import test from "node:test";
import assert from "node:assert/strict";

import { createDeck, createInitialState, gameReducer, shouldAutoRevealWinningHands } from "../dist/index.js";

function card(rank, suit) {
  return { rank, suit };
}

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

  const originalNow = Date.now;
  Date.now = () => 1_234;
  try {
    state = gameReducer(state, { type: "START_HAND" });
  } finally {
    Date.now = originalNow;
  }

  assert.ok(state.players.a.holeCards);
  assert.ok(state.players.b.holeCards);
  assert.equal(state.players.a.isAllIn, true);
  assert.equal(state.players.a.currentBet, 10);
  assert.equal(state.phase, "voting");
  assert.equal(state.runItVotingStartedAt, 1_234);
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

test("mid-hand boundary updates are queued instead of changing the live hand state", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "TAKE_SEAT", playerId: "a", name: "A", seatIndex: 0, buyIn: 1000 });
  state = gameReducer(state, { type: "TAKE_SEAT", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });
  state = gameReducer(state, { type: "START_HAND" });

  const next = gameReducer(state, {
    type: "REQUEST_BOUNDARY_UPDATE",
    playerId: "a",
    leaveSeat: false,
    moveToSeatIndex: 4,
    chipDelta: 500,
  });

  assert.equal(next.players.a.seatIndex, state.players.a.seatIndex);
  assert.equal(next.players.a.stack, state.players.a.stack);
  assert.deepEqual(next.pendingBoundaryUpdates.a, {
    playerId: "a",
    leaveSeat: false,
    moveToSeatIndex: 4,
    chipDelta: 500,
    requestedAt: next.pendingBoundaryUpdates.a.requestedAt,
  });
});

test("mid-hand entrants who are still waiting for the big blind can change seats immediately", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "TAKE_SEAT", playerId: "a", name: "A", seatIndex: 0, buyIn: 1000 });
  state = gameReducer(state, { type: "TAKE_SEAT", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });
  state = gameReducer(state, { type: "START_HAND" });
  state = gameReducer(state, { type: "TAKE_SEAT", playerId: "c", name: "C", seatIndex: 2, buyIn: 1000 });

  const next = gameReducer(state, {
    type: "REQUEST_BOUNDARY_UPDATE",
    playerId: "c",
    leaveSeat: false,
    moveToSeatIndex: 4,
    chipDelta: 0,
  });

  assert.equal(next.players.c.seatIndex, 4);
  assert.equal(next.pendingBoundaryUpdates.c, undefined);
  assert.equal(next.players.c.sitOutUntilBB, true);
  assert.equal(next.players.c.holeCards, null);
});

test("waiting-room seat changes move the player without changing stack or identity", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 1300 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 900 });

  state = gameReducer(state, { type: "CHANGE_SEAT", playerId: "a", seatIndex: 4 });

  assert.equal(state.players.a.seatIndex, 4);
  assert.equal(state.players.a.stack, 1300);
  assert.equal(state.players.a.id, "a");
  assert.equal(state.players.b.seatIndex, 1);
});

test("seat changes are rejected once a hand has started", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 1000 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });
  state = gameReducer(state, { type: "START_HAND" });

  const next = gameReducer(state, { type: "CHANGE_SEAT", playerId: "a", seatIndex: 4 });

  assert.equal(next.players.a.seatIndex, state.players.a.seatIndex);
});

test("showdown stand up is allowed between hands", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "showdown";
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 1200,
      holeCards: [card("A", "spades"), card("K", "spades")],
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
      stack: 800,
      holeCards: [card("Q", "clubs"), card("Q", "diamonds")],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: true,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };

  const next = gameReducer(state, { type: "STAND_UP", playerId: "a" });

  assert.deepEqual(Object.keys(next.players).sort(), ["b"]);
});

test("busted showdown players can rebuy immediately without leaving their seat", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "showdown";
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 0,
      holeCards: [card("A", "spades"), card("K", "spades")],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: true,
      lastAction: null,
      sitOutUntilBB: true,
    },
    b: {
      id: "b",
      name: "B",
      seatIndex: 1,
      stack: 1200,
      holeCards: [card("Q", "clubs"), card("Q", "diamonds")],
      currentBet: 0,
      totalContribution: 200,
      isFolded: false,
      isAllIn: false,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };

  state = gameReducer(state, {
    type: "REQUEST_BOUNDARY_UPDATE",
    playerId: "a",
    leaveSeat: false,
    moveToSeatIndex: null,
    chipDelta: 1500,
  });

  assert.equal(state.players.a.seatIndex, 0);
  assert.equal(state.players.a.stack, 1500);
  assert.equal(state.players.a.sitOutUntilBB, false);
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

test("standing up clears bomb-pot cooldown and cancels an active proposal from that player", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 1000 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });

  state = gameReducer(state, { type: "PROPOSE_BOMB_POT", playerId: "a", anteBB: 2 });
  assert.deepEqual(state.bombPotCooldown, ["a"]);
  assert.equal(state.bombPotVote?.proposedBy, "a");

  state = gameReducer(state, { type: "STAND_UP", playerId: "a" });

  assert.deepEqual(state.bombPotCooldown, []);
  assert.equal(state.bombPotVote, null);
  assert.equal(state.players.a, undefined);
});

test("bomb-pot proposals stamp a start time and clear it when the vote ends", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "a", name: "A", seatIndex: 0, buyIn: 1000 });
  state = gameReducer(state, { type: "SIT_DOWN", playerId: "b", name: "B", seatIndex: 1, buyIn: 1000 });

  const originalNow = Date.now;
  Date.now = () => 4_567;
  try {
    state = gameReducer(state, { type: "PROPOSE_BOMB_POT", playerId: "a", anteBB: 2 });
  } finally {
    Date.now = originalNow;
  }

  assert.equal(state.bombPotVote?.proposedBy, "a");
  assert.equal(state.bombPotVotingStartedAt, 4_567);

  state = gameReducer(state, { type: "VOTE_BOMB_POT", playerId: "b", approve: false });

  assert.equal(state.bombPotVote, null);
  assert.equal(state.bombPotVotingStartedAt, null);
});

test("multi-run aggregate winners preserve distinct winning hand labels", () => {
  let state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "voting";
  state.runItVotes = { a: 3, b: 3 };
  state.players = {
    a: {
      id: "a",
      name: "A",
      seatIndex: 0,
      stack: 0,
      holeCards: [card("A", "spades"), card("A", "diamonds")],
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
      holeCards: [card("8", "clubs"), card("9", "diamonds")],
      currentBet: 0,
      totalContribution: 100,
      isFolded: false,
      isAllIn: true,
      lastAction: null,
      sitOutUntilBB: false,
    },
  };

  const tail = [
    card("4", "clubs"),
    card("3", "clubs"),
    card("2", "spades"),
    card("K", "clubs"),
    card("K", "spades"),
    card("2", "diamonds"),
    card("2", "hearts"),
    card("K", "diamonds"),
    card("K", "hearts"),
    card("A", "clubs"),
    card("Q", "spades"),
    card("3", "hearts"),
    card("J", "diamonds"),
    card("T", "clubs"),
    card("9", "spades"),
    card("7", "hearts"),
    card("2", "clubs"),
    card("7", "spades"),
  ];
  const excluded = new Set([
    "A-spades", "A-diamonds", "8-clubs", "9-diamonds",
    "4-clubs", "3-clubs", "2-spades", "K-clubs", "K-spades",
    "2-diamonds", "2-hearts", "K-diamonds", "K-hearts", "A-clubs",
    "Q-spades", "3-hearts", "J-diamonds", "T-clubs", "9-spades",
    "7-hearts", "2-clubs", "7-spades",
  ]);
  const filler = createDeck().filter((c) => !excluded.has(`${c.rank}-${c.suit}`));
  state.deck = [...filler, ...tail];

  state = gameReducer(state, { type: "RESOLVE_VOTE" });

  assert.equal(state.runCount, 3);
  assert.equal(state.winners?.length, 1);
  assert.equal(state.winners?.[0].playerId, "a");
  assert.equal(state.winners?.[0].hand, "One Pair / Full House / Two Pair");
});
