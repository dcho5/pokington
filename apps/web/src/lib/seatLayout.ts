import type { CSSProperties } from 'react';

export interface TableGeometry {
  feltX: number;
  feltY: number;
  seatPadX: number;
  seatPadY: number;
  ar: number;
}

export const LANDSCAPE: TableGeometry = {
  feltX: 38,
  feltY: 30,
  seatPadX: 8,
  seatPadY: 14,
  ar: 2.1,
};

export const PORTRAIT: TableGeometry = {
  feltX: 35,
  feltY: 38,
  seatPadX: 10,
  seatPadY: 12,
  ar: 0.6,
};

function seatCoords(seatIndex: number, totalSeats: number, g: TableGeometry): { x: number; y: number } {
  const aw = g.feltX + g.seatPadX;
  const ah = g.feltY + g.seatPadY;

  // Convert height into width-relative units for perimeter math
  const ahW = ah / g.ar;
  const perimeter = 4 * aw + 4 * ahW;
  const spacing = perimeter / totalSeats;

  let t = seatIndex * spacing;
  let x = 0, y = 0;

  if (t <= aw) {
    // 1. Top edge, right half
    x = t;
    y = -ah;
  } else if ((t -= aw) <= 2 * ahW) {
    // 2. Right side
    x = aw;
    y = -ah + (t * g.ar);
  } else if ((t -= 2 * ahW) <= 2 * aw) {
    // 3. Bottom edge
    x = aw - t;
    y = ah;
  } else if ((t -= 2 * aw) <= 2 * ahW) {
    // 4. Left side
    x = -aw;
    y = ah - (t * g.ar);
  } else {
    // 5. Top edge, left half
    t -= 2 * ahW;
    x = -aw + t;
    y = -ah;
  }

  return { x, y };
}

export function computeSeatPosition(seatIndex: number, totalSeats: number, g: TableGeometry): CSSProperties {
  const { x, y } = seatCoords(seatIndex, totalSeats, g);
  return {
    left: `calc(50% + ${x.toFixed(3)}%)`,
    top: `calc(50% + ${y.toFixed(3)}%)`,
    transform: 'translate(-50%, -50%)',
  };
}

export function computeSeatCoords(seatIndex: number, totalSeats: number, g: TableGeometry): { x: number; y: number } {
  return seatCoords(seatIndex, totalSeats, g);
}
