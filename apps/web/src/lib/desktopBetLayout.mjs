import { getDesktopSeatBadgeMetrics } from "./desktopSeatBadgeLayout.mjs";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function seatCoords(seatIndex, totalSeats, geometry) {
  const aw = geometry.feltX + geometry.seatPadX;
  const ah = geometry.feltY + geometry.seatPadY;
  const ahW = ah / geometry.ar;
  const perimeter = 4 * aw + 4 * ahW;
  const spacing = perimeter / totalSeats;

  let t = seatIndex * spacing;
  let x = 0;
  let y = 0;

  if (t <= aw) {
    x = t;
    y = -ah;
  } else if ((t -= aw) <= 2 * ahW) {
    x = aw;
    y = -ah + t * geometry.ar;
  } else if ((t -= 2 * ahW) <= 2 * aw) {
    x = aw - t;
    y = ah;
  } else if ((t -= 2 * aw) <= 2 * ahW) {
    x = -aw;
    y = ah - t * geometry.ar;
  } else {
    t -= 2 * ahW;
    x = -aw + t;
    y = -ah;
  }

  return { x, y };
}

export function getDesktopBetAnchorSide() {
  return "left";
}

export function computeDesktopBetBeaconLayout({
  seatIndex,
  totalSeats,
  geometry,
  seatSize = 150,
  tableWidth = 2355.2,
  tableHeight = tableWidth / geometry.ar,
  potLeftPct = 50,
  potTopPct = 50,
}) {
  const { x: sx, y: sy } = seatCoords(seatIndex, totalSeats, geometry);
  const {
    leftBadgeCenterOffsetXPx,
    badgeCenterOffsetYPx,
    statusBadgeReferenceWidthPx,
    statusBadgeHeightPx,
  } = getDesktopSeatBadgeMetrics(seatSize);
  const anchorSide = getDesktopBetAnchorSide();

  const beaconX = sx + (leftBadgeCenterOffsetXPx / tableWidth) * 100;
  const beaconY = sy + (badgeCenterOffsetYPx / tableHeight) * 100;

  const horizontalMarginPct = (((statusBadgeReferenceWidthPx / 2) + 72) / tableWidth) * 100;
  const verticalMarginPct = (((statusBadgeHeightPx / 2) + 32) / tableHeight) * 100;
  const leftPct = clamp(50 + beaconX, horizontalMarginPct, 100 - horizontalMarginPct);
  const topPct = clamp(50 + beaconY, verticalMarginPct, 100 - verticalMarginPct);

  const beaconPxX = (leftPct / 100) * tableWidth;
  const beaconPxY = (topPct / 100) * tableHeight;
  const potPxX = (potLeftPct / 100) * tableWidth;
  const potPxY = (potTopPct / 100) * tableHeight;
  const deltaX = potPxX - beaconPxX;
  const deltaY = potPxY - beaconPxY;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const inwardUnitX = deltaX / distance;
  const inwardUnitY = deltaY / distance;

  return {
    seatX: sx,
    seatY: sy,
    anchorSide,
    leftPct,
    topPct,
    connectorLengthPx: clamp(distance * 0.16, 48, 86),
    connectorAngleDeg: Math.atan2(deltaY, deltaX) * (180 / Math.PI),
    inwardUnitX,
    inwardUnitY,
    sweepOffsetX: deltaX,
    sweepOffsetY: deltaY,
  };
}
