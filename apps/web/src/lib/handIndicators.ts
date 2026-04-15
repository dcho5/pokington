import { evaluateBest, type RunResult } from "@pokington/engine";
import type { Card } from "@pokington/shared";

export interface HandIndicator {
  id: string;
  title: string;
  label: string | null;
}

export function evaluateVisibleHandLabel(
  holeCards: readonly Card[] | null | undefined,
  boardCards: readonly Card[] | null | undefined,
): string | null {
  if (!holeCards || holeCards.length !== 2) return null;
  const board = boardCards ?? [];
  const allVisible = [...holeCards, ...board];
  return allVisible.length >= 5 ? evaluateBest(allVisible).label : null;
}

interface BuildViewerHandIndicatorsArgs {
  holeCards: readonly Card[] | null | undefined;
  communityCards: readonly Card[] | null | undefined;
  communityCards2?: readonly Card[] | null | undefined;
  runResults?: RunResult[] | null | undefined;
  animatedRunItShowdown?: boolean;
  currentRun?: number;
  revealedCount?: number;
  knownCardCount?: number;
  isBombPotHand?: boolean;
}

export function buildViewerHandIndicators({
  holeCards,
  communityCards,
  communityCards2,
  runResults,
  animatedRunItShowdown = false,
  currentRun = 0,
  revealedCount = 0,
  knownCardCount = 0,
  isBombPotHand = false,
}: BuildViewerHandIndicatorsArgs): HandIndicator[] {
  if (!holeCards || holeCards.length !== 2) return [];

  if (animatedRunItShowdown && (runResults?.length ?? 0) > 1) {
    return (runResults ?? []).map((run, runIndex) => {
      const visibleCount =
        runIndex < currentRun
          ? run.board.length
          : runIndex === currentRun
            ? Math.min(run.board.length, revealedCount)
            : Math.min(run.board.length, knownCardCount);
      const visibleBoard = run.board.slice(0, visibleCount);
      return {
        id: `run-${runIndex}`,
        title: `Run ${runIndex + 1}`,
        label: evaluateVisibleHandLabel(holeCards, visibleBoard),
      };
    });
  }

  if (isBombPotHand || (communityCards2?.length ?? 0) > 0) {
    const boards = [communityCards ?? [], communityCards2 ?? []];
    return boards.map((board, boardIndex) => ({
      id: `board-${boardIndex}`,
      title: `Board ${boardIndex + 1}`,
      label: evaluateVisibleHandLabel(holeCards, board),
    }));
  }

  return [{
    id: "single",
    title: "Hand",
    label: evaluateVisibleHandLabel(holeCards, communityCards),
  }];
}
