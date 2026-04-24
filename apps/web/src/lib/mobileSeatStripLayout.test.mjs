import test from "node:test";
import assert from "node:assert/strict";

import {
  MOBILE_SEAT_STRIP_HEIGHT_PX,
  MOBILE_SEAT_STRIP_METRICS,
  MOBILE_SEAT_STRIP_TOTAL_SEATS,
  getMobileSeatStripGridPosition,
  getMobileSeatStripSlot,
  getMobileSeatStripViewportPoint,
  resolveMobileSeatStripRailContent,
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

test("mobile seat strip opens center rails away from each other", () => {
  assert.equal(getMobileSeatStripSlot(2)?.railDirection, "right");
  assert.equal(getMobileSeatStripSlot(7)?.railDirection, "left");
});

test("mobile seat strip exposes deterministic avatar anchors for inline rails", () => {
  assert.equal(getMobileSeatStripSlot(0)?.avatarAnchorX, MOBILE_SEAT_STRIP_METRICS.avatarSizePx / 2);
  assert.equal(
    getMobileSeatStripSlot(9)?.avatarAnchorX,
    MOBILE_SEAT_STRIP_METRICS.occupiedFootprintWidthPx - (MOBILE_SEAT_STRIP_METRICS.avatarSizePx / 2),
  );
});

test("mobile seat strip uses the compact mobile height budget", () => {
  assert.equal(MOBILE_SEAT_STRIP_HEIGHT_PX, 148);
});

test("mobile seat strip viewport points stay deterministic", () => {
  assert.deepEqual(
    getMobileSeatStripViewportPoint(9, 400, 800),
    { x: 360, y: 164 },
  );
});

test("mobile seat rail prioritizes live bet, then action, then stack", () => {
  assert.deepEqual(
    resolveMobileSeatStripRailContent({ currentBet: 10, lastAction: "raise" }),
    { primary: "bet", secondary: "stack" },
  );
  assert.deepEqual(
    resolveMobileSeatStripRailContent({ currentBet: 0, lastAction: "call" }),
    { primary: "action", secondary: "stack" },
  );
  assert.deepEqual(
    resolveMobileSeatStripRailContent({ currentBet: 0, lastAction: null }),
    { primary: "stack", secondary: null },
  );
});
