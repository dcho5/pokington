import test from "node:test";
import assert from "node:assert/strict";

import { computeDesktopBetBeaconLayout, getDesktopBetAnchorSide } from "./desktopBetLayout.mjs";
import { getDesktopSeatBadgeMetrics } from "./desktopSeatBadgeLayout.mjs";
import { getDesktopTableLayoutProfile } from "./desktopTableLayout.mjs";

test("uses a simple left-side anchor for all desktop bet pills", () => {
  assert.equal(getDesktopBetAnchorSide({ sx: 0, sy: -39 }), "left");
  assert.equal(getDesktopBetAnchorSide({ sx: 0, sy: 39 }), "left");
  assert.equal(getDesktopBetAnchorSide({ sx: -18, sy: 0 }), "left");
  assert.equal(getDesktopBetAnchorSide({ sx: 18, sy: 0 }), "left");
});

test("keeps all desktop bet pills on the mirrored left badge rail", () => {
  const profile = getDesktopTableLayoutProfile();
  const metrics = getDesktopSeatBadgeMetrics(profile.seat.size);
  const expectedHorizontalDeltaPct =
    (metrics.leftBadgeCenterOffsetXPx / profile.tableReferenceSize.width) * 100;
  const expectedVerticalDeltaPct =
    (metrics.badgeCenterOffsetYPx / profile.tableReferenceSize.height) * 100;

  Array.from({ length: 10 }, (_, seatIndex) => {
    const layout = computeDesktopBetBeaconLayout({
      seatIndex,
      totalSeats: 10,
      geometry: profile.seat.geometry,
      seatSize: profile.seat.size,
      tableWidth: profile.tableReferenceSize.width,
      tableHeight: profile.tableReferenceSize.height,
    });

    assert.equal(layout.anchorSide, "left");
    assert.ok(Math.abs((layout.leftPct - (50 + layout.seatX)) - expectedHorizontalDeltaPct) < 0.05);
    assert.ok(Math.abs((layout.topPct - (50 + layout.seatY)) - expectedVerticalDeltaPct) < 0.05);
    assert.ok(layout.leftPct > 5 && layout.leftPct < 95);
    assert.ok(layout.topPct > 5 && layout.topPct < 95);
    assert.ok(layout.connectorLengthPx >= 48);
  });
});

test("keeps the mirrored left badge offset stable across top and side seats", () => {
  const profile = getDesktopTableLayoutProfile();
  const metrics = getDesktopSeatBadgeMetrics(profile.seat.size);
  const expectedHorizontalDeltaPct =
    (metrics.leftBadgeCenterOffsetXPx / profile.tableReferenceSize.width) * 100;
  const expectedVerticalDeltaPct =
    (metrics.badgeCenterOffsetYPx / profile.tableReferenceSize.height) * 100;

  const topSeat = computeDesktopBetBeaconLayout({
    seatIndex: 0,
    totalSeats: 10,
    geometry: profile.seat.geometry,
    seatSize: profile.seat.size,
    tableWidth: profile.tableReferenceSize.width,
    tableHeight: profile.tableReferenceSize.height,
  });
  const sideSeat = computeDesktopBetBeaconLayout({
    seatIndex: 3,
    totalSeats: 10,
    geometry: profile.seat.geometry,
    seatSize: profile.seat.size,
    tableWidth: profile.tableReferenceSize.width,
    tableHeight: profile.tableReferenceSize.height,
  });

  assert.ok(Math.abs((topSeat.leftPct - (50 + topSeat.seatX)) - expectedHorizontalDeltaPct) < 0.05);
  assert.ok(Math.abs((topSeat.topPct - (50 + topSeat.seatY)) - expectedVerticalDeltaPct) < 0.05);
  assert.ok(Math.abs((sideSeat.leftPct - (50 + sideSeat.seatX)) - expectedHorizontalDeltaPct) < 0.05);
  assert.ok(Math.abs((sideSeat.topPct - (50 + sideSeat.seatY)) - expectedVerticalDeltaPct) < 0.05);
});

test("aims connector and sweep vectors toward the configured pot center", () => {
  const profile = getDesktopTableLayoutProfile();
  const layout = computeDesktopBetBeaconLayout({
    seatIndex: 7,
    totalSeats: 10,
    geometry: profile.seat.geometry,
    seatSize: profile.seat.size,
    tableWidth: profile.tableReferenceSize.width,
    tableHeight: profile.tableReferenceSize.height,
    potLeftPct: 67.2,
    potTopPct: 47.2,
  });

  assert.ok(layout.inwardUnitX > 0);
  assert.ok(layout.inwardUnitY < 0);
  assert.ok(layout.sweepOffsetX > 0);
  assert.ok(layout.sweepOffsetY < 0);
});
