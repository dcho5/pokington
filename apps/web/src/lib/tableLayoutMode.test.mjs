import test from "node:test";
import assert from "node:assert/strict";

import { shouldUseMobileTableLayout } from "./tableLayoutMode.mjs";

test("uses the mobile layout for portrait phone-sized viewports", () => {
  assert.equal(
    shouldUseMobileTableLayout({
      width: 390,
      height: 844,
      hasCoarsePointer: true,
      hasNoHover: true,
      maxTouchPoints: 5,
    }),
    true,
  );
});

test("keeps phones on the mobile layout in landscape", () => {
  assert.equal(
    shouldUseMobileTableLayout({
      width: 844,
      height: 390,
      hasCoarsePointer: true,
      hasNoHover: true,
      maxTouchPoints: 5,
    }),
    true,
  );
});

test("keeps large non-touch desktop layouts on desktop", () => {
  assert.equal(
    shouldUseMobileTableLayout({
      width: 1440,
      height: 900,
      hasCoarsePointer: false,
      hasNoHover: false,
      maxTouchPoints: 0,
    }),
    false,
  );
});

test("still allows narrow non-touch windows to use the compact layout", () => {
  assert.equal(
    shouldUseMobileTableLayout({
      width: 700,
      height: 1100,
      hasCoarsePointer: false,
      hasNoHover: false,
      maxTouchPoints: 0,
    }),
    true,
  );
});
