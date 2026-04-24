import type { TableVisualFeedbackEvent } from "./feedbackPlatform";

export function collectBoardRevealEvents(options?: {
  previousCounts?: number[];
  nextCounts?: number[];
  handNumber?: number;
  mode?: "single" | "bombPot" | "runIt";
}): TableVisualFeedbackEvent[];

export function markFeedbackKey(seenKeys: Set<string>, key: string, maxEntries?: number): boolean;
