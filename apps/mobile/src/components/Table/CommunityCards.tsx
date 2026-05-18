import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from "react-native";
import type { LayoutChangeEvent, ViewStyle, ViewToken } from "react-native";
import { NativeCard } from "@pokington/ui/native";
import type { Card as CardType } from "@pokington/shared";
import type { RunResult } from "@pokington/engine";
import { hasAnimatedRunout } from "@pokington/engine";

// ── Deal animation tuning ─────────────────────────────────────────────────────
const DEAL_STAGGER_MS = 65;
const DEAL_DECK_TRANSLATE_X = -32;
const DEAL_DECK_TRANSLATE_Y = -44;
const DEAL_INITIAL_SCALE = 0.76;
const DEAL_INITIAL_ROTATE_DEG = -14;
const DEAL_SPRING = { stiffness: 320, damping: 22, mass: 0.9 };
const CARD_GAP_PX = 5;

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

function CardPlaceholder({ slotWidth, slotHeight }: { slotWidth: number; slotHeight: number }) {
  return <View style={[cardStyles.placeholder, { width: slotWidth, height: slotHeight }]} />;
}

// ── TabStrip ──────────────────────────────────────────────────────────────────

function makeTabStyles(isDark: boolean) {
  return StyleSheet.create({
    strip: {
      flexDirection: "row",
      gap: 3,
      padding: 3,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)",
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.15)",
    },
    tabActive: {
      backgroundColor: "#ef4444",
      borderColor: "#ef4444",
    },
    tabPressed: {
      opacity: 0.75,
    },
    tabText: {
      fontSize: 11,
      fontWeight: "900",
      color: isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)",
      letterSpacing: 0.5,
    },
    tabTextActive: {
      color: "#ffffff",
    },
  });
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
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const styles = useMemo(() => makeTabStyles(isDark), [isDark]);

  return (
    <View style={styles.strip}>
      {labels.map((label, i) => {
        const isActive = i === activeIndex;
        return (
          <Pressable
            key={label}
            onPress={() => onPress(i)}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              pressed && styles.tabPressed,
            ]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── DealSlot ──────────────────────────────────────────────────────────────────

function DealSlot({
  card,
  slotWidth,
  slotHeight,
  isDimmed,
  isNewlyRevealed,
  staggerOrder,
}: {
  card: CardType | undefined;
  slotWidth: number;
  slotHeight: number;
  isDimmed: boolean;
  isNewlyRevealed: boolean;
  staggerOrder: number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const animatedCardKeyRef = useRef<string | null>(null);

  const cardKey = card ? `${card.rank}:${card.suit}` : null;

  useLayoutEffect(() => {
    if (!isNewlyRevealed || !cardKey) return;
    if (animatedCardKeyRef.current === cardKey) return;
    animatedCardKeyRef.current = cardKey;

    translateY.setValue(DEAL_DECK_TRANSLATE_Y);
    translateX.setValue(DEAL_DECK_TRANSLATE_X);
    scale.setValue(DEAL_INITIAL_SCALE);
    opacity.setValue(0);
    rotate.setValue(DEAL_INITIAL_ROTATE_DEG);

    Animated.sequence([
      Animated.delay(staggerOrder * DEAL_STAGGER_MS),
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, ...DEAL_SPRING, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, ...DEAL_SPRING, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, ...DEAL_SPRING, useNativeDriver: true }),
        Animated.spring(rotate, { toValue: 0, ...DEAL_SPRING, useNativeDriver: true }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [isNewlyRevealed, cardKey, staggerOrder, opacity, scale, rotate, translateX, translateY]);

  const rotateDeg = rotate.interpolate({
    inputRange: [DEAL_INITIAL_ROTATE_DEG, 0],
    outputRange: [`${DEAL_INITIAL_ROTATE_DEG}deg`, "0deg"],
  });

  return (
    <Animated.View
      style={[
        { width: slotWidth, height: slotHeight },
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }, { rotate: rotateDeg }],
        },
      ]}
    >
      <View style={isDimmed ? cardStyles.dimmed : undefined}>
        {card ? (
          <NativeCard card={card} style={{ width: slotWidth }} />
        ) : (
          <CardPlaceholder slotWidth={slotWidth} slotHeight={slotHeight} />
        )}
      </View>
    </Animated.View>
  );
}

// ── CardRow ───────────────────────────────────────────────────────────────────

function CardRow({
  cards,
  cardEmphasis,
  handNumber,
  boardKey,
  slotWidth,
  slotHeight,
  enableDealAnimation = false,
}: {
  cards: (CardType | undefined)[];
  cardEmphasis?: Array<Emphasis> | null;
  handNumber: number;
  boardKey: string;
  slotWidth: number;
  slotHeight: number;
  enableDealAnimation?: boolean;
}) {
  const revealedCount = cards.reduce<number>(
    (acc, c) => acc + (c != null ? 1 : 0),
    0,
  );
  const lastHandNumberRef = useRef(handNumber);
  const lastBoardKeyRef = useRef(boardKey);
  const lastRevealedCountRef = useRef(revealedCount);

  // Same hand + board → animate freshly added cards. Switching hand or board
  // (e.g. reset, board tab change) → treat current cards as already settled.
  const contextChanged =
    lastHandNumberRef.current !== handNumber ||
    lastBoardKeyRef.current !== boardKey;
  const newlyRevealedFromIndex = contextChanged
    ? revealedCount
    : lastRevealedCountRef.current;

  useEffect(() => {
    lastHandNumberRef.current = handNumber;
    lastBoardKeyRef.current = boardKey;
    lastRevealedCountRef.current = revealedCount;
  });

  return (
    <View style={cardStyles.row}>
      {Array.from({ length: CARD_COUNT }, (_, i) => {
        const card = cards[i];
        const emphasis = cardEmphasis?.[i] ?? "neutral";
        const isNewlyRevealed =
          enableDealAnimation && card != null && i >= newlyRevealedFromIndex;
        const staggerOrder = isNewlyRevealed ? i - newlyRevealedFromIndex : 0;
        return (
          <DealSlot
            key={`${handNumber}-${boardKey}-${i}`}
            card={card}
            slotWidth={slotWidth}
            slotHeight={slotHeight}
            isDimmed={emphasis === "dimmed"}
            isNewlyRevealed={isNewlyRevealed}
            staggerOrder={staggerOrder}
          />
        );
      })}
    </View>
  );
}

// ── BoardPager ────────────────────────────────────────────────────────────────

type PageDescriptor = {
  cards: (CardType | undefined)[];
  emphasis: Array<Emphasis> | null;
  boardKey: string;
  enableDealAnimation: boolean;
};

function BoardPager({
  labels,
  pages,
  activeIndex,
  onActiveIndexChange,
  onUserInteraction,
  handNumber,
}: {
  labels: string[];
  pages: PageDescriptor[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onUserInteraction?: () => void;
  handNumber: number;
}) {
  // Measure the real viewport — tableMiddle has paddingHorizontal: 2, so the
  // available width is screenWidth − 4, not screenWidth. Using window width
  // causes snap drift that prevents reaching page ≥ 1.
  const [pageWidth, setPageWidth] = useState(0);
  const listRef = useRef<FlatList<PageDescriptor>>(null);
  const lastScrolledToRef = useRef(activeIndex);
  const isUserScrollingRef = useRef(false);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Keep callbacks in refs so onViewableItemsChanged is reference-stable for
  // FlatList's lifetime (changing it triggers a runtime error).
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const onUserInteractionRef = useRef(onUserInteraction);
  useEffect(() => {
    onActiveIndexChangeRef.current = onActiveIndexChange;
    onUserInteractionRef.current = onUserInteraction;
  });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setPageWidth((prev) => (prev === w ? prev : w));
  }, []);

  // Re-snap after a width change (rotation) so the active page stays aligned.
  useEffect(() => {
    if (pageWidth === 0) return;
    listRef.current?.scrollToIndex({ index: activeIndex, animated: false });
  }, [pageWidth]); // eslint-disable-line react-hooks/exhaustive-deps -- activeIndex intentionally omitted; width-change only

  // Programmatic scroll: pill tap or auto-snap from RunItBoards
  useEffect(() => {
    if (pageWidth === 0) return;
    if (lastScrolledToRef.current === activeIndex) return;
    lastScrolledToRef.current = activeIndex;
    listRef.current?.scrollToIndex({ index: activeIndex, animated: true });
  }, [activeIndex, pageWidth]);

  const slotWidth = pageWidth > 0
    ? Math.floor((pageWidth - 4 * CARD_GAP_PX) / 5)
    : 0;
  const slotHeight = Math.round(slotWidth / 0.72);

  const renderItem = useCallback(
    ({ item }: { item: PageDescriptor }) => (
      <View style={{ width: pageWidth }}>
        <CardRow
          cards={item.cards}
          cardEmphasis={item.emphasis}
          handNumber={handNumber}
          boardKey={item.boardKey}
          slotWidth={slotWidth}
          slotHeight={slotHeight}
          enableDealAnimation={item.enableDealAnimation}
        />
      </View>
    ),
    [pageWidth, handNumber, slotWidth, slotHeight],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!isUserScrollingRef.current) return;
      if (viewableItems.length === 0) return;
      const index = viewableItems[0]!.index;
      if (index === null) return;
      isUserScrollingRef.current = false;
      lastScrolledToRef.current = index;
      onUserInteractionRef.current?.();
      onActiveIndexChangeRef.current(index);
    },
    [],
  );

  const onScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
    onUserInteractionRef.current?.();
  }, []);

  return (
    <View style={boardStyles.container} onLayout={handleLayout}>
      <TabStrip
        labels={labels}
        activeIndex={activeIndex}
        onPress={onActiveIndexChange}
      />
      {pageWidth > 0 ? (
        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(item) => item.boardKey}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={pageWidth}
          snapToAlignment="start"
          getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
          renderItem={renderItem}
          initialNumToRender={pages.length}
          windowSize={Math.max(pages.length + 1, 3)}
          onScrollBeginDrag={onScrollBeginDrag}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          style={{ width: pageWidth }}
        />
      ) : null}
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
  const pages: PageDescriptor[] = boards.map((board, i) => ({
    cards: Array.from({ length: CARD_COUNT }, (_, j) => board[j] as CardType | undefined),
    emphasis: boardEmphasis[i],
    boardKey: `bomb-b${i}`,
    enableDealAnimation: true,
  }));

  const handleActiveIndexChange = useCallback(
    (i: number) => onActiveBoardChange?.(i),
    [onActiveBoardChange],
  );

  return (
    <BoardPager
      labels={["Board 1", "Board 2"]}
      pages={pages}
      activeIndex={activeBoard}
      onActiveIndexChange={handleActiveIndexChange}
      handNumber={handNumber}
    />
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
  const prevCurrentRunRef = useRef<number | null>(null);
  const userInteractionAtRef = useRef(0);

  // Auto-snap to the currently dealing run when it advances, unless user recently swiped
  useEffect(() => {
    if (prevCurrentRunRef.current === null) {
      prevCurrentRunRef.current = currentRun;
      return;
    }
    if (currentRun === prevCurrentRunRef.current) return;
    prevCurrentRunRef.current = currentRun;

    const timeSinceInteraction = Date.now() - userInteractionAtRef.current;
    if (timeSinceInteraction < 3000) return;

    onViewingRunChange?.(currentRun);
  }, [currentRun, onViewingRunChange]);

  function emphasisForRun(runIndex: number): Array<Emphasis> | null {
    return (
      runCardEmphasisByRun?.[runIndex] ??
      (runIndex === highlightedRunIndex ? (runCardEmphasis ?? null) : null)
    );
  }

  const pages: PageDescriptor[] = runResults.map((_, r) => {
    const isPast = r < currentRun;
    const isCurrent = r === currentRun;
    const cards = Array.from({ length: CARD_COUNT }, (_, i) => {
      const isKnown = i < knownCardCount;
      const isRevealed = isKnown || isPast || (isCurrent && i < revealedCount);
      return isRevealed ? (runResults[r]!.board[i] as CardType | undefined) : undefined;
    });
    return {
      cards,
      emphasis: emphasisForRun(r),
      boardKey: `run-${r}`,
      enableDealAnimation: r === currentRun,
    };
  });

  const handleActiveIndexChange = useCallback(
    (i: number) => onViewingRunChange?.(i),
    [onViewingRunChange],
  );
  const handleUserInteraction = useCallback(() => {
    userInteractionAtRef.current = Date.now();
  }, []);

  return (
    <BoardPager
      labels={runResults.map((_, r) => `Run ${r + 1}`)}
      pages={pages}
      activeIndex={viewingRun}
      onActiveIndexChange={handleActiveIndexChange}
      onUserInteraction={handleUserInteraction}
      handNumber={handNumber}
    />
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
  const { width: screenWidth } = useWindowDimensions();
  const slotWidth = Math.floor((screenWidth - 4 * CARD_GAP_PX) / 5);
  const slotHeight = Math.round(slotWidth / 0.72);

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
        slotWidth={slotWidth}
        slotHeight={slotHeight}
        enableDealAnimation
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
    gap: 2,
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
    alignSelf: "stretch",
    alignItems: "center",
    gap: 8,
  },
});

const rootStyles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    width: "100%",
    alignItems: "center",
  },
});
