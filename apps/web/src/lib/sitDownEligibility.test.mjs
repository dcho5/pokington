import test from "node:test";
import assert from "node:assert/strict";

import { classifySitDownRequest } from "./sitDownEligibility.mjs";

test("classifies a busted showdown player re-entering the same seat as a rebuy", () => {
  assert.equal(
    classifySitDownRequest({
      phase: "showdown",
      myPlayerId: "me",
      seatIndex: 4,
      players: {
        me: { stack: 0, seatIndex: 4 },
      },
    }),
    "rebuy",
  );
});

test("blocks seated players from using sit-down during active hands", () => {
  assert.equal(
    classifySitDownRequest({
      phase: "turn",
      myPlayerId: "me",
      seatIndex: 4,
      players: {
        me: { stack: 1200, seatIndex: 4 },
      },
    }),
    "blocked",
  );
});

test("allows seated players who are waiting for the big blind to switch to another open seat", () => {
  assert.equal(
    classifySitDownRequest({
      phase: "turn",
      myPlayerId: "me",
      seatIndex: 4,
      players: {
        me: {
          stack: 1200,
          seatIndex: 1,
          hasCards: false,
          currentBet: 0,
          totalContribution: 0,
          sitOutUntilBB: true,
        },
      },
    }),
    "change-seat",
  );
});
