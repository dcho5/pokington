import test from "node:test";
import assert from "node:assert/strict";

import { deriveStreetPauseSnapshot } from "./streetSweep.mjs";

test("street sweep only animates callable chips when uncallable excess is returned", () => {
  const prev = {
    phase: "turn",
    handNumber: 4,
    players: {
      shorty: { id: "shorty", seatIndex: 0, currentBet: 250, totalContribution: 900, lastAction: "call" },
      cover: { id: "cover", seatIndex: 1, currentBet: 500, totalContribution: 1200, lastAction: "raise" },
    },
  };
  const next = {
    phase: "showdown",
    handNumber: 4,
    players: {
      shorty: { id: "shorty", seatIndex: 0, currentBet: 0, totalContribution: 900, lastAction: null },
      cover: { id: "cover", seatIndex: 1, currentBet: 0, totalContribution: 950, lastAction: null },
    },
  };

  assert.deepEqual(deriveStreetPauseSnapshot(prev, next), [
    { id: "shorty", seatIndex: 0, currentBet: 250, lastAction: "call", isAllIn: false },
    { id: "cover", seatIndex: 1, currentBet: 250, lastAction: "raise", isAllIn: false },
  ]);
});

test("street sweep reconstructs the round-closing caller from feedback", () => {
  const prev = {
    phase: "turn",
    handNumber: 7,
    roundBet: 500,
    players: {
      bettor: { id: "bettor", seatIndex: 0, currentBet: 500, totalContribution: 1400, lastAction: "raise" },
      caller: { id: "caller", seatIndex: 1, currentBet: 0, totalContribution: 900, lastAction: null },
    },
  };
  const next = {
    phase: "river",
    handNumber: 7,
    players: {
      bettor: { id: "bettor", seatIndex: 0, currentBet: 0, totalContribution: 1400, lastAction: null },
      caller: { id: "caller", seatIndex: 1, currentBet: 0, totalContribution: 1400, lastAction: null },
    },
  };
  const feedback = [
    {
      kind: "player_action_confirmed",
      playerId: "caller",
      action: "call",
      currentBet: 500,
      totalContribution: 1400,
      isAllIn: false,
    },
  ];

  assert.deepEqual(deriveStreetPauseSnapshot(prev, next, feedback), [
    { id: "bettor", seatIndex: 0, currentBet: 500, lastAction: "raise", isAllIn: false },
    { id: "caller", seatIndex: 1, currentBet: 500, lastAction: "call", isAllIn: false },
  ]);
});

test("street sweep preserves a boundary-closing check even when no chips move", () => {
  const prev = {
    phase: "river",
    handNumber: 9,
    players: {
      bettor: { id: "bettor", seatIndex: 0, currentBet: 0, totalContribution: 600, lastAction: "check" },
      checker: { id: "checker", seatIndex: 1, currentBet: 0, totalContribution: 600, lastAction: null },
    },
  };
  const next = {
    phase: "showdown",
    handNumber: 9,
    players: {
      bettor: { id: "bettor", seatIndex: 0, currentBet: 0, totalContribution: 600, lastAction: null },
      checker: { id: "checker", seatIndex: 1, currentBet: 0, totalContribution: 600, lastAction: null },
    },
  };
  const feedback = [
    {
      kind: "player_action_confirmed",
      playerId: "checker",
      action: "check",
      currentBet: 0,
      totalContribution: 600,
      isAllIn: false,
    },
  ];

  assert.deepEqual(deriveStreetPauseSnapshot(prev, next, feedback), [
    { id: "bettor", seatIndex: 0, currentBet: 0, lastAction: "check", isAllIn: false },
    { id: "checker", seatIndex: 1, currentBet: 0, lastAction: "check", isAllIn: false },
  ]);
});

test("street sweep returns null when there is no boundary transition to preserve", () => {
  const prev = {
    phase: "turn",
    handNumber: 10,
    players: {
      cover: { id: "cover", seatIndex: 1, currentBet: 300, totalContribution: 1100, lastAction: "raise" },
    },
  };
  const next = {
    phase: "turn",
    handNumber: 10,
    players: {
      cover: { id: "cover", seatIndex: 1, currentBet: 300, totalContribution: 1100, lastAction: "raise" },
    },
  };

  assert.equal(deriveStreetPauseSnapshot(prev, next), null);
});
