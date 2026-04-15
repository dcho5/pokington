const MOBILE_TOUCH_MAX_SHORTEST_SIDE = 1024;
const MOBILE_TOUCH_MAX_LONGEST_SIDE = 1366;
const PORTRAIT_LAYOUT_RATIO = 3 / 4;

export function shouldUseMobileTableLayout({
  width,
  height,
  hasCoarsePointer,
  hasNoHover,
  maxTouchPoints,
}) {
  if (width <= 0 || height <= 0) return false;

  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const touchLike = hasCoarsePointer || hasNoHover || maxTouchPoints > 0;

  if (touchLike) {
    return (
      shortestSide <= MOBILE_TOUCH_MAX_SHORTEST_SIDE &&
      longestSide <= MOBILE_TOUCH_MAX_LONGEST_SIDE
    );
  }

  return width / height < PORTRAIT_LAYOUT_RATIO;
}
