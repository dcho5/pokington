export const MOBILE_SEAT_STRIP_HEIGHT_PX = 148;

const STRIP_COLUMN_LEFT_PCTS = [10, 30, 50, 70, 90];
const STRIP_ROW_TOP_PCTS = [24, 68];

const VIEWPORT_COLUMN_X_FRACS = [0.1, 0.3, 0.5, 0.7, 0.9];
const VIEWPORT_ROW_Y_FRACS = [0.13, 0.205];

export const MOBILE_SEAT_STRIP_TOTAL_SEATS = 10;

export const MOBILE_SEAT_STRIP_METRICS = Object.freeze({
  avatarSizePx: 40,
  railGapPx: 6,
  railMaxWidthPx: 56,
  occupiedFootprintWidthPx: 102,
  occupiedFootprintHeightPx: 58,
  emptyFootprintWidthPx: 54,
  showdownCardWidthPx: 20,
  showdownCardHeightPx: 28,
  showdownPeekWidthPx: 58,
  metadataLineHeightPx: 14,
});

const AVATAR_RADIUS_PX = MOBILE_SEAT_STRIP_METRICS.avatarSizePx / 2;

/**
 * @param {number} row
 * @param {number} column
 * @returns {"left" | "right"}
 */
function getRailDirection(row, column) {
  if (column <= 1) return "right";
  if (column >= 3) return "left";
  return row === 0 ? "right" : "left";
}

export function getMobileSeatStripGridPosition(seatIndex) {
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= MOBILE_SEAT_STRIP_TOTAL_SEATS) {
    return null;
  }

  return {
    row: Math.floor(seatIndex / 5),
    column: seatIndex % 5,
  };
}

export function getMobileSeatStripSlot(seatIndex) {
  const gridPosition = getMobileSeatStripGridPosition(seatIndex);
  if (!gridPosition) return null;

  const railDirection = getRailDirection(gridPosition.row, gridPosition.column);
  const railAlign = railDirection === "right" ? "start" : "end";
  const avatarAnchorX = railDirection === "right"
    ? AVATAR_RADIUS_PX
    : MOBILE_SEAT_STRIP_METRICS.occupiedFootprintWidthPx - AVATAR_RADIUS_PX;

  return {
    ...gridPosition,
    leftPct: STRIP_COLUMN_LEFT_PCTS[gridPosition.column],
    topPct: STRIP_ROW_TOP_PCTS[gridPosition.row],
    viewportXFrac: VIEWPORT_COLUMN_X_FRACS[gridPosition.column],
    viewportYFrac: VIEWPORT_ROW_Y_FRACS[gridPosition.row],
    railDirection,
    railAlign,
    avatarAnchorX,
    avatarAnchorY: MOBILE_SEAT_STRIP_METRICS.occupiedFootprintHeightPx / 2,
    railInsetPx: railDirection === "right"
      ? MOBILE_SEAT_STRIP_METRICS.avatarSizePx + MOBILE_SEAT_STRIP_METRICS.railGapPx
      : 0,
    railWidthPx: MOBILE_SEAT_STRIP_METRICS.railMaxWidthPx,
    occupiedFootprintWidthPx: MOBILE_SEAT_STRIP_METRICS.occupiedFootprintWidthPx,
    occupiedFootprintHeightPx: MOBILE_SEAT_STRIP_METRICS.occupiedFootprintHeightPx,
    emptyFootprintWidthPx: MOBILE_SEAT_STRIP_METRICS.emptyFootprintWidthPx,
    crowdedPriority: Object.freeze(["name", "betOrAction", "stack"]),
  };
}

/**
 * @param {{
 *   currentBet?: number;
 *   lastAction?: string | null;
 *   isFolded?: boolean;
 * }} [options]
 */
export function resolveMobileSeatStripRailContent({
  currentBet = 0,
  lastAction = null,
  isFolded = false,
} = {}) {
  const hasLiveBet = Number(currentBet) > 0 && !isFolded;

  if (hasLiveBet) {
    return {
      primary: "bet",
      secondary: "stack",
    };
  }

  if (lastAction) {
    return {
      primary: "action",
      secondary: "stack",
    };
  }

  return {
    primary: "stack",
    secondary: null,
  };
}

export function getMobileSeatStripViewportPoint(seatIndex, viewportWidth, viewportHeight) {
  const slot = getMobileSeatStripSlot(seatIndex);
  if (!slot) return null;

  return {
    x: viewportWidth * slot.viewportXFrac,
    y: viewportHeight * slot.viewportYFrac,
  };
}
