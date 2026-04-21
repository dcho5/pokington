import test from "node:test";
import assert from "node:assert/strict";

import { deriveStreetPauseChips } from "./streetSweep.mjs";

test("street sweep only animates callable chips when uncallable excess is returned", () => {
  const prev = {
    phase: "turn",
    players: {
      shorty: { id: "shorty", seatIndex: 0, currentBet: 250, totalContribution: 900 },
      cover: { id: "cover", seatIndex: 1, currentBet: 500, totalContribution: 1200 },
    },
  };
  const next = {
    phase: "showdown",
    players: {
      shorty: { id: "shorty", seatIndex: 0, currentBet: 0, totalContribution: 900 },
      cover: { id: "cover", seatIndex: 1, currentBet: 0, totalContribution: 950 },
    },
  };

  assert.deepEqual(deriveStreetPauseChips(prev, next), [
    { id: "shorty", seatIndex: 0, amount: 250 },
    { id: "cover", seatIndex: 1, amount: 250 },
  ]);
});

test("street sweep returns null when nothing callable moves to the pot", () => {
  const prev = {
    phase: "turn",
    players: {
      cover: { id: "cover", seatIndex: 1, currentBet: 300, totalContribution: 1100 },
    },
  };
  const next = {
    phase: "showdown",
    players: {
      cover: { id: "cover", seatIndex: 1, currentBet: 0, totalContribution: 800 },
    },
  };

  assert.equal(deriveStreetPauseChips(prev, next), null);
});
