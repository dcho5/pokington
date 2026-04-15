import type { TableGeometry } from "./seatLayout";

export type DesktopBetAnchorSide = "top" | "bottom" | "left" | "right";

export function getDesktopBetAnchorSide(coords: {
  sx: number;
  sy: number;
}): DesktopBetAnchorSide;

export interface DesktopBetBeaconLayout {
  seatX: number;
  seatY: number;
  anchorSide: DesktopBetAnchorSide;
  leftPct: number;
  topPct: number;
  connectorLengthPx: number;
  connectorAngleDeg: number;
  inwardUnitX: number;
  inwardUnitY: number;
  sweepOffsetX: number;
  sweepOffsetY: number;
}

export function computeDesktopBetBeaconLayout(options: {
  seatIndex: number;
  totalSeats: number;
  geometry: TableGeometry;
  seatSize?: number;
  tableWidth?: number;
  tableHeight?: number;
  potLeftPct?: number;
  potTopPct?: number;
}): DesktopBetBeaconLayout;
