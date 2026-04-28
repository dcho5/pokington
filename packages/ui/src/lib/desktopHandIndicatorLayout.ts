export function getDesktopHandIndicatorLayout(indicatorCount = 0) {
  const count = Number.isFinite(indicatorCount)
    ? Math.max(0, Math.floor(indicatorCount))
    : 0;

  if (count >= 3) {
    return {
      mode: "fan" as const,
      minWidth: 152,
    };
  }

  if (count === 2) {
    return {
      mode: "row" as const,
      minWidth: 292,
    };
  }

  return {
    mode: "single" as const,
    minWidth: 136,
  };
}
