import test from "node:test";
import assert from "node:assert/strict";

import { buildPublicGameState } from "./publicState.mjs";

function createAnimatedShowdownState(overrides = {}) {
  return {
    phase: "showdown",
    deck: [],
    players: {},
    communityCards: [
      { rank: "A", suit: "spades" },
      { rank: "K", suit: "spades" },
      { rank: "Q", suit: "spades" },
      { rank: "J", suit: "spades" },
      { rank: "T", suit: "spades" },
    ],
    communityCards2: [],
    pot: 0,
    roundBet: 0,
    lastLegalRaiseIncrement: 50,
    isBlindIncomplete: false,
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 1,
    bigBlindSeatIndex: 2,
    blinds: { small: 25, big: 50 },
    handNumber: 8,
    tableName: "table",
    needsToAct: [],
    closedActors: [],
    sidePots: [],
    winners: [],
    showdownKind: "contested",
    runItVotes: {},
    runCount: 2,
    runResults: [
      {
        board: [
          { rank: "A", suit: "spades" },
          { rank: "K", suit: "spades" },
          { rank: "Q", suit: "spades" },
          { rank: "J", suit: "spades" },
          { rank: "T", suit: "spades" },
        ],
        winners: [],
      },
      {
        board: [
          { rank: "A", suit: "spades" },
          { rank: "K", suit: "spades" },
          { rank: "Q", suit: "spades" },
          { rank: "9", suit: "hearts" },
          { rank: "2", suit: "clubs" },
        ],
        winners: [],
      },
    ],
    autoRevealWinningHands: false,
    autoRevealWinningHandsAt: null,
    knownCardCountAtRunIt: 3,
    runDealStartedAt: null,
    showdownStartedAt: 1000,
    sevenTwoBountyBB: 0,
    sevenTwoBountyTrigger: null,
    voluntaryShownPlayerIds: [],
    isBombPot: false,
    bombPotVote: null,
    bombPotNextHand: null,
    bombPotCooldown: [],
    ...overrides,
  };
}

test("public showdown state only exposes known community cards during the run-it announcement", () => {
  const publicState = buildPublicGameState(createAnimatedShowdownState(), 2000);

  assert.equal(publicState.communityCards.length, 3);
  assert.deepEqual(publicState.runResults.map((run) => run.board.length), [3, 3]);
});

test("public showdown state exposes only the server-revealed cards for the active run", () => {
  const publicState = buildPublicGameState(
    createAnimatedShowdownState({ runDealStartedAt: 1000 }),
    2500,
  );

  assert.equal(publicState.communityCards.length, 4);
  assert.deepEqual(publicState.communityCards2, []);
  assert.deepEqual(publicState.runResults.map((run) => run.board.length), [4, 3]);
});

test("public showdown state keeps later runs hidden until the server reaches them", () => {
  const publicState = buildPublicGameState(
    createAnimatedShowdownState({ runDealStartedAt: 1000 }),
    8000,
  );

  assert.deepEqual(publicState.communityCards2, []);
  assert.deepEqual(publicState.runResults.map((run) => run.board.length), [5, 4]);
});

test("public bomb-pot showdown state redacts both boards until the server reveals them", () => {
  const publicState = buildPublicGameState(
    createAnimatedShowdownState({
      isBombPot: true,
      communityCards2: [
        { rank: "A", suit: "spades" },
        { rank: "K", suit: "spades" },
        { rank: "Q", suit: "spades" },
        { rank: "9", suit: "hearts" },
        { rank: "2", suit: "clubs" },
      ],
      runDealStartedAt: 1000,
    }),
    2500,
  );

  assert.equal(publicState.communityCards.length, 4);
  assert.equal(publicState.communityCards2.length, 4);
  assert.deepEqual(publicState.runResults.map((run) => run.board.length), [4, 4]);
});
