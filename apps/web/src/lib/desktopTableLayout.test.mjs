import test from "node:test";
import assert from "node:assert/strict";

import {
  getDesktopCenterStageBounds,
  getDesktopTableLayoutProfile,
} from "./desktopTableLayout.mjs";

test("keeps the normal desktop board clear of the pot", () => {
  const bounds = getDesktopCenterStageBounds();
  const profile = getDesktopTableLayoutProfile();
  const tableMidX = profile.tableReferenceSize.width / 2;

  assert.ok(Math.abs(bounds.potLeft - tableMidX) < 2);
  assert.ok(bounds.potTop > bounds.boardBottom + 40);
});

test("keeps the bomb pot layout clear of the pot", () => {
  const bounds = getDesktopCenterStageBounds({ isBombPotHand: true });
  const profile = getDesktopTableLayoutProfile({ isBombPotHand: true });
  const tableMidY = profile.tableReferenceSize.height / 2;
  const boardMidY = (bounds.boardTop + bounds.boardBottom) / 2;

  assert.ok(Math.abs(boardMidY - tableMidY) < 12);
  assert.ok(bounds.potLeft > profile.tableReferenceSize.width * 0.62);
  assert.ok(Math.abs(bounds.potTop - boardMidY) < 12);
});

test("keeps the two-run layout clear of the pot", () => {
  const bounds = getDesktopCenterStageBounds({
    isRunItBoard: true,
    runCount: 2,
  });
  const profile = getDesktopTableLayoutProfile({
    isRunItBoard: true,
    runCount: 2,
  });
  const tableMidY = profile.tableReferenceSize.height / 2;
  const boardMidY = (bounds.boardTop + bounds.boardBottom) / 2;

  assert.ok(Math.abs(boardMidY - tableMidY) < 12);
  assert.ok(bounds.potLeft > profile.tableReferenceSize.width * 0.62);
  assert.ok(Math.abs(bounds.potTop - boardMidY) < 12);
});

test("keeps the three-run layout clear of the pot", () => {
  const bounds = getDesktopCenterStageBounds({
    isRunItBoard: true,
    runCount: 3,
  });
  const profile = getDesktopTableLayoutProfile({
    isRunItBoard: true,
    runCount: 3,
  });
  const tableMidY = profile.tableReferenceSize.height / 2;
  const boardMidY = (bounds.boardTop + bounds.boardBottom) / 2;

  assert.ok(Math.abs(boardMidY - tableMidY) < 2);
  assert.ok(bounds.potLeft > profile.tableReferenceSize.width * 0.62);
  assert.ok(Math.abs(bounds.potTop - boardMidY) < 2);
});

test("keeps the original table footprint while enlarging desktop seat cards", () => {
  const profile = getDesktopTableLayoutProfile();

  assert.equal(profile.table.maxWidthPct, 92);
  assert.equal(profile.table.aspectRatio, 21 / 9);
  assert.equal(profile.seat.size, 150);
  assert.ok(profile.seat.geometry.feltX < 38);
  assert.ok(profile.seat.geometry.seatPadX < 8);
});
