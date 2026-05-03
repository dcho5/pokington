import React, { useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { NativeCard } from "@pokington/ui/native";
import type { Card as CardType } from "@pokington/shared";
import type { RunResult } from "@pokington/engine";
import { hasAnimatedRunout } from "@pokington/engine";

// ── Board mode helpers (mirrors apps/web/src/lib/tableVisualState.mjs) ─────────

type BoardMode = "single" | "bombPot" | "runIt";
type Emphasis = "neutral" | "highlighted" | "dimmed";

function shouldRenderRunItBoard({
  phase,
  isRunItBoard,
  isBombPotHand,
  runDealStartedAt,
  runAnnouncement,
}: {
  phase?: string;
  isRunItBoard: boolean;
  isBombPotHand: boolean;
  runDealStartedAt: number | null;
  runAnnouncement: 1 | 2 | 3 | null;
}) {
  return (
    phase === "showdown" &&
    isRunItBoard &&
    !isBombPotHand &&
    runDealStartedAt != null &&
    runAnnouncement == null
  );
}

function getCenterBoardMode({
  phase,
  isBombPotHand,
  isRunItBoard,
  runDealStartedAt,
  runAnnouncement,
  runResults,
}: {
  phase?: string;
  isBombPotHand: boolean;
  isRunItBoard: boolean;
  runDealStartedAt: number | null;
  runAnnouncement: 1 | 2 | 3 | null;
  runResults: RunResult[];
}): BoardMode {
  const isRunItSequence =
    phase === "showdown" && isRunItBoard && !isBombPotHand && runResults.length > 0;

  if (
    isRunItSequence &&
    shouldRenderRunItBoard({
      phase,
      isRunItBoard,
      isBombPotHand,
      runDealStartedAt,
      runAnnouncement,
    }) &&
    runResults.length > 0
  ) {
    return "runIt";
  }

  if (isBombPotHand) return "bombPot";
  return "single";
}

function isRunItAnnouncementPhase({
  phase,
  isRunItBoard,
  isBombPotHand,
  runAnnouncement,
  runResults,
}: {
  phase?: string;
  isRunItBoard: boolean;
  isBombPotHand: boolean;
  runAnnouncement: 1 | 2 | 3 | null;
  runResults: RunResult[];
}) {
  return (
    runAnnouncement != null &&
    phase === "showdown" &&
    isRunItBoard &&
    !isBombPotHand &&
    runResults.length > 0
  );
}

// ── Run animation helper (mirrors packages/ui/src/lib/runAnimation.ts) ─────────

const CARD_COUNT = 5;

function clampCardCount(n: number | null | undefined) {
  return Math.max(0, Math.min(CARD_COUNT, n ?? 0));
}

function deriveVisibleRunState(
  runResults: RunResult[],
  knownCardCount: number,
): { currentRun: number; revealedCount: number } {
  if (runResults.length === 0) return { currentRun: 0, revealedCount: knownCardCount };
  const clamped = clampCardCount(knownCardCount);
  const counts = runResults.map((r) => clampCardCount(r.board?.length));
  const activeRun = counts.reduce<number>(
    (cur, count, i) => (count > clamped ? i : cur),
    -1,
  );
  const currentRun = activeRun === -1 ? 0 : activeRun;
  return { currentRun, revealedCount: counts[currentRun] ?? clamped };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Invisible placeholder that holds the same space as a compact NativeCard. */
function CardPlaceholder() {
  return <View style={cardStyles.placeholder} />;
}

/** Board tab strip shared by bomb-pot and run-it modes. */
function TabStrip({
  labels,
  activeIndex,
  onPress,
}: {
  labels: string[];
  activeIndex: number;
  onPress: (i: number) => void;
}) {
  return (
    <View style={tabStyles.strip}>
      {labels.map((label, i) => {
        const isActive = i === activeIndex;
        return (
          <Pressable
            key={label}
            onPress={() => onPress(i)}
            style={({ pressed }) => [
              tabStyles.tab,
              isActive && tabStyles.tabActive,
              pressed && tabStyles.tabPressed,
            ]}
          >
            <Text style={[tabStyles.tabText, isActive && tabStyles.tabTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Five-card row, with invisible placeholders for unrevealed slots. */
function CardRow({
  cards,
  cardEmphasis,
  handNumber,
  boardKey,
}: {
  cards: (CardType | undefined)[];
  cardEmphasis?: Array<Emphasis> | null;
  handNumber: number;
  boardKey: string;
}) {
  return (
    <View style={cardStyles.row}>
      {Array.from({ length: CARD_COUNT }, (_, i) => {
        const card = cards[i];
        const isRevealed = card != null;
        const emphasis = cardEmphasis?.[i] ?? "neutral";
        return (
          <View
            key={`${handNumber}-${boardKey}-${i}`}
            style={[cardStyles.slot, emphasis === "dimmed" && cardStyles.dimmed]}
          >
            {isRevealed ? (
              <NativeCard card={card} />
            ) : (
              <CardPlaceholder />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── BombPotBoards ─────────────────────────────────────────────────────────────

function BombPotBoards({
  communityCards,
  communityCards2,
  activeBoard,
  onActiveBoardChange,
  boardEmphasis,
  handNumber,
}: {
  communityCards?: CardType[];
  communityCards2?: CardType[];
  activeBoard: number;
  onActiveBoardChange?: (i: number) => void;
  boardEmphasis: [Array<Emphasis> | null, Array<Emphasis> | null];
  handNumber: number;
}) {
  const boards = [communityCards ?? [], communityCards2 ?? []];

  return (
    <View style={boardStyles.container}>
      <TabStrip
        labels={["Board 1", "Board 2"]}
        activeIndex={activeBoard}
        onPress={onActiveBoardChange ?? (() => {})}
      />
      {/* Ghost layer — inactive board peeking behind */}
      <View style={boardStyles.ghostLayer}>
        <CardRow
          cards={boards[1 - activeBoard] ?? []}
          cardEmphasis={boardEmphasis[1 - activeBoard]}
          handNumber={handNumber}
          boardKey={`bomb-ghost-${activeBoard}`}
        />
      </View>
      <CardRow
        cards={boards[activeBoard] ?? []}
        cardEmphasis={boardEmphasis[activeBoard]}
        handNumber={handNumber}
        boardKey={`bomb-b${activeBoard}`}
      />
    </View>
  );
}

// ── RunItBoards ───────────────────────────────────────────────────────────────

function RunItBoards({
  runResults,
  knownCardCount,
  handNumber,
  viewingRun,
  onViewingRunChange,
  highlightedRunIndex,
  runCardEmphasis,
  runCardEmphasisByRun,
}: {
  runResults: RunResult[];
  knownCardCount: number;
  handNumber: number;
  viewingRun: number;
  onViewingRunChange?: (i: number) => void;
  highlightedRunIndex?: number | null;
  runCardEmphasis?: Array<Emphasis> | null;
  runCardEmphasisByRun?: Array<Array<Emphasis> | null> | null;
}) {
  const { currentRun, revealedCount } = deriveVisibleRunState(runResults, knownCardCount);
  const prevViewingRun = useRef(viewingRun);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Slide animation when switching tabs
  function switchTo(r: number) {
    const direction = r >= viewingRun ? 1 : -1;
    slideAnim.setValue(direction * 24);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    prevViewingRun.current = viewingRun;
    onViewingRunChange?.(r);
  }

  function emphasisForRun(runIndex: number): Array<Emphasis> | null {
    return (
      runCardEmphasisByRun?.[runIndex] ??
      (runIndex === highlightedRunIndex ? (runCardEmphasis ?? null) : null)
    );
  }

  const ghostRun = viewingRun > 0 ? viewingRun - 1 : null;

  const visibleCards: (CardType | undefined)[] = Array.from({ length: CARD_COUNT }, (_, i) => {
    const isKnown = i < knownCardCount;
    const isPast = viewingRun < currentRun;
    const isCurrent = viewingRun === currentRun;
    const isRevealed = isKnown || isPast || (isCurrent && i < revealedCount);
    return isRevealed ? runResults[viewingRun]?.board[i] : undefined;
  });

  return (
    <View style={boardStyles.container}>
      <TabStrip
        labels={runResults.map((_, r) => `Run ${r + 1}`)}
        activeIndex={viewingRun}
        onPress={switchTo}
      />
      {/* Ghost layer */}
      {ghostRun !== null && (
        <View style={boardStyles.ghostLayer}>
          <CardRow
            cards={runResults[ghostRun]?.board ?? []}
            cardEmphasis={emphasisForRun(ghostRun)}
            handNumber={handNumber}
            boardKey={`run-ghost-${ghostRun}`}
          />
        </View>
      )}
      <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        <CardRow
          cards={visibleCards}
          cardEmphasis={emphasisForRun(viewingRun)}
          handNumber={handNumber}
          boardKey={`run-${viewingRun}`}
        />
      </Animated.View>
    </View>
  );
}

// ── CommunityCards ────────────────────────────────────────────────────────────

export interface CommunityCardsProps {
  phase?: string;
  communityCards?: CardType[];
  communityCards2?: CardType[];
  isBombPot?: boolean;
  isRunItBoard?: boolean;
  runResults?: RunResult[];
  knownCardCount?: number;
  runDealStartedAt?: number | null;
  runAnnouncement?: 1 | 2 | 3 | null;
  handNumber?: number;
  activeBombPotBoardIndex?: number;
  onActiveBoardChange?: (boardIndex: number) => void;
  viewingRunIndex?: number;
  onViewingRunChange?: (runIndex: number) => void;
  cardEmphasis?: Array<Emphasis> | null;
  bombPotCardEmphasis?: [Array<Emphasis> | null, Array<Emphasis> | null];
  highlightedRunIndex?: number | null;
  runCardEmphasis?: Array<Emphasis> | null;
  runCardEmphasisByRun?: Array<Array<Emphasis> | null> | null;
  style?: ViewStyle;
}

export default function CommunityCards({
  phase,
  communityCards,
  communityCards2,
  isBombPot = false,
  isRunItBoard = false,
  runResults = [],
  knownCardCount = 0,
  runDealStartedAt = null,
  runAnnouncement = null,
  handNumber = 0,
  activeBombPotBoardIndex = 0,
  onActiveBoardChange,
  viewingRunIndex = 0,
  onViewingRunChange,
  cardEmphasis = null,
  bombPotCardEmphasis = [null, null],
  highlightedRunIndex = null,
  runCardEmphasis = null,
  runCardEmphasisByRun = null,
  style,
}: CommunityCardsProps) {
  const boardMode = getCenterBoardMode({
    phase,
    isBombPotHand: isBombPot,
    isRunItBoard,
    runDealStartedAt,
    runAnnouncement,
    runResults,
  });

  const isRunItAnnouncing = isRunItAnnouncementPhase({
    phase,
    isRunItBoard,
    isBombPotHand: isBombPot,
    runAnnouncement,
    runResults,
  });

  if (boardMode === "runIt") {
    return (
      <View style={[rootStyles.container, style]}>
        <RunItBoards
          runResults={runResults}
          knownCardCount={knownCardCount}
          handNumber={handNumber}
          viewingRun={viewingRunIndex}
          onViewingRunChange={onViewingRunChange}
          highlightedRunIndex={highlightedRunIndex}
          runCardEmphasis={runCardEmphasis}
          runCardEmphasisByRun={runCardEmphasisByRun}
        />
      </View>
    );
  }

  if (boardMode === "bombPot") {
    return (
      <View style={[rootStyles.container, style]}>
        <BombPotBoards
          communityCards={communityCards}
          communityCards2={communityCards2}
          activeBoard={activeBombPotBoardIndex}
          onActiveBoardChange={onActiveBoardChange}
          boardEmphasis={bombPotCardEmphasis}
          handNumber={handNumber}
        />
      </View>
    );
  }

  // Single board
  const singleCards: (CardType | undefined)[] = Array.from({ length: CARD_COUNT }, (_, i) => {
    if (isRunItAnnouncing && i >= knownCardCount) return undefined;
    return communityCards?.[i];
  });

  return (
    <View style={[rootStyles.container, style]}>
      <CardRow
        cards={singleCards}
        cardEmphasis={cardEmphasis}
        handNumber={handNumber}
        boardKey="single"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_SLOT_WIDTH = 54;
const CARD_SLOT_HEIGHT = Math.round(CARD_SLOT_WIDTH / 0.72);

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  slot: {
    width: CARD_SLOT_WIDTH,
    height: CARD_SLOT_HEIGHT,
  },
  dimmed: {
    opacity: 0.38,
  },
  placeholder: {
    width: CARD_SLOT_WIDTH,
    height: CARD_SLOT_HEIGHT,
    borderRadius: 10,
    opacity: 0,
  },
});

const boardStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  ghostLayer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.18,
    transform: [{ translateY: 8 }, { scaleX: 0.95 }],
    zIndex: 0,
  },
});

const rootStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
});

const tabStyles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: "#ef4444",
  },
  tabPressed: {
    opacity: 0.75,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: "#ffffff",
  },
});
