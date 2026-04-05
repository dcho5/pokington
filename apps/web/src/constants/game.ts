/** Blind level cent values corresponding 1-to-1 with BLIND_OPTIONS. */
export const BLIND_CENTS: Array<{ small: number; big: number }> = [
  { small: 10, big: 25 },
  { small: 25, big: 50 },
  { small: 50, big: 100 },
  { small: 100, big: 200 },
];

/** Blind level options shown on the home / create-table UI. */
export const BLIND_OPTIONS = [
  "10¢ / 25¢",
  "25¢ / 50¢",
  "50¢ / $1",
  "$1 / $2",
] as const;

/** 7-2 offsuit bounty multiplier options. */
export const BOUNTY_OPTIONS = [
  "Off",
  "1x BB",
  "2x BB",
  "3x BB",
  "4x BB",
  "5x BB",
] as const;

/**
 * Returns the three standard buy-in preset amounts (in dollars)
 * for a given big-blind size in cents.
 */
export function getBuyInPresets(bigBlindCents: number) {
  const bb = bigBlindCents / 100;
  return [
    { label: "50×",  dollars: bb * 50  },
    { label: "100×", dollars: bb * 100 },
    { label: "200×", dollars: bb * 200 },
  ];
}
