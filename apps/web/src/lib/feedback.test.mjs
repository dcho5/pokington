import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWinnerChipLandingEvents,
  collectBoardRevealEvents,
  markFeedbackKey,
} from "./tableFeedback.mjs";

test("collectBoardRevealEvents emits only newly visible cards", () => {
  const events = collectBoardRevealEvents({
    previousCounts: [3, 3],
    nextCounts: [5, 4],
    handNumber: 9,
    mode: "runIt",
  });

  assert.deepEqual(
    events.map((event) => ({
      key: event.key,
      runIndex: event.runIndex,
      cardIndex: event.cardIndex,
    })),
    [
      {
        key: "h9:board_card_revealed:run-0:card-3",
        runIndex: 0,
        cardIndex: 3,
      },
      {
        key: "h9:board_card_revealed:run-0:card-4",
        runIndex: 0,
        cardIndex: 4,
      },
      {
        key: "h9:board_card_revealed:run-1:card-3",
        runIndex: 1,
        cardIndex: 3,
      },
    ],
  );
});

test("buildWinnerChipLandingEvents preserves run and tier ordering", () => {
  const events = buildWinnerChipLandingEvents({
    handNumber: 14,
    knownCardCount: 3,
    revealRunsConcurrently: false,
    runResults: [
      {
        winners: [
          { playerId: "a", amount: 200, hand: "Straight" },
          { playerId: "a", amount: 50, hand: "Straight" },
        ],
      },
      {
        winners: [{ playerId: "b", amount: 250, hand: "Flush" }],
      },
    ],
  });

  assert.equal(events.length, 3);
  assert.equal(events[0].playerId, "a");
  assert.equal(events[0].tier, 0);
  assert.equal(events[1].playerId, "a");
  assert.equal(events[1].tier, 1);
  assert.equal(events[2].playerId, "b");
  assert.equal(events[2].runIndex, 1);
  assert.equal(events[0].delayMs < events[1].delayMs, true);
  assert.equal(events[1].delayMs < events[2].delayMs, true);
});

test("markFeedbackKey dedupes repeated playback keys", () => {
  const seen = new Set();

  assert.equal(markFeedbackKey(seen, "alpha"), true);
  assert.equal(markFeedbackKey(seen, "alpha"), false);
  assert.equal(markFeedbackKey(seen, "beta"), true);
});
