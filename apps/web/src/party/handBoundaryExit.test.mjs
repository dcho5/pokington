import test from "node:test";
import assert from "node:assert/strict";

import { removePlayersBeforeNextHand } from "./handBoundaryExit.mjs";

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
    totalContribution: 200,
    isFolded: false,
    isAllIn: false,
    lastAction: null,
    sitOutUntilBB: false,
    ...overrides,
  };
}

function makeState(overrides = {}) {
  return {
    phase: "showdown",
    deck: [],
    players: {
      p1: makePlayer(),
      p2: makePlayer({
        id: "p2",
        name: "Player 2",
        seatIndex: 1,
        stack: 0,
        totalContribution: 150,
        isAllIn: true,
      }),
      p3: makePlayer({
        id: "p3",
        name: "Player 3",
        seatIndex: 2,
        stack: 1800,
        totalContribution: 200,
      }),
    },
    communityCards: [],
    communityCards2: [],
    pot: 0,
    roundBet: 0,
    lastLegalRaiseIncrement: 50,
    isBlindIncomplete: false,
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 1,
    bigBlindSeatIndex: 2,
    blinds: { small: 25, big: 50 },
    handNumber: 12,
    tableName: "table",
    needsToAct: ["p1", "p2"],
    closedActors: ["p2", "p3"],
    sidePots: [],
    winners: [],
    showdownKind: "contested",
    runItVotes: {},
    runCount: 1,
    runResults: [],
    autoRevealWinningHands: false,
    autoRevealWinningHandsAt: null,
    knownCardCountAtRunIt: 5,
    runDealStartedAt: null,
    showdownStartedAt: 1000,
    sevenTwoBountyBB: 0,
    sevenTwoBountyTrigger: null,
    voluntaryShownPlayerIds: [],
    isBombPot: false,
    bombPotVote: {
      anteBB: 2,
      proposedBy: "p1",
      votes: { p1: true, p2: true, p3: false },
    },
    bombPotNextHand: null,
    bombPotCooldown: ["p1", "p2", "p3"],
    ...overrides,
  };
}

test("removes queued leavers before the next hand even if the table is still in showdown", () => {
  const { gameState, removedPlayers } = removePlayersBeforeNextHand(makeState(), ["p1"]);

  assert.deepEqual(removedPlayers, [
    { playerId: "p1", stack: 1000 },
    { playerId: "p2", stack: 0 },
  ]);
  assert.deepEqual(Object.keys(gameState.players).sort(), ["p3"]);
  assert.deepEqual(gameState.needsToAct, []);
  assert.deepEqual(gameState.closedActors, ["p3"]);
  assert.deepEqual(gameState.bombPotCooldown, ["p3"]);
  assert.equal(gameState.bombPotVote, null);
});

test("deduplicates queued and zero-stack removals cleanly", () => {
  const { gameState, removedPlayers } = removePlayersBeforeNextHand(makeState(), ["p2"]);

  assert.deepEqual(removedPlayers, [
    { playerId: "p2", stack: 0 },
  ]);
  assert.deepEqual(Object.keys(gameState.players).sort(), ["p1", "p3"]);
});
