import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState, deriveFeedbackFromTransition } from "../dist/index.js";

function card(rank, suit) {
  return { rank, suit };
}

function createPlayer(id, seatIndex) {
  return {
    id,
    name: id.toUpperCase(),
    seatIndex,
    stack: 1000,
    holeCards: [card("A", "spades"), card("K", "hearts")],
    currentBet: 0,
    totalContribution: 0,
    isFolded: false,
    isAllIn: false,
    lastAction: null,
    sitOutUntilBB: false,
  };
}

function createBaseState(overrides = {}) {
  const state = createInitialState("table", { small: 25, big: 50 });
  state.phase = "pre-flop";
  state.handNumber = 3;
  state.players = {
    a: createPlayer("a", 0),
    b: createPlayer("b", 1),
  };
  state.needsToAct = ["a", "b"];
  return { ...state, ...overrides };
}

test("confirmed player actions emit action and turn cues", () => {
  for (const action of ["fold", "check", "call", "raise", "all-in"]) {
    const prevState = createBaseState();
    const nextState = structuredClone(prevState);
    nextState.needsToAct = ["b"];
    nextState.players.a.lastAction = action;
    nextState.players.a.currentBet = action === "raise" || action === "all-in" ? 200 : 100;
    nextState.players.a.totalContribution = nextState.players.a.currentBet;
    nextState.roundBet = action === "raise" || action === "all-in" ? 200 : 100;
    nextState.pot = action === "fold" ? 100 : 200;

    const feedback = deriveFeedbackFromTransition(
      prevState,
      { type: "PLAYER_ACTION", playerId: "a", action, ...(action === "raise" ? { amount: 200 } : {}) },
      nextState,
      { emittedAt: 123, source: "action" },
    );

    assert.equal(feedback.some((cue) => cue.kind === "player_action_confirmed" && cue.action === action), true);
    assert.equal(feedback.some((cue) => cue.kind === "turn_changed" && cue.actorId === "b"), true);
  }
});

test("street reveals and voting transitions emit feedback", () => {
  const prevState = createBaseState({
    phase: "flop",
    communityCards: [card("A", "spades"), card("K", "spades"), card("Q", "spades")],
    needsToAct: [],
  });
  const nextState = structuredClone(prevState);
  nextState.phase = "voting";
  nextState.communityCards = [
    card("A", "spades"),
    card("K", "spades"),
    card("Q", "spades"),
    card("J", "spades"),
  ];

  const feedback = deriveFeedbackFromTransition(
    prevState,
    { type: "PLAYER_ACTION", playerId: "a", action: "call" },
    nextState,
    { emittedAt: 321, source: "action" },
  );

  assert.equal(feedback.some((cue) => cue.kind === "street_revealed" && cue.street === "turn"), true);
  assert.equal(feedback.some((cue) => cue.kind === "voting_started"), true);
});

test("showdown transitions emit run-it announcement and payout cues", () => {
  const prevState = createBaseState({
    phase: "voting",
    communityCards: [card("A", "spades"), card("K", "spades"), card("Q", "spades")],
    needsToAct: [],
  });
  const nextState = structuredClone(prevState);
  nextState.phase = "showdown";
  nextState.runCount = 2;
  nextState.runResults = [
    {
      board: [card("A", "spades"), card("K", "spades"), card("Q", "spades"), card("J", "spades"), card("T", "spades")],
      winners: [{ playerId: "a", amount: 200, hand: "Royal Flush" }],
    },
    {
      board: [card("A", "clubs"), card("K", "clubs"), card("Q", "clubs"), card("J", "clubs"), card("T", "clubs")],
      winners: [{ playerId: "a", amount: 200, hand: "Royal Flush" }],
    },
  ];
  nextState.winners = [{ playerId: "a", amount: 400, hand: "Royal Flush" }];
  nextState.knownCardCountAtRunIt = 3;
  nextState.showdownStartedAt = 1000;
  nextState.runDealStartedAt = null;

  const feedback = deriveFeedbackFromTransition(
    prevState,
    { type: "RESOLVE_VOTE" },
    nextState,
    { emittedAt: 999, source: "timer" },
  );

  assert.equal(feedback.some((cue) => cue.kind === "showdown_started"), true);
  assert.equal(feedback.some((cue) => cue.kind === "run_it_announced" && cue.runCount === 2), true);
  assert.equal(feedback.some((cue) => cue.kind === "pot_awarded" && cue.totalAmount === 400), true);
});

test("unanimous one-run votes still emit a run-it announcement cue", () => {
  const prevState = createBaseState({
    phase: "voting",
    communityCards: [card("A", "spades"), card("K", "spades"), card("Q", "spades")],
    needsToAct: [],
  });
  const nextState = structuredClone(prevState);
  nextState.phase = "showdown";
  nextState.runCount = 1;
  nextState.runResults = [
    {
      board: [card("A", "spades"), card("K", "spades"), card("Q", "spades"), card("J", "spades"), card("T", "spades")],
      winners: [{ playerId: "a", amount: 400, hand: "Royal Flush" }],
    },
  ];
  nextState.winners = [{ playerId: "a", amount: 400, hand: "Royal Flush" }];
  nextState.knownCardCountAtRunIt = 3;
  nextState.showdownStartedAt = 1000;
  nextState.runDealStartedAt = null;

  const feedback = deriveFeedbackFromTransition(
    prevState,
    { type: "RESOLVE_VOTE" },
    nextState,
    { emittedAt: 999, source: "timer" },
  );

  assert.equal(feedback.some((cue) => cue.kind === "run_it_announced" && cue.runCount === 1), true);
});

