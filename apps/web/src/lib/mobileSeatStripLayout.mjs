const STRIP_COLUMN_LEFT_PCTS = [10, 30, 50, 70, 90];
const STRIP_ROW_TOP_PCTS = [26, 76];

const VIEWPORT_COLUMN_X_FRACS = [0.1, 0.3, 0.5, 0.7, 0.9];
const VIEWPORT_ROW_Y_FRACS = [0.14, 0.24];

export const MOBILE_SEAT_STRIP_TOTAL_SEATS = 10;

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

  return {
    ...gridPosition,
    leftPct: STRIP_COLUMN_LEFT_PCTS[gridPosition.column],
    topPct: STRIP_ROW_TOP_PCTS[gridPosition.row],
    viewportXFrac: VIEWPORT_COLUMN_X_FRACS[gridPosition.column],
    viewportYFrac: VIEWPORT_ROW_Y_FRACS[gridPosition.row],
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
