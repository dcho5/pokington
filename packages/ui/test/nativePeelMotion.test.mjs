import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NATIVE_TAP_MIN_OPEN_MS,
  NATIVE_TAP_OPEN_MS,
  clampNativePeelProgress,
  getNativeTapOpenDuration,
  mapNativeTapOpenTiming,
  mapNativePairedSecondaryProgress,
  mapNativePeelDragToProgress,
  selectNativePeelTarget,
  shouldCommitNativePeelOpen,
  shouldFireNativePeek,
  shouldForceMountedNativePeelOpen,
  shouldSeedNativePeelOpen,
} from "../dist/lib/nativePeelMotion.js";

test("native peel targeting keeps outer card bodies individual", () => {
  assert.equal(selectNativePeelTarget({ x: 24, cardWidth: 70, gap: 6 }), "card0");
  assert.equal(selectNativePeelTarget({ x: 58, cardWidth: 100, gap: 6 }), "card0");
  assert.equal(selectNativePeelTarget({ x: 96, cardWidth: 70, gap: 6 }), "card1");
  assert.equal(selectNativePeelTarget({ x: 170, cardWidth: 100, gap: 6 }), "card1");
});

test("native peel targeting ignores the center gap for single-touch gestures", () => {
  assert.equal(selectNativePeelTarget({ x: 73, cardWidth: 70, gap: 6 }), "none");
  assert.equal(selectNativePeelTarget({ x: 80, cardWidth: 100, gap: 6 }), "card0");
  assert.equal(selectNativePeelTarget({ x: 124, cardWidth: 100, gap: 6 }), "card1");
});

test("native peel drag maps upward distance into clamped progress", () => {
  assert.equal(clampNativePeelProgress(-1), 0);
  assert.equal(clampNativePeelProgress(2), 1);
  assert.equal(
    Number(mapNativePeelDragToProgress({ startProgress: 0.1, translationY: -43, cardHeight: 100 }).toFixed(2)),
    0.6,
  );
  assert.equal(mapNativePeelDragToProgress({ startProgress: 0.9, translationY: -60, cardHeight: 100 }), 1);
});

test("paired secondary progress trails the primary card", () => {
  assert.equal(mapNativePairedSecondaryProgress(0.05), 0);
  assert.ok(mapNativePairedSecondaryProgress(0.55) < 0.55);
  assert.equal(mapNativePairedSecondaryProgress(1), 1);
});

test("native peel release opens by threshold or decisive upward velocity", () => {
  assert.equal(shouldCommitNativePeelOpen({ progress: 0.35, velocityY: 0 }), true);
  assert.equal(shouldCommitNativePeelOpen({ progress: 0.2, velocityY: -700 }), true);
  assert.equal(shouldCommitNativePeelOpen({ progress: 0.33, velocityY: -200 }), false);
  assert.equal(shouldCommitNativePeelOpen({ progress: 0.2, velocityY: -200 }), false);
});

test("native peek fires once on first positive peel movement", () => {
  assert.equal(shouldFireNativePeek(0, 0.001), true);
  assert.equal(shouldFireNativePeek(0.001, 0.1), false);
  assert.equal(shouldFireNativePeek(0, 0), false);
});

test("native peel can seed initial open state from server peek", () => {
  assert.equal(shouldSeedNativePeelOpen({ isPeeked: true }), true);
  assert.equal(shouldSeedNativePeelOpen({ autoReveal: true }), true);
  assert.equal(shouldSeedNativePeelOpen({ isRevealedToOthers: true }), true);
  assert.equal(shouldSeedNativePeelOpen({}), false);
});

test("native server peek echo does not force-open an already mounted card", () => {
  assert.equal(shouldForceMountedNativePeelOpen({ isPeeked: true }), false);
  assert.equal(shouldForceMountedNativePeelOpen({ autoReveal: true, isPeeked: true }), true);
  assert.equal(shouldForceMountedNativePeelOpen({ isRevealedToOthers: true, isPeeked: true }), true);
});

test("native tap-open duration animates from current progress without snapping", () => {
  assert.equal(getNativeTapOpenDuration(0), NATIVE_TAP_OPEN_MS);
  assert.equal(getNativeTapOpenDuration(1), NATIVE_TAP_MIN_OPEN_MS);
  assert.ok(getNativeTapOpenDuration(0.5) > NATIVE_TAP_MIN_OPEN_MS);
  assert.ok(getNativeTapOpenDuration(0.5) < NATIVE_TAP_OPEN_MS);
});

test("native tap-open timing does not front-load half the reveal", () => {
  assert.equal(mapNativeTapOpenTiming(0), 0);
  assert.equal(mapNativeTapOpenTiming(1), 1);
  assert.ok(mapNativeTapOpenTiming(0.2) < 0.1);
  assert.equal(mapNativeTapOpenTiming(0.5), 0.5);
});