test("direct single-run showdowns do not emit a run-it announcement cue", () => {
  const prevState = createBaseState({
    phase: "turn",
    communityCards: [card("A", "spades"), card("K", "spades"), card("Q", "spades"), card("J", "spades")],
    needsToAct: [],
  });
  const nextState = structuredClone(prevState);
  nextState.phase = "showdown";
  nextState.runCount = 1;
  nextState.runResults = [
    {
      board: [card("A", "spades"), card("K", "spades"), card("Q", "spades"), card("J", "spades"), card("T", "spades")],
      winners: [{ playerId: "a", amount: 400, hand: "Royal Flush" }],
    },
  ];
  nextState.winners = [{ playerId: "a", amount: 400, hand: "Royal Flush" }];
  nextState.knownCardCountAtRunIt = 4;
  nextState.showdownStartedAt = 1000;
  nextState.runDealStartedAt = 1000;

  const feedback = deriveFeedbackFromTransition(
    prevState,
    null,
    nextState,
    { emittedAt: 999, source: "server" },
  );

  assert.equal(feedback.some((cue) => cue.kind === "run_it_announced"), false);
});

test("plain river showdowns do not emit run-it announcements even if no run reveal timer exists", () => {
  const prevState = createBaseState({
    phase: "river",
    communityCards: [
      card("A", "spades"),
      card("K", "spades"),
      card("Q", "spades"),
      card("J", "spades"),
      card("T", "spades"),
    ],
    needsToAct: [],
  });
  const nextState = structuredClone(prevState);
  nextState.phase = "showdown";
  nextState.runCount = 1;
  nextState.runResults = [
    {
      board: [
        card("A", "spades"),
        card("K", "spades"),
        card("Q", "spades"),
        card("J", "spades"),
        card("T", "spades"),
      ],
      winners: [{ playerId: "a", amount: 400, hand: "Royal Flush" }],
    },
  ];
  nextState.winners = [{ playerId: "a", amount: 400, hand: "Royal Flush" }];
  nextState.knownCardCountAtRunIt = 5;
  nextState.showdownStartedAt = 1000;
  nextState.runDealStartedAt = null;

  const feedback = deriveFeedbackFromTransition(
    prevState,
    null,
    nextState,
    { emittedAt: 999, source: "server" },
  );

  assert.equal(feedback.some((cue) => cue.kind === "run_it_announced"), false);
});

test("timer and bomb-pot transitions emit dedicated cues", () => {
  const revealPrev = createBaseState({
    phase: "showdown",
    runCount: 2,
    runResults: [
      { board: [card("A", "spades"), card("K", "spades"), card("Q", "spades")], winners: [] },
      { board: [card("A", "clubs"), card("K", "clubs"), card("Q", "clubs")], winners: [] },
    ],
    showdownStartedAt: 1000,
    runDealStartedAt: null,
  });
  const revealNext = structuredClone(revealPrev);
  revealNext.runDealStartedAt = 1500;

  const revealFeedback = deriveFeedbackFromTransition(
    revealPrev,
    null,
    revealNext,
    { emittedAt: 1500, source: "timer" },
  );
  assert.equal(revealFeedback.some((cue) => cue.kind === "run_it_reveal_started"), true);

  const scheduledPrev = createBaseState();
  const scheduledNext = structuredClone(scheduledPrev);
  scheduledNext.bombPotNextHand = { anteBB: 4 };
  const scheduledFeedback = deriveFeedbackFromTransition(
    scheduledPrev,
    { type: "PROPOSE_BOMB_POT", playerId: "a", anteBB: 4 },
    scheduledNext,
    { emittedAt: 10, source: "action" },
  );
  assert.equal(scheduledFeedback.some((cue) => cue.kind === "bomb_pot_scheduled" && cue.anteBB === 4), true);

  const startedPrev = createBaseState({
    bombPotNextHand: { anteBB: 4 },
    handNumber: 3,
  });
  const startedNext = structuredClone(startedPrev);
  startedNext.handNumber = 4;
  startedNext.isBombPot = true;
  startedNext.bombPotNextHand = null;
  startedNext.communityCards = [card("2", "spades"), card("3", "spades"), card("4", "spades")];
  startedNext.communityCards2 = [card("2", "clubs"), card("3", "clubs"), card("4", "clubs")];
  startedNext.phase = "flop";
  const startedFeedback = deriveFeedbackFromTransition(
    startedPrev,
    { type: "START_HAND" },
    startedNext,
    { emittedAt: 20, source: "action" },
  );
  assert.equal(startedFeedback.some((cue) => cue.kind === "bomb_pot_started"), true);
  assert.equal(startedFeedback.some((cue) => cue.kind === "street_revealed" && cue.boardCount === 2), true);

  const canceledPrev = createBaseState({ bombPotNextHand: { anteBB: 2 } });
  const canceledNext = structuredClone(canceledPrev);
  canceledNext.handNumber = 4;
  canceledNext.bombPotNextHand = null;
  const canceledFeedback = deriveFeedbackFromTransition(
    canceledPrev,
    { type: "START_HAND" },
    canceledNext,
    { emittedAt: 30, source: "action" },
  );
  assert.equal(canceledFeedback.some((cue) => cue.kind === "bomb_pot_canceled" && cue.anteBB === 2), true);

  const bountyPrev = createBaseState();
  const bountyNext = structuredClone(bountyPrev);
  bountyNext.sevenTwoBountyTrigger = { winnerId: "a", perPlayer: 100, totalCollected: 300 };
  const bountyFeedback = deriveFeedbackFromTransition(
    bountyPrev,
    null,
    bountyNext,
    { emittedAt: 40, source: "server" },
  );
  assert.equal(bountyFeedback.some((cue) => cue.kind === "seven_two_bounty_triggered" && cue.winnerId === "a"), true);
});
