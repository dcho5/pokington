export function getDesktopHandIndicatorLayout(indicatorCount = 0) {
  const count = Number.isFinite(indicatorCount)
    ? Math.max(0, Math.floor(indicatorCount))
    : 0;

  if (count >= 3) {
    return {
      mode: "fan",
      minWidth: 152,
    };
  }

  if (count === 2) {
    return {
      mode: "row",
      minWidth: 292,
    };
  }

  return {
    mode: "single",
    minWidth: 136,
  };
}
