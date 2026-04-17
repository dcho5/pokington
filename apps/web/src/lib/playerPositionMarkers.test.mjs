import test from "node:test";
import assert from "node:assert/strict";
import { getPlayerPositionMarkers } from "./playerPositionMarkers.mjs";

test("returns markers in dealer, small blind, big blind order", () => {
  assert.deepEqual(
    getPlayerPositionMarkers({
      isBigBlind: true,
      isDealer: true,
      isSmallBlind: true,
      playerCount: 3,
    }),
    ["dealer", "smallBlind", "bigBlind"],
  );
});

test("omits the small blind marker when the dealer is also the small blind", () => {
  assert.deepEqual(
    getPlayerPositionMarkers({ isDealer: true, isSmallBlind: true, playerCount: 2 }),
    ["dealer"],
  );
});

test("returns an empty array when the seat has no markers", () => {
  assert.deepEqual(getPlayerPositionMarkers(), []);
});
