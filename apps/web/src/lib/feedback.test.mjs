import test from "node:test";
import assert from "node:assert/strict";

import {
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

test("markFeedbackKey dedupes repeated playback keys", () => {
  const seen = new Set();

  assert.equal(markFeedbackKey(seen, "alpha"), true);
  assert.equal(markFeedbackKey(seen, "alpha"), false);
  assert.equal(markFeedbackKey(seen, "beta"), true);
});
