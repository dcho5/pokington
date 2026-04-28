import { getMobileSeatStripSlot } from "./mobileSeatStripLayout.mjs";

const DEG_PER_RAD = 180 / Math.PI;
const CHIP_HIGHLIGHT_BASE_ANGLE = Math.atan2(35 - 50, 62 - 50) * DEG_PER_RAD;

export const DEFAULT_CHIP_ANGLE = -90 - CHIP_HIGHLIGHT_BASE_ANGLE;

export const MOBILE_CHIP_POINT = Object.freeze({ x: 0.5, y: 0.66 });
export const MOBILE_SELF_POINT = Object.freeze({ x: 0.5, y: 0.88 });
export const MOBILE_ROW_Y = Object.freeze({
  top: 0.14,
  bottom: 0.29,
});
export const MOBILE_COLUMN_X = Object.freeze([0.1, 0.3, 0.5, 0.7, 0.9]);

function computeSeatPoint(seatIndex, totalSeats, geometry) {
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
    y = -ah + (t * geometry.ar);
  } else if ((t -= 2 * ahW) <= 2 * aw) {
    x = aw - t;
    y = ah;
  } else if ((t -= 2 * aw) <= 2 * ahW) {
    x = -aw;
    y = ah - (t * geometry.ar);
  } else {
    t -= 2 * ahW;
    x = -aw + t;
    y = -ah;
  }

  return { x, y };
}

export function computeAngleBetweenPoints(fromPoint, toPoint) {
  return Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x) * DEG_PER_RAD;
}

function computeChipFacingAngle(fromPoint, toPoint) {
  return computeAngleBetweenPoints(fromPoint, toPoint) - CHIP_HIGHLIGHT_BASE_ANGLE;
}

export function getDesktopChipPoint({
  chipLeftPct,
  chipTopPct,
  tableWidth,
  tableHeight,
}) {
  return {
    x: (tableWidth * chipLeftPct) / 100,
    y: (tableHeight * chipTopPct) / 100,
  };
}

export function getDesktopSeatPoint({
  seatIndex,
  totalSeats,
  geometry,
  tableWidth,
  tableHeight,
}) {
  const { x, y } = computeSeatPoint(seatIndex, totalSeats, geometry);
  return {
    x: (tableWidth * (50 + x)) / 100,
    y: (tableHeight * (50 + y)) / 100,
  };
}

export function computeDesktopChipAngle({
  chipLeftPct,
  chipTopPct,
  seatIndex,
  totalSeats,
  geometry,
  tableWidth,
  tableHeight,
}) {
  if (seatIndex == null || seatIndex < 0) {
    return DEFAULT_CHIP_ANGLE;
  }

  return computeAngleBetweenPoints(
    getDesktopChipPoint({
      chipLeftPct,
      chipTopPct,
      tableWidth,
      tableHeight,
    }),
    getDesktopSeatPoint({
      seatIndex,
      totalSeats,
      geometry,
      tableWidth,
      tableHeight,
    }),
  ) - CHIP_HIGHLIGHT_BASE_ANGLE;
}

export function getMobileSeatPoint({
  seatIndex,
  viewerSeatIndex = null,
  totalSeats = 10,
}) {
  if (seatIndex == null || seatIndex < 0 || seatIndex >= totalSeats) {
    return null;
  }

  if (viewerSeatIndex != null && seatIndex === viewerSeatIndex) {
    return MOBILE_SELF_POINT;
  }

  const slot = getMobileSeatStripSlot(seatIndex);
  if (!slot) return null;

  return {
    x: slot.viewportXFrac,
    y: slot.viewportYFrac,
  };
}

export function computeMobileChipAngle({
  actorSeatIndex,
  viewerSeatIndex = null,
  totalSeats = 10,
  chipPoint = MOBILE_CHIP_POINT,
}) {
  const actorPoint = getMobileSeatPoint({
    seatIndex: actorSeatIndex,
    viewerSeatIndex,
    totalSeats,
  });

  if (!actorPoint) {
    return DEFAULT_CHIP_ANGLE;
  }

  return computeChipFacingAngle(chipPoint, actorPoint);
}
