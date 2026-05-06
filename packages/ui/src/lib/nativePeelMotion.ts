export type NativePeelTarget = "none" | "card0" | "card1" | "pair";

export const NATIVE_OPEN_RELEASE_THRESHOLD = 0.34;
export const NATIVE_FAST_UPWARD_VELOCITY = 640;
export const NATIVE_PAIRED_SECONDARY_LAG = 0.1;
export const NATIVE_TAP_OPEN_MS = 520;
export const NATIVE_TAP_MIN_OPEN_MS = 260;

interface NativePeelGeometry {
  x: number;
  cardWidth: number;
  gap: number;
  card0CanPeel?: boolean;
  card1CanPeel?: boolean;
}

interface NativePeelRevealState {
  autoReveal?: boolean;
  isRevealedToOthers?: boolean;
  isPeeked?: boolean;
}

export function clampNativePeelProgress(progress: number): number {
  "worklet";
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

export function selectNativePeelTarget({
  x,
  cardWidth,
  gap,
  card0CanPeel = true,
  card1CanPeel = true,
}: NativePeelGeometry): NativePeelTarget {
  "worklet";
  if (cardWidth <= 0 || gap < 0) return "none";
  const card0End = cardWidth;
  const gapEnd = cardWidth + gap;
  const card1End = cardWidth * 2 + gap;

  if (x >= 0 && x <= card0End) return card0CanPeel ? "card0" : "none";
  if (x > card0End && x < gapEnd) return "none";
  if (x >= gapEnd && x <= card1End) return card1CanPeel ? "card1" : "none";
  return "none";
}

export function mapNativePeelDragToProgress({
  startProgress,
  translationY,
  cardHeight,
}: {
  startProgress: number;
  translationY: number;
  cardHeight: number;
}): number {
  "worklet";
  if (cardHeight <= 0) return clampNativePeelProgress(startProgress);
  const upwardDistance = -translationY;
  return clampNativePeelProgress(startProgress + upwardDistance / (cardHeight * 0.86));
}

export function mapNativePairedSecondaryProgress(primaryProgress: number): number {
  "worklet";
  const usableRange = 1 - NATIVE_PAIRED_SECONDARY_LAG;
  return clampNativePeelProgress((primaryProgress - NATIVE_PAIRED_SECONDARY_LAG) / usableRange);
}

export function shouldSeedNativePeelOpen({
  autoReveal,
  isRevealedToOthers,
  isPeeked,
}: NativePeelRevealState): boolean {
  return Boolean(autoReveal || isRevealedToOthers || isPeeked);
}

export function shouldForceMountedNativePeelOpen({
  autoReveal,
  isRevealedToOthers,
}: NativePeelRevealState): boolean {
  return Boolean(autoReveal || isRevealedToOthers);
}

export function getNativeTapOpenDuration(startProgress: number): number {
  "worklet";
  const remaining = 1 - clampNativePeelProgress(startProgress);
  return Math.round(NATIVE_TAP_MIN_OPEN_MS + (NATIVE_TAP_OPEN_MS - NATIVE_TAP_MIN_OPEN_MS) * remaining);
}

export function mapNativeTapOpenTiming(time: number): number {
  "worklet";
  const t = clampNativePeelProgress(time);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function shouldCommitNativePeelOpen({
  progress,
  velocityY,
}: {
  progress: number;
  velocityY: number;
}): boolean {
  "worklet";
  return progress >= NATIVE_OPEN_RELEASE_THRESHOLD || velocityY <= -NATIVE_FAST_UPWARD_VELOCITY;
}

export function shouldFireNativePeek(previous: number, current: number): boolean {
  "worklet";
  return clampNativePeelProgress(previous) <= 0 && clampNativePeelProgress(current) > 0;
}
