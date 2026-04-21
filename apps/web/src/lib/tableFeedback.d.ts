import type { WinnerInfo } from "@pokington/engine";
import type { TableVisualFeedbackEvent } from "./feedbackPlatform";

export interface WinnerChipMotion {
  winner: WinnerInfo;
  delaySeconds: number;
  chipKey: string;
  runIndex: number;
  tier: number;
}

export type WinnerChipLandingEvent = TableVisualFeedbackEvent & { delayMs: number };

export function collectBoardRevealEvents(options?: {
  previousCounts?: number[];
  nextCounts?: number[];
  handNumber?: number;
  mode?: "single" | "bombPot" | "runIt";
}): TableVisualFeedbackEvent[];

export function buildWinnerChipFeedbackPlan(options?: {
  winners?: WinnerInfo[];
  runResults?: Array<{ winners?: WinnerInfo[] }>;
  handNumber?: number;
  knownCardCount?: number;
  revealRunsConcurrently?: boolean;
}): WinnerChipMotion[];

export function buildWinnerChipLandingEvents(options?: {
  winners?: WinnerInfo[];
  runResults?: Array<{ winners?: WinnerInfo[] }>;
  handNumber?: number;
  knownCardCount?: number;
  revealRunsConcurrently?: boolean;
}): WinnerChipLandingEvent[];

export function markFeedbackKey(seenKeys: Set<string>, key: string, maxEntries?: number): boolean;
