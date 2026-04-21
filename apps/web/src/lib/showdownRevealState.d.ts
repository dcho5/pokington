import type { RunResult } from "@pokington/engine";

export function getTimedVisibleRunCounts(options?: {
  knownCardCount?: number;
  runCount?: number;
  runDealStartedAt?: number | null;
  now?: number;
  revealRunsConcurrently?: boolean;
}): number[];

export function getNextTimedRevealAt(options?: {
  knownCardCount?: number;
  runCount?: number;
  runDealStartedAt?: number | null;
  now?: number;
  revealRunsConcurrently?: boolean;
}): number | null;

export function isTimedShowdownRevealComplete(options?: {
  knownCardCount?: number;
  runCount?: number;
  runDealStartedAt?: number | null;
  now?: number;
  revealRunsConcurrently?: boolean;
}): boolean;

export function getObservedVisibleRunCounts(
  runResults?: RunResult[],
  knownCardCount?: number,
  totalRuns?: number,
): number[];

export function deriveObservedRunState(
  runResults?: RunResult[],
  knownCardCount?: number,
  totalRuns?: number,
): { currentRun: number; revealedCount: number };

export function isObservedShowdownRevealComplete(
  runResults?: RunResult[],
  knownCardCount?: number,
  totalRuns?: number,
): boolean;
