export const MOBILE_SHELL = Object.freeze({
  headerBarHeightPx: 52,
  maxViewportAspectWidth: 10,
  maxViewportAspectHeight: 16,
  compactControlMinSizePx: 44,
  floatingUtilityButtonSizePx: 40,
  actionBarInsetPx: 16,
  actionBarInsetTopPx: 10,
  actionBarInsetBottomPx: 10,
  footerStatusLiftPx: 12,
  defaultSheetInsetBottomPx: 16,
  raisedSheetInsetBottomPx: 20,
  wideSheetInsetBottomPx: 22,
  sheetDismissOffsetPx: 80,
  winnerBannerBottomPx: 180,
});

export const MOBILE_OVERLAY_Z = Object.freeze({
  sheetScrim: 40,
  sheet: 50,
  winnerBanner: 160,
  sevenTwoAnnouncement: 170,
  runAnnouncement: 175,
  bombPotAnnouncement: 178,
  actionError: 179,
  bombPotVote: 180,
  runItVote: 185,
  prioritySheetScrim: 190,
  prioritySheet: 195,
});

export function getMobileViewportMaxWidth() {
  return `calc(100dvh * ${MOBILE_SHELL.maxViewportAspectWidth} / ${MOBILE_SHELL.maxViewportAspectHeight})`;
}

export function getMobileHeaderHeight() {
  return `calc(${MOBILE_SHELL.headerBarHeightPx}px + env(safe-area-inset-top))`;
}

export function getMobileSafeAreaTop(extraPx = 0) {
  return `calc(env(safe-area-inset-top) + ${extraPx}px)`;
}

/**
 * @param {number} [extraPx=0]
 */
export function getMobileSafeAreaBottom(extraPx = 0) {
  return `calc(env(safe-area-inset-bottom) + ${extraPx}px)`;
}

/**
 * @param {number | undefined} [extraPx]
 */
export function getMobileSheetPaddingBottom(extraPx) {
  return getMobileSafeAreaBottom(extraPx ?? MOBILE_SHELL.defaultSheetInsetBottomPx);
}

export function getMobileWinnerBannerBottom() {
  return getMobileSafeAreaBottom(MOBILE_SHELL.winnerBannerBottomPx);
}
