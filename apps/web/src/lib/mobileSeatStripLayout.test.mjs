import test from "node:test";
import assert from "node:assert/strict";

import {
  MOBILE_SEAT_STRIP_TOTAL_SEATS,
  getMobileSeatStripGridPosition,
  getMobileSeatStripSlot,
  getMobileSeatStripViewportPoint,
} from "./mobileSeatStripLayout.mjs";

test("mobile seat strip exposes fixed grid slots for all 10 seats", () => {
  const slots = Array.from({ length: MOBILE_SEAT_STRIP_TOTAL_SEATS }, (_, seatIndex) =>
    getMobileSeatStripSlot(seatIndex),
  );

  assert.equal(slots.every(Boolean), true);
  assert.deepEqual(
    slots.map((slot) => [slot.row, slot.column]),
    [
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
    ],
  );
});

test("mobile seat strip keeps seat 8 in the bottom-center slot", () => {
  assert.deepEqual(getMobileSeatStripGridPosition(7), {
    row: 1,
    column: 2,
  });
});

test("mobile seat strip viewport points stay deterministic", () => {
  assert.deepEqual(
    getMobileSeatStripViewportPoint(9, 400, 800),
    { x: 360, y: 192 },
  );
});
