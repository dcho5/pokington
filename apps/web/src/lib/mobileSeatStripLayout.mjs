export const MOBILE_SEAT_STRIP_HEIGHT_PX = 148;

const STRIP_COLUMN_LEFT_PCTS = [10, 30, 50, 70, 90];
const STRIP_ROW_TOP_PCTS = [24, 68];

const VIEWPORT_COLUMN_X_FRACS = [0.1, 0.3, 0.5, 0.7, 0.9];
const VIEWPORT_ROW_Y_FRACS = [0.13, 0.205];

export const MOBILE_SEAT_STRIP_TOTAL_SEATS = 10;

const CLOCKWISE_GRID_POSITIONS = Object.freeze([
  { row: 0, column: 2 },
  { row: 0, column: 3 },
  { row: 0, column: 4 },
  { row: 1, column: 4 },
  { row: 1, column: 3 },
  { row: 1, column: 2 },
  { row: 1, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: 0 },
  { row: 0, column: 1 },
]);

export const MOBILE_SEAT_STRIP_METRICS = Object.freeze({
  avatarSizePx: 40,
  occupiedFootprintWidthPx: 56,
  occupiedFootprintHeightPx: 54,
  emptyFootprintWidthPx: 54,
  emptyFootprintHeightPx: 54,
  primaryBadgeHeightPx: 14,
  primaryBadgeMaxWidthPx: 58,
  showdownCardWidthPx: 14,
  showdownCardHeightPx: 14,
  showdownPeekWidthPx: 46,
  showdownCardOffsetYPx: 4,
  showdownCardSpreadXPx: 7,
  primaryBadgeOffsetYPx: 16,
  badgeOrbitOffsetPx: -3,
  roleBadgeInsetPx: 1,
  peekBadgeInsetPx: 1,
  cornerBadgeSizePx: 18,
});

export function getMobileSeatStripGridPosition(seatIndex) {
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= MOBILE_SEAT_STRIP_TOTAL_SEATS) {
    return null;
  }

  return CLOCKWISE_GRID_POSITIONS[seatIndex] ?? null;
}

export function getMobileSeatStripSlot(seatIndex) {
  const gridPosition = getMobileSeatStripGridPosition(seatIndex);
  if (!gridPosition) return null;

  return {
    ...gridPosition,
    leftPct: STRIP_COLUMN_LEFT_PCTS[gridPosition.column],
    topPct: STRIP_ROW_TOP_PCTS[gridPosition.row],
    viewportXFrac: VIEWPORT_COLUMN_X_FRACS[gridPosition.column],
    viewportYFrac: VIEWPORT_ROW_Y_FRACS[gridPosition.row],
    occupiedFootprintWidthPx: MOBILE_SEAT_STRIP_METRICS.occupiedFootprintWidthPx,
    occupiedFootprintHeightPx: MOBILE_SEAT_STRIP_METRICS.occupiedFootprintHeightPx,
    emptyFootprintWidthPx: MOBILE_SEAT_STRIP_METRICS.emptyFootprintWidthPx,
    emptyFootprintHeightPx: MOBILE_SEAT_STRIP_METRICS.emptyFootprintHeightPx,
  };
}

export function formatMobileSeatStripAmount(cents = 0) {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) {
    const compact = dollars >= 10000
      ? Math.round(dollars / 1000)
      : Math.round(dollars / 100) / 10;
    return `$${compact}k`;
  }
  if (dollars >= 10) {
    return `$${dollars.toFixed(1)}`;
  }
  return `$${dollars.toFixed(2)}`;
}

const PRIMARY_ACTION_LABELS = Object.freeze({
  fold: "FOLD",
  check: "CHECK",
  call: "CALL",
  raise: "RAISE",
  "all-in": "ALL IN",
});

/**
 * @param {{
 *   currentBet?: number;
 *   lastAction?: string | null;
 *   isAllIn?: boolean;
 *   stack?: number;
 *   isFolded?: boolean;
 * }} [options]
 */
export function resolveMobileSeatStripPrimaryBadge({
  currentBet = 0,
  lastAction = null,
  isAllIn = false,
  stack: _stack = 0,
  isFolded = false,
} = {}) {
  const hasLiveBet = Number(currentBet) > 0 && !isFolded;

  if (hasLiveBet) {
    return {
      kind: "bet",
      label: formatMobileSeatStripAmount(currentBet),
    };
  }

  if (isAllIn) {
    return {
      kind: "all-in",
      label: PRIMARY_ACTION_LABELS["all-in"],
    };
  }

  if (lastAction) {
    return {
      kind: "action",
      label: PRIMARY_ACTION_LABELS[lastAction] ?? String(lastAction).toUpperCase(),
    };
  }

  return null;
}

export function getMobileSeatStripViewportPoint(seatIndex, viewportWidth, viewportHeight) {
  const slot = getMobileSeatStripSlot(seatIndex);
  if (!slot) return null;

  return {
    x: viewportWidth * slot.viewportXFrac,
    y: viewportHeight * slot.viewportYFrac,
  };
}
