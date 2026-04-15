function round(value) {
  return Math.round(value * 1000) / 1000;
}

export function getDesktopSeatBadgeMetrics(seatSize = 150) {
  const cardWidth = Math.round(seatSize * 0.68);
  const cardHeight = Math.round(cardWidth * 1.4);
  const overlap = Math.round(cardWidth * 0.38);
  const clusterWidth = cardWidth * 2 - overlap;
  const clusterHeight = cardHeight + Math.round(seatSize * 0.18);
  const stackFontSize = seatSize >= 146 ? 20 : seatSize >= 136 ? 19 : 18;
  const badgeFontSize = seatSize >= 146 ? 10 : 9;
  const outerWidth = clusterWidth + 38;

  const statusBadgeRightPx = 6;
  const statusBadgeBottomPx = Math.round(stackFontSize + 40);
  const statusBadgeReferenceWidthPx = Math.round(
    Math.max(52, Math.min(72, seatSize * 0.42)),
  );
  const statusBadgeHeightPx = badgeFontSize + 10;
  const stackPanelHeightPx = stackFontSize + 28;
  const seatFrameHeightPx = clusterHeight + 16 + stackPanelHeightPx;

  const mirroredBadgeCenterOffsetXPx =
    (outerWidth / 2) - statusBadgeRightPx - (statusBadgeReferenceWidthPx / 2);
  const badgeCenterOffsetYPx =
    (seatFrameHeightPx / 2) - statusBadgeBottomPx - (statusBadgeHeightPx / 2);

  return {
    outerWidth,
    clusterWidth,
    clusterHeight,
    stackFontSize,
    badgeFontSize,
    statusBadgeRightPx,
    statusBadgeBottomPx,
    statusBadgeReferenceWidthPx,
    statusBadgeHeightPx,
    stackPanelHeightPx,
    seatFrameHeightPx,
    statusBadgeCenterOffsetXPx: round(mirroredBadgeCenterOffsetXPx),
    badgeCenterOffsetYPx: round(badgeCenterOffsetYPx),
    leftBadgeCenterOffsetXPx: round(-mirroredBadgeCenterOffsetXPx),
    rightBadgeCenterOffsetXPx: round(mirroredBadgeCenterOffsetXPx),
  };
}
