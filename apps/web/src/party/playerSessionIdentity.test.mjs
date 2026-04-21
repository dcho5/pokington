import test from "node:test";
import assert from "node:assert/strict";

import { shouldRotatePlayerSession } from "./playerSessionIdentity.mjs";

function createLedgerEntry(overrides = {}) {
  return {
    playerId: "player-alice",
    name: "Alice",
    buyIns: [30000],
    cashOuts: [0],
    isSeated: false,
    currentStack: 0,
    ...overrides,
  };
}

test("shared-device sit downs rotate to a fresh player session when the name changes", () => {
  const shouldRotate = shouldRotatePlayerSession({
    currentPlayerId: "player-alice",
    gameStatePlayers: {},
    sessionLedger: new Map([["player-alice", createLedgerEntry()]]),
    requestedName: "Bob",
  });

  assert.equal(shouldRotate, true);
});

test("a returning player on the same device keeps the existing session when the name matches", () => {
  const shouldRotate = shouldRotatePlayerSession({
    currentPlayerId: "player-alice",
    gameStatePlayers: {},
    sessionLedger: new Map([["player-alice", createLedgerEntry({ isSeated: false })]]),
    requestedName: " Alice ",
  });

  assert.equal(shouldRotate, false);
});

test("active seated players never rotate identities mid-session", () => {
  const shouldRotate = shouldRotatePlayerSession({
    currentPlayerId: "player-alice",
    gameStatePlayers: {
      "player-alice": {
        id: "player-alice",
        name: "Alice",
        seatIndex: 0,
      },
    },
    sessionLedger: new Map([["player-alice", createLedgerEntry({ isSeated: true, currentStack: 2500 })]]),
    requestedName: "Bob",
  });

  assert.equal(shouldRotate, false);
});
