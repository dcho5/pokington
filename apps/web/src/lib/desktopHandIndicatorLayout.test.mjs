import test from "node:test";
import assert from "node:assert/strict";

import { getDesktopHandIndicatorLayout } from "./desktopHandIndicatorLayout.mjs";

test("uses the compact single indicator layout for zero or one visible hand", () => {
  assert.deepEqual(getDesktopHandIndicatorLayout(0), {
    mode: "single",
    minWidth: 136,
  });
  assert.deepEqual(getDesktopHandIndicatorLayout(1), {
    mode: "single",
    minWidth: 136,
  });
});

test("uses a horizontal row for two visible hands", () => {
  assert.deepEqual(getDesktopHandIndicatorLayout(2), {
    mode: "row",
    minWidth: 292,
  });
});

test("uses the fanned layout for three or more visible hands", () => {
  assert.deepEqual(getDesktopHandIndicatorLayout(3), {
    mode: "fan",
    minWidth: 152,
  });
  assert.deepEqual(getDesktopHandIndicatorLayout(4), {
    mode: "fan",
    minWidth: 152,
  });
});
