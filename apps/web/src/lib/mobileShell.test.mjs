import test from "node:test";
import assert from "node:assert/strict";

import {
  MOBILE_OVERLAY_Z,
  MOBILE_SHELL,
  getMobileHeaderHeight,
  getMobileSafeAreaBottom,
  getMobileSafeAreaTop,
  getMobileSheetPaddingBottom,
  getMobileTableContentBottomInset,
  getMobileViewportMaxWidth,
  getMobileWinnerBannerBottom,
} from "./mobileShell.mjs";

test("mobile shell helpers return the shared safe-area expressions", () => {
  assert.equal(getMobileHeaderHeight(), "calc(52px + env(safe-area-inset-top))");
  assert.equal(getMobileSafeAreaTop(12), "calc(env(safe-area-inset-top) + 12px)");
  assert.equal(getMobileSafeAreaBottom(16), "calc(env(safe-area-inset-bottom) + 16px)");
  assert.equal(getMobileSheetPaddingBottom(), "calc(env(safe-area-inset-bottom) + 16px)");
  assert.equal(getMobileTableContentBottomInset(), "calc(env(safe-area-inset-bottom) + 258px)");
  assert.equal(getMobileWinnerBannerBottom(), "calc(env(safe-area-inset-bottom) + 180px)");
});

test("mobile shell helpers preserve the portrait viewport cap", () => {
  assert.equal(
    getMobileViewportMaxWidth(),
    `calc(100dvh * ${MOBILE_SHELL.maxViewportAspectWidth} / ${MOBILE_SHELL.maxViewportAspectHeight})`,
  );
});

test("mobile shell constants keep compact controls touch-safe", () => {
  assert.equal(MOBILE_SHELL.compactControlMinSizePx, 44);
  assert.equal(MOBILE_SHELL.floatingUtilityButtonSizePx, 40);
  assert.equal(MOBILE_SHELL.bottomUtilityRailHeightPx, 48);
  assert.equal(MOBILE_SHELL.handPanelCardHeightPx, 126);
  assert.equal(MOBILE_SHELL.handPanelHeightPx, 134);
  assert.equal(MOBILE_SHELL.actionBarSlotHeightPx, 76);
  assert.equal(MOBILE_SHELL.bottomDockHeightPx, 258);
  assert.equal(MOBILE_SHELL.actionBarInsetPx, 16);
  assert.equal(MOBILE_SHELL.footerStatusLiftPx, 12);
});

test("mobile overlay z-index values keep sheets above floating table overlays", () => {
  assert.ok(MOBILE_OVERLAY_Z.sheet > MOBILE_OVERLAY_Z.sheetScrim);
  assert.ok(MOBILE_OVERLAY_Z.winnerBanner < MOBILE_OVERLAY_Z.runItVote);
  assert.ok(MOBILE_OVERLAY_Z.prioritySheetScrim > MOBILE_OVERLAY_Z.bombPotVote);
  assert.ok(MOBILE_OVERLAY_Z.prioritySheet > MOBILE_OVERLAY_Z.runItVote);
  assert.ok(MOBILE_OVERLAY_Z.prioritySheet > MOBILE_OVERLAY_Z.prioritySheetScrim);
});
