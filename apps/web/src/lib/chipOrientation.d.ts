import type { TableGeometry } from "./seatLayout";

export interface ChipPoint {
  x: number;
  y: number;
}

export const DEFAULT_CHIP_ANGLE: number;
export const MOBILE_CHIP_POINT: Readonly<ChipPoint>;
export const MOBILE_SELF_POINT: Readonly<ChipPoint>;
export const MOBILE_ROW_Y: Readonly<{
  top: number;
  bottom: number;
}>;
export const MOBILE_COLUMN_X: Readonly<number[]>;

export function computeAngleBetweenPoints(fromPoint: ChipPoint, toPoint: ChipPoint): number;

export function getDesktopChipPoint(options: {
  chipLeftPct: number;
  chipTopPct: number;
  tableWidth: number;
  tableHeight: number;
}): ChipPoint;

export function getDesktopSeatPoint(options: {
  seatIndex: number;
  totalSeats: number;
  geometry: TableGeometry;
  tableWidth: number;
  tableHeight: number;
}): ChipPoint;

export function computeDesktopChipAngle(options: {
  chipLeftPct: number;
  chipTopPct: number;
  seatIndex: number | null | undefined;
  totalSeats: number;
  geometry: TableGeometry;
  tableWidth: number;
  tableHeight: number;
}): number;

export function getMobileSeatPoint(options: {
  seatIndex: number | null | undefined;
  viewerSeatIndex?: number | null;
  totalSeats?: number;
}): ChipPoint | null;

export function computeMobileChipAngle(options: {
  actorSeatIndex: number | null | undefined;
  viewerSeatIndex?: number | null;
  totalSeats?: number;
  chipPoint?: ChipPoint;
}): number;
