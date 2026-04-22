import test from "node:test";
import assert from "node:assert/strict";

import { applyPendingBoundaryUpdates } from "./handBoundaryExit.mjs";

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
    nextHandStartsAt: 2000,
    sevenTwoBountyBB: 0,
    sevenTwoBountyTrigger: null,
    voluntaryShownPlayerIds: [],
    isBombPot: false,
    bombPotVote: {
      anteBB: 2,
      proposedBy: "p1",
      votes: { p1: true, p2: true, p3: false },
    },
    bombPotVotingStartedAt: 1000,
    bombPotNextHand: null,
    bombPotCooldown: ["p1", "p2", "p3"],
    pendingBoundaryUpdates: {},
    ...overrides,
  };
}

test("applies queued leave requests before the next hand", () => {
  const { gameState, realizedTransitions } = applyPendingBoundaryUpdates(makeState({
    pendingBoundaryUpdates: {
      p1: {
        playerId: "p1",
        leaveSeat: true,
        moveToSeatIndex: null,
        chipDelta: 0,
        requestedAt: 1,
      },
    },
  }));

  assert.deepEqual(realizedTransitions, [
    {
      playerId: "p1",
      beforePlayer: makePlayer(),
      afterPlayer: null,
    },
  ]);
  assert.deepEqual(Object.keys(gameState.players).sort(), ["p2", "p3"]);
  assert.deepEqual(gameState.needsToAct, ["p2"]);
  assert.deepEqual(gameState.closedActors, ["p2", "p3"]);
  assert.deepEqual(gameState.bombPotCooldown, ["p2", "p3"]);
  assert.equal(gameState.bombPotVote, null);
});

test("keeps busted players seated and applies queued chip and seat updates", () => {
  const { gameState, realizedTransitions } = applyPendingBoundaryUpdates(makeState({
    pendingBoundaryUpdates: {
      p2: {
        playerId: "p2",
        leaveSeat: false,
        moveToSeatIndex: 5,
        chipDelta: 2000,
        requestedAt: 2,
      },
    },
  }));

  assert.equal(gameState.players.p2.seatIndex, 5);
  assert.equal(gameState.players.p2.stack, 2000);
  assert.equal(gameState.players.p2.sitOutUntilBB, false);
  assert.deepEqual(realizedTransitions, [
    {
      playerId: "p2",
      beforePlayer: makePlayer({
        id: "p2",
        name: "Player 2",
        seatIndex: 1,
        stack: 0,
        totalContribution: 150,
        isAllIn: true,
      }),
      afterPlayer: gameState.players.p2,
    },
  ]);
});

test("rejects full-stack cash-outs while still allowing the seat move portion", () => {
  const { gameState } = applyPendingBoundaryUpdates(makeState({
    pendingBoundaryUpdates: {
      p3: {
        playerId: "p3",
        leaveSeat: false,
        moveToSeatIndex: 6,
        chipDelta: -1800,
        requestedAt: 3,
      },
    },
  }));

  assert.equal(gameState.players.p3.seatIndex, 6);
  assert.equal(gameState.players.p3.stack, 1800);
  assert.equal(gameState.players.p3.isAllIn, false);
});
