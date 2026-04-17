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

function getBetBadgeMetrics(seatSize = 150) {
  const cardWidth = Math.round(seatSize * 0.68);
  const cardHeight = Math.round(cardWidth * 1.4);
  const overlap = Math.round(cardWidth * 0.38);
  const clusterWidth = cardWidth * 2 - overlap;
  const clusterHeight = cardHeight + Math.round(seatSize * 0.18);
  const stackFontSize = seatSize >= 146 ? 20 : seatSize >= 136 ? 19 : 18;
  const badgeFontSize = seatSize >= 146 ? 10 : 9;
  const outerWidth = clusterWidth + 38;
  const stackPanelHeightPx = stackFontSize + 28;
  const seatFrameHeightPx = clusterHeight + 16 + stackPanelHeightPx;

  const betBadgeMarginPx = 10;
  const betBadgeHeightPx = badgeFontSize + 10;
  const betBadgeBottomPx = Math.round(stackFontSize + 40 + betBadgeHeightPx + 8);
  const betBadgeReferenceWidthPx = Math.round(Math.max(52, Math.min(72, seatSize * 0.42)));

  const betBadgeCenterOffsetXPx = -((outerWidth / 2) - betBadgeMarginPx - (betBadgeReferenceWidthPx / 2));
  const betBadgeCenterOffsetYPx = (seatFrameHeightPx / 2) - betBadgeBottomPx - (betBadgeHeightPx / 2);

  return {
    betBadgeCenterOffsetXPx: Math.round(betBadgeCenterOffsetXPx * 1000) / 1000,
    betBadgeCenterOffsetYPx: Math.round(betBadgeCenterOffsetYPx * 1000) / 1000,
    betBadgeReferenceWidthPx,
    betBadgeHeightPx,
  };
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
    betBadgeCenterOffsetXPx,
    betBadgeCenterOffsetYPx,
    betBadgeReferenceWidthPx,
    betBadgeHeightPx,
  } = getBetBadgeMetrics(seatSize);
  const anchorSide = getDesktopBetAnchorSide();

  const beaconX = sx + ((betBadgeCenterOffsetXPx - 36) / tableWidth) * 100;
  const beaconY = sy + ((betBadgeCenterOffsetYPx + 6) / tableHeight) * 100;

  const horizontalMarginPct = (((betBadgeReferenceWidthPx / 2) + 4) / tableWidth) * 100;
  const verticalMarginPct = (((betBadgeHeightPx / 2) + 32) / tableHeight) * 100;
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
