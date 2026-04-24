import test from "node:test";
import assert from "node:assert/strict";

import {
  formatMobileSeatStripAmount,
  MOBILE_SEAT_STRIP_HEIGHT_PX,
  MOBILE_SEAT_STRIP_METRICS,
  MOBILE_SEAT_STRIP_TOTAL_SEATS,
  getMobileSeatStripGridPosition,
  getMobileSeatStripSlot,
  getMobileSeatStripViewportPoint,
  resolveMobileSeatStripPrimaryBadge,
} from "./mobileSeatStripLayout.mjs";

test("mobile seat strip exposes fixed grid slots for all 10 seats", () => {
  const slots = Array.from({ length: MOBILE_SEAT_STRIP_TOTAL_SEATS }, (_, seatIndex) =>
    getMobileSeatStripSlot(seatIndex),
  );

  assert.equal(slots.every(Boolean), true);
  assert.deepEqual(
    slots.map((slot) => [slot.row, slot.column]),
    [
      [0, 2], [0, 3], [0, 4], [1, 4], [1, 3],
      [1, 2], [1, 1], [1, 0], [0, 0], [0, 1],
    ],
  );
});

test("mobile seat strip keeps seat 1 in the top-center slot and wraps clockwise", () => {
  assert.deepEqual(getMobileSeatStripGridPosition(0), {
    row: 0,
    column: 2,
  });
  assert.deepEqual(getMobileSeatStripGridPosition(7), {
    row: 1,
    column: 0,
  });
});

test("mobile seat strip keeps occupied and empty seats in fixed centered footprints", () => {
  assert.equal(getMobileSeatStripSlot(0)?.occupiedFootprintWidthPx, MOBILE_SEAT_STRIP_METRICS.occupiedFootprintWidthPx);
  assert.equal(getMobileSeatStripSlot(0)?.emptyFootprintWidthPx, MOBILE_SEAT_STRIP_METRICS.emptyFootprintWidthPx);
});

test("mobile seat strip uses the compact mobile height budget", () => {
  assert.equal(MOBILE_SEAT_STRIP_HEIGHT_PX, 148);
});

test("mobile seat strip viewport points stay deterministic", () => {
  assert.deepEqual(
    getMobileSeatStripViewportPoint(9, 400, 800),
    { x: 120, y: 104 },
  );
});

test("mobile seat strip formats compact amounts for constrained badges", () => {
  assert.equal(formatMobileSeatStripAmount(25), "$0.25");
  assert.equal(formatMobileSeatStripAmount(2455), "$24.6");
  assert.equal(formatMobileSeatStripAmount(125000), "$1.3k");
});

test("mobile seat primary badge prioritizes bet, then all-in, then action, and hides idle stacks", () => {
  assert.deepEqual(
    resolveMobileSeatStripPrimaryBadge({ currentBet: 10, lastAction: "raise", stack: 2400 }),
    { kind: "bet", label: "$0.10" },
  );
  assert.deepEqual(
    resolveMobileSeatStripPrimaryBadge({ currentBet: 0, isAllIn: true, lastAction: "call", stack: 0 }),
    { kind: "all-in", label: "ALL IN" },
  );
  assert.deepEqual(
    resolveMobileSeatStripPrimaryBadge({ currentBet: 0, lastAction: "call", stack: 2400 }),
    { kind: "action", label: "CALL" },
  );
  assert.equal(
    resolveMobileSeatStripPrimaryBadge({ currentBet: 0, lastAction: null, stack: 2400 }),
    null,
  );
});
