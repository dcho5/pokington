import test from "node:test";
import assert from "node:assert/strict";

import {
  MOBILE_OVERLAY_Z,
  MOBILE_SHELL,
  getMobileHeaderHeight,
  getMobileSafeAreaBottom,
  getMobileSafeAreaTop,
  getMobileSheetPaddingBottom,
  getMobileViewportMaxWidth,
  getMobileWinnerBannerBottom,
} from "./mobileShell.mjs";

test("mobile shell helpers return the shared safe-area expressions", () => {
  assert.equal(getMobileHeaderHeight(), "calc(52px + env(safe-area-inset-top))");
  assert.equal(getMobileSafeAreaTop(12), "calc(env(safe-area-inset-top) + 12px)");
  assert.equal(getMobileSafeAreaBottom(16), "calc(env(safe-area-inset-bottom) + 16px)");
  assert.equal(getMobileSheetPaddingBottom(), "calc(env(safe-area-inset-bottom) + 16px)");
  assert.equal(getMobileWinnerBannerBottom(), "calc(env(safe-area-inset-bottom) + 180px)");
});

test("mobile shell helpers preserve the portrait viewport cap", () => {
  assert.equal(
    getMobileViewportMaxWidth(),
    `calc(100dvh * ${MOBILE_SHELL.maxViewportAspectWidth} / ${MOBILE_SHELL.maxViewportAspectHeight})`,
  );
});

test("mobile overlay z-index values keep sheets above floating table overlays", () => {
  assert.ok(MOBILE_OVERLAY_Z.sheet > MOBILE_OVERLAY_Z.sheetScrim);
  assert.ok(MOBILE_OVERLAY_Z.winnerBanner < MOBILE_OVERLAY_Z.runItVote);
  assert.ok(MOBILE_OVERLAY_Z.prioritySheet > MOBILE_OVERLAY_Z.runItVote);
});
