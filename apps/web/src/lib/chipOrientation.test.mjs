import test from "node:test";
import assert from "node:assert/strict";

import {
  computeAngleBetweenPoints,
  computeDesktopChipAngle,
  computeMobileChipAngle,
  getDesktopChipPoint,
  getDesktopSeatPoint,
  getMobileSeatPoint,
  DEFAULT_CHIP_ANGLE,
  MOBILE_CHIP_POINT,
  MOBILE_SELF_POINT,
} from "./chipOrientation.mjs";
import { getDesktopCenterStageVariant, getDesktopTableLayoutProfile } from "./desktopTableLayout.mjs";
import { getMobileSeatStripSlot } from "./mobileSeatStripLayout.mjs";

function assertAngleClose(actual, expected, epsilon = 0.0001) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function assertFacingAngleClose(actual, expected, epsilon = 0.0001) {
  const delta = ((actual - expected + 540) % 360) - 180;
  assert.ok(
    Math.abs(delta) <= epsilon,
    `expected ${actual} to face within ${epsilon} of ${expected}`,
  );
}

test("computes chip angles directly from the chip-to-player vector", () => {
  assertAngleClose(computeAngleBetweenPoints({ x: 0, y: 0 }, { x: 1, y: 0 }), 0);
  assertAngleClose(computeAngleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: 1 }), 90);
  assertAngleClose(computeAngleBetweenPoints({ x: 0, y: 0 }, { x: -1, y: 0 }), 180);
  assertAngleClose(computeAngleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: -1 }), -90);
});

test("default chip angle keeps the highlight pointed upward when idle", () => {
  assertAngleClose(DEFAULT_CHIP_ANGLE, -38.65980825409008);
});

test("desktop chip orientation follows the chip location across center-stage layouts", () => {
  const profile = getDesktopTableLayoutProfile();
  const { width: tableWidth, height: tableHeight } = profile.tableReferenceSize;
  const geometry = profile.seat.geometry;
  const seatIndex = 0;
  const targetPoint = getDesktopSeatPoint({
    seatIndex,
    totalSeats: 10,
    geometry,
    tableWidth,
    tableHeight,
  });
  const centerBasedAngle = computeAngleBetweenPoints(
    { x: tableWidth / 2, y: tableHeight / 2 },
    targetPoint,
  );

  const variants = [
    getDesktopCenterStageVariant(),
    getDesktopCenterStageVariant({ isBombPotHand: true }),
    getDesktopCenterStageVariant({ isRunItBoard: true, runCount: 3 }),
  ];
  const angles = variants.map((variant) =>
    computeDesktopChipAngle({
      chipLeftPct: variant.chipLeftPct,
      chipTopPct: variant.chipTopPct,
      seatIndex,
      totalSeats: 10,
      geometry,
      tableWidth,
      tableHeight,
    }),
  );

  variants.forEach((variant, index) => {
    const expected =
      computeAngleBetweenPoints(
        getDesktopChipPoint({
          chipLeftPct: variant.chipLeftPct,
          chipTopPct: variant.chipTopPct,
          tableWidth,
          tableHeight,
        }),
        targetPoint,
      ) - (-90 - DEFAULT_CHIP_ANGLE);

    assertFacingAngleClose(angles[index], expected);
  });

  assert.ok(
    Math.abs(angles[1] - centerBasedAngle) > 40,
    "split-layout chip angle should change when the chip is moved away from table center",
  );
  assert.ok(
    Math.abs(angles[2] - centerBasedAngle) > 40,
    "run-it chip angle should change when the chip is moved away from table center",
  );
  assert.ok(
    Math.abs(angles[0] - angles[1]) > 40,
    "moving the chip between standard and split layouts should materially change the aim angle",
  );
  assert.ok(
    Math.abs(angles[0] - angles[2]) > 40,
    "moving the chip into the three-run layout should materially change the aim angle",
  );
});

test("mobile chip orientation follows the fixed seat strip slot instead of compacting around the viewer", () => {
  const viewerSeatIndex = 0;
  const actorSeatIndex = 1;
  const actorSlot = getMobileSeatStripSlot(actorSeatIndex);
  assert.ok(actorSlot);

  const actorPoint = getMobileSeatPoint({
    seatIndex: actorSeatIndex,
    viewerSeatIndex,
    totalSeats: 10,
  });
  assert.deepEqual(actorPoint, {
    x: actorSlot.viewportXFrac,
    y: actorSlot.viewportYFrac,
  });

  const angle = computeMobileChipAngle({
    actorSeatIndex,
    viewerSeatIndex,
    totalSeats: 10,
  });
  const expected =
    computeAngleBetweenPoints(MOBILE_CHIP_POINT, actorPoint) - (-90 - DEFAULT_CHIP_ANGLE);

  assertFacingAngleClose(angle, expected);
});

test("mobile chip orientation aims toward the local hand controls when the viewer is acting", () => {
  const angle = computeMobileChipAngle({
    actorSeatIndex: 4,
    viewerSeatIndex: 4,
    totalSeats: 10,
  });
  const expected =
    computeAngleBetweenPoints(MOBILE_CHIP_POINT, MOBILE_SELF_POINT) - (-90 - DEFAULT_CHIP_ANGLE);

  assert.deepEqual(
    getMobileSeatPoint({ seatIndex: 4, viewerSeatIndex: 4, totalSeats: 10 }),
    MOBILE_SELF_POINT,
  );
  assertFacingAngleClose(angle, expected);
});
