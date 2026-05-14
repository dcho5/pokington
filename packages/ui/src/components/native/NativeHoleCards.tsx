import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { NativeCard, nativeLightTheme } from "./PokingtonNative";
import { canStartPublicReveal, canStartRevealHoldInteraction } from "../../lib/holeCardReveal";
import {
  getNativeTapOpenDuration,
  mapNativeTapOpenTiming,
  mapNativePairedSecondaryProgress,
  mapNativePeelDragToProgress,
  selectNativePeelTarget,
  shouldCommitNativePeelOpen,
  shouldFireNativePeek,
  shouldForceMountedNativePeelOpen,
  shouldSeedNativePeelOpen,
  type NativePeelTarget,
} from "../../lib/nativePeelMotion";
import { tokens } from "../../theme/tokens";
import type { Card as CardType } from "@pokington/shared";

const HOLD_TO_REVEAL_MS = 550;
const HOLD_CANCEL_DISTANCE_PX = 14;
const TRACE_STROKE = 2;
const COMMIT_PULSE_MS = 320;
const RING_COLOR = "#ef4444";
const CARD_GAP = 5;
const PEEL_RELEASE_DAMPING = 19;
const PEEL_RELEASE_STIFFNESS = 275;
const PEEL_RELEASE_MASS = 0.82;
const PEEL_RELEASE_MAX_VELOCITY = 7;

const TARGET_NONE = 0;
const TARGET_CARD_0 = 1;
const TARGET_CARD_1 = 2;
const TARGET_PAIR = 3;

type PeelTargetCode = typeof TARGET_NONE | typeof TARGET_CARD_0 | typeof TARGET_CARD_1 | typeof TARGET_PAIR;

type LazyHaptics = {
  selectionAsync: () => void;
  impactAsync: (style: "Light" | "Medium" | "Heavy") => void;
} | null;

let hapticsResolved = false;
let cachedHaptics: LazyHaptics = null;

function getHaptics(): LazyHaptics {
  if (hapticsResolved) return cachedHaptics;
  hapticsResolved = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-haptics");
    cachedHaptics = {
      selectionAsync: () => {
        try {
          mod.selectionAsync?.();
        } catch {}
      },
      impactAsync: (style) => {
        try {
          mod.impactAsync?.(mod.ImpactFeedbackStyle?.[style]);
        } catch {}
      },
    };
  } catch {
    cachedHaptics = null;
  }
  return cachedHaptics;
}

function targetToCode(target: NativePeelTarget): PeelTargetCode {
  "worklet";
  switch (target) {
    case "card0":
      return TARGET_CARD_0;
    case "card1":
      return TARGET_CARD_1;
    case "pair":
      return TARGET_PAIR;
    default:
      return TARGET_NONE;
  }
}

function cardKey(card: CardType | null | undefined) {
  return card ? `${card.rank}:${card.suit}` : "none";
}

function NativePeelCard({
  card,
  width,
  height,
  progress,
  revealed = false,
  emphasis = "neutral",
  autoReveal,
  onRevealChange,
  canRevealToOthers,
  isRevealedToOthers,
  onRevealToOthers,
  sevenTwoEligible,
}: {
  card?: CardType;
  width: number;
  height: number;
  progress: SharedValue<number>;
  revealed?: boolean;
  emphasis?: "neutral" | "highlighted" | "dimmed";
  autoReveal?: boolean;
  onRevealChange?: (revealed: boolean) => void;
  canRevealToOthers?: boolean;
  isRevealedToOthers?: boolean;
  onRevealToOthers?: () => void;
  sevenTwoEligible?: boolean;
}) {
  const holdProgress = useSharedValue(0);
  const commitPulse = useSharedValue(0);
  const holdActiveRef = useRef(false);

  const canSendPublicReveal = canStartPublicReveal({
    isPrivatelyRevealed: revealed,
    canRevealToOthers,
    isRevealedToOthers,
    sevenTwoEligible,
  });
  const canHoldReveal = canStartRevealHoldInteraction({
    isPrivatelyRevealed: revealed,
    canRevealToOthers,
    isRevealedToOthers,
    sevenTwoEligible,
  });

  const setFlipped = useCallback(
    (target: number, withSnap = true) => {
      if (withSnap) {
        progress.value = withSpring(target, tokens.motion.ios.spring);
      } else {
        progress.value = target;
      }
      if (target === 1) onRevealChange?.(true);
    },
    [onRevealChange, progress],
  );

  const handleHoldComplete = useCallback(() => {
    holdActiveRef.current = false;
    getHaptics()?.impactAsync("Medium");
    setFlipped(1);
    commitPulse.value = 0;
    commitPulse.value = withTiming(1, {
      duration: COMMIT_PULSE_MS,
      easing: Easing.out(Easing.quad),
    });
    if (canSendPublicReveal) onRevealToOthers?.();
  }, [canSendPublicReveal, commitPulse, onRevealToOthers, setFlipped]);

  const cancelHold = useCallback(() => {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    cancelAnimation(holdProgress);
    holdProgress.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [holdProgress]);

  const startHold = useCallback(() => {
    holdActiveRef.current = true;
    getHaptics()?.selectionAsync();
    holdProgress.value = 0;
    holdProgress.value = withTiming(
      1,
      { duration: HOLD_TO_REVEAL_MS, easing: Easing.linear },
      (finished) => {
        "worklet";
        if (finished) runOnJS(handleHoldComplete)();
      },
    );
  }, [handleHoldComplete, holdProgress]);

  const holdGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(HOLD_TO_REVEAL_MS)
        .maxDistance(HOLD_CANCEL_DISTANCE_PX)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          runOnJS(startHold)();
        })
        .onFinalize(() => {
          runOnJS(cancelHold)();
        }),
    [cancelHold, startHold],
  );

  const fireSelection = useCallback(() => {
    getHaptics()?.selectionAsync();
  }, []);

  const fireLight = useCallback(() => {
    getHaptics()?.impactAsync("Light");
  }, []);

  useAnimatedReaction(
    () => holdProgress.value,
    (current, previous) => {
      if (previous == null) return;
      if (previous < 0.25 && current >= 0.25) runOnJS(fireSelection)();
      if (previous < 0.5 && current >= 0.5) runOnJS(fireLight)();
      if (previous < 0.75 && current >= 0.75) runOnJS(fireSelection)();
    },
  );

  useEffect(() => {
    cancelHold();
    if (revealed) {
      setFlipped(1);
    } else {
      progress.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  useEffect(() => {
    if (autoReveal) setFlipped(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReveal]);

  useEffect(() => {
    if (isRevealedToOthers) cancelHold();
  }, [isRevealedToOthers, cancelHold]);

  useEffect(() => () => cancelHold(), [cancelHold]);

  const contactShadowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.45, 1], [0.24, 0.42, 0.12], "clamp"),
      transform: [
        { translateY: interpolate(p, [0, 1], [4, 10], "clamp") },
        { scaleX: interpolate(p, [0, 1], [0.86, 0.62], "clamp") },
        { scaleY: interpolate(p, [0, 1], [1, 0.58], "clamp") },
      ],
    };
  });

  const peelSurfaceStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      shadowOpacity: 0.08 + p * 0.12,
      shadowRadius: 7 + p * 8,
      transform: [
        { perspective: 700 },
        { translateY: interpolate(p, [0, 1], [height * 0.015, 0], "clamp") },
        { rotateX: `${interpolate(p, [0, 1], [2, 0], "clamp")}deg` },
        { scale: interpolate(p, [0, 1], [0.985, 1], "clamp") },
      ],
    };
  });

  const backLayerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const scale = 1 - p;
    return {
      opacity: interpolate(p, [0, 0.96, 1], [1, 1, 0], "clamp"),
      transform: [
        { translateY: (height * p) / 2 },
        { scaleY: scale },
      ],
    };
  });

  const faceLayerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.02, 1], [0, 1, 1], "clamp"),
      transform: [
        { translateY: (height * (1 - p)) / 2 },
        { scaleY: p },
      ],
    };
  });

  const peelEdgeStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.04, 0.94, 1], [0, 0.45, 0.45, 0], "clamp"),
      transform: [
        { translateY: interpolate(p, [0, 1], [height - 2, -1], "clamp") },
        { scaleX: interpolate(p, [0, 0.5, 1], [0.7, 1, 0.78], "clamp") },
      ],
    };
  });

  const sheenStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0.04, 0.5, 0.94], [0, 0.3, 0], "clamp"),
      transform: [
        { translateY: interpolate(p, [0, 1], [height * 0.74, height * 0.06], "clamp") },
        { rotate: "-18deg" },
      ],
    };
  });

  const hintTextStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, progress.value / 0.12),
  }));

  const ringStyle = useAnimatedStyle(() => {
    const p = holdProgress.value;
    const COL = (a: number) => `rgba(239,68,68,${a})`;
    return {
      borderTopColor: interpolateColor(p, [0, 0.4], [COL(0), COL(1)]),
      borderRightColor: interpolateColor(p, [0.1, 0.55], [COL(0), COL(1)]),
      borderBottomColor: interpolateColor(p, [0.3, 0.8], [COL(0), COL(1)]),
      borderLeftColor: interpolateColor(p, [0.55, 1], [COL(0), COL(1)]),
      shadowOpacity: interpolate(p, [0, 0.05, 1], [0, 0.35, 0.6], "clamp"),
    };
  });

  const hintBorderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(holdProgress.value, [0, 0.05], [1, 0], "clamp"),
  }));

  const commitPulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(commitPulse.value, [0, 1], [1, 1.18]);
    const opacity = interpolate(commitPulse.value, [0, 0.15, 1], [0, 0.85, 0]);
    return { transform: [{ scale }], opacity };
  });

  const cardStyle: ViewStyle = emphasis === "dimmed" ? { opacity: 0.38 } : {};
  const cardArea = (
    <Animated.View style={[peelStyles.cardArea, { width, height }]}>
      <Animated.View pointerEvents="none" style={[peelStyles.contactShadow, contactShadowStyle]} />
      <Animated.View pointerEvents="none" style={[peelStyles.peelSurface, { width, height }, peelSurfaceStyle]}>
        <Animated.View pointerEvents="none" style={[peelStyles.peelClipLayer, { width, height }, backLayerStyle]}>
          <NativeCard card={undefined} style={{ width, height }} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[peelStyles.peelClipLayer, { width, height }, faceLayerStyle]}>
          <NativeCard card={card} style={{ width, height, ...cardStyle }} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[peelStyles.peelEdge, peelEdgeStyle]} />
        <Animated.View pointerEvents="none" style={[peelStyles.peelSheen, sheenStyle]} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[peelStyles.hintContainer, hintTextStyle]}
      >
        <Text style={peelStyles.hintText}>peek up</Text>
      </Animated.View>
      {canHoldReveal ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              peelStyles.hintBorder,
              { width: width + 2, height: height + 2 },
              hintBorderStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[peelStyles.traceRing, { width: width + 2, height: height + 2 }, ringStyle]}
          />
        </>
      ) : null}
    </Animated.View>
  );

  return (
    <View style={[peelStyles.root, { width, height }]}>
      <View
        style={[
          peelStyles.revealedRing,
          { width: width + 4, height: height + 4, borderRadius: 14 },
          { opacity: isRevealedToOthers ? 1 : 0 },
        ]}
        pointerEvents="none"
      />

      <Animated.View
        pointerEvents="none"
        style={[
          peelStyles.commitPulse,
          { width: width + 4, height: height + 4, borderRadius: 14, top: -2, left: -2 },
          commitPulseStyle,
        ]}
      />

      {canHoldReveal ? <GestureDetector gesture={holdGesture}>{cardArea}</GestureDetector> : cardArea}
    </View>
  );
}

const peelStyles = StyleSheet.create({
  root: {
    position: "relative",
    flexShrink: 0,
  },
  revealedRing: {
    position: "absolute",
    top: -2,
    left: -2,
    borderWidth: 2,
    borderColor: "rgba(248,113,113,0.88)",
    zIndex: 20,
  },
  commitPulse: {
    position: "absolute",
    borderWidth: 2,
    borderColor: RING_COLOR,
    zIndex: 25,
  },
  cardArea: {
    overflow: "visible",
    borderRadius: 12,
  },
  peelSurface: {
    position: "absolute",
    top: 0,
    left: 0,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 7 },
    overflow: "visible",
    zIndex: 2,
  },
  peelClipLayer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderRadius: 12,
    zIndex: 2,
  },
  peelEdge: {
    position: "absolute",
    top: 0,
    left: -4,
    right: -4,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.28)",
    zIndex: 4,
  },
  contactShadow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: -5,
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.45)",
    zIndex: 0,
  },
  peelSheen: {
    position: "absolute",
    left: -12,
    right: -12,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.32)",
    zIndex: 5,
  },
  hintBorder: {
    position: "absolute",
    top: -1,
    left: -1,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    borderRadius: 13,
    zIndex: 5,
  },
  traceRing: {
    position: "absolute",
    top: -1,
    left: -1,
    borderWidth: TRACE_STROKE,
    borderRadius: 13,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    shadowColor: RING_COLOR,
    shadowOpacity: 0,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 15,
  },
  hintContainer: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  hintText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});

export interface NativeHoleCardsProps {
  cards?: [CardType, CardType] | null;
  /** Card height in px. Width is derived at 5:7 ratio. */
  cardHeight?: number;
  style?: ViewStyle;
  onRevealChange?: (bothRevealed: boolean) => void;
  autoReveal?: boolean;
  canRevealToOthers?: boolean;
  revealedToOthersIndices?: Set<0 | 1>;
  onRevealToOthers?: (index: 0 | 1) => void;
  sevenTwoEligible?: boolean;
  onPeekCard?: (index: 0 | 1) => void;
  peekedCardIndices?: Set<0 | 1>;
  emphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
}

export function NativeHoleCards({
  cards,
  cardHeight = 120,
  style,
  onRevealChange,
  autoReveal = false,
  canRevealToOthers = false,
  revealedToOthersIndices,
  onRevealToOthers,
  sevenTwoEligible = false,
  onPeekCard,
  peekedCardIndices,
  emphasisByIndex = ["neutral", "neutral"],
}: NativeHoleCardsProps) {
  const cardWidth = Math.round((cardHeight * 5) / 7);
  const card0IsRevealedToOthers = revealedToOthersIndices?.has(0) ?? false;
  const card1IsRevealedToOthers = revealedToOthersIndices?.has(1) ?? false;
  const card0IsPeeked = peekedCardIndices?.has(0) ?? false;
  const card1IsPeeked = peekedCardIndices?.has(1) ?? false;
  const card0StartsRevealed = shouldSeedNativePeelOpen({
    autoReveal,
    isRevealedToOthers: card0IsRevealedToOthers,
    isPeeked: card0IsPeeked,
  });
  const card1StartsRevealed = shouldSeedNativePeelOpen({
    autoReveal,
    isRevealedToOthers: card1IsRevealedToOthers,
    isPeeked: card1IsPeeked,
  });
  const card0ShouldForceOpen = shouldForceMountedNativePeelOpen({
    autoReveal,
    isRevealedToOthers: card0IsRevealedToOthers,
  });
  const card1ShouldForceOpen = shouldForceMountedNativePeelOpen({
    autoReveal,
    isRevealedToOthers: card1IsRevealedToOthers,
  });
  const progress0 = useSharedValue(card0StartsRevealed ? 1 : 0);
  const progress1 = useSharedValue(card1StartsRevealed ? 1 : 0);
  const startProgress0 = useSharedValue(card0StartsRevealed ? 1 : 0);
  const startProgress1 = useSharedValue(card1StartsRevealed ? 1 : 0);
  const activeTarget = useSharedValue<PeelTargetCode>(TARGET_NONE);
  const card0CanPeel = useSharedValue(!card0StartsRevealed);
  const card1CanPeel = useSharedValue(!card1StartsRevealed);

  const [card0Revealed, setCard0Revealed] = React.useState(card0StartsRevealed);
  const [card1Revealed, setCard1Revealed] = React.useState(card1StartsRevealed);
  const hasPeeked0Ref = useRef(card0StartsRevealed);
  const hasPeeked1Ref = useRef(card1StartsRevealed);
  const lastCardsKeyRef = useRef("");

  const card0CanArmReveal = canStartPublicReveal({
    isPrivatelyRevealed: card0Revealed,
    canRevealToOthers,
    isRevealedToOthers: card0IsRevealedToOthers,
    sevenTwoEligible,
  });
  const card1CanArmReveal = canStartPublicReveal({
    isPrivatelyRevealed: card1Revealed,
    canRevealToOthers,
    isRevealedToOthers: card1IsRevealedToOthers,
    sevenTwoEligible,
  });

  const currentCardsKey = useMemo(
    () => `${cardKey(cards?.[0])}|${cardKey(cards?.[1])}`,
    [cards],
  );

  const fireSelection = useCallback(() => {
    getHaptics()?.selectionAsync();
  }, []);

  const markPeeked = useCallback(
    (index: 0 | 1) => {
      if (index === 0) {
        if (hasPeeked0Ref.current) return;
        hasPeeked0Ref.current = true;
      } else {
        if (hasPeeked1Ref.current) return;
        hasPeeked1Ref.current = true;
      }
      getHaptics()?.impactAsync("Light");
      onPeekCard?.(index);
    },
    [onPeekCard],
  );

  const settleCard = useCallback(
    (index: 0 | 1, open: boolean, releasedProgress: number) => {
      if (open) {
        getHaptics()?.impactAsync("Medium");
        if (index === 0) setCard0Revealed(true);
        if (index === 1) setCard1Revealed(true);
        return;
      }
      if (releasedProgress > 0.08) getHaptics()?.impactAsync("Light");
    },
    [],
  );

  useAnimatedReaction(
    () => progress0.value,
    (current, previous) => {
      if (previous == null) return;
      if (shouldFireNativePeek(previous, current)) runOnJS(markPeeked)(0);
    },
  );

  useAnimatedReaction(
    () => progress1.value,
    (current, previous) => {
      if (previous == null) return;
      if (shouldFireNativePeek(previous, current)) runOnJS(markPeeked)(1);
    },
  );

  useEffect(() => {
    const canPeel0 = Boolean(cards?.[0]) && !card0Revealed && !card0IsRevealedToOthers && !card0CanArmReveal;
    const canPeel1 = Boolean(cards?.[1]) && !card1Revealed && !card1IsRevealedToOthers && !card1CanArmReveal;
    card0CanPeel.value = canPeel0;
    card1CanPeel.value = canPeel1;
  }, [card0CanArmReveal, card0CanPeel, card0IsRevealedToOthers, card0Revealed, card1CanArmReveal, card1CanPeel, card1IsRevealedToOthers, card1Revealed, cards]);

  useEffect(() => {
    if (!lastCardsKeyRef.current) {
      lastCardsKeyRef.current = currentCardsKey;
      return;
    }
    if (lastCardsKeyRef.current === currentCardsKey) return;
    lastCardsKeyRef.current = currentCardsKey;
    setCard0Revealed(card0StartsRevealed);
    setCard1Revealed(card1StartsRevealed);
    hasPeeked0Ref.current = card0StartsRevealed;
    hasPeeked1Ref.current = card1StartsRevealed;
    progress0.value = card0StartsRevealed ? 1 : 0;
    progress1.value = card1StartsRevealed ? 1 : 0;

    // When autoReveal seeds a card open on a new hand, notify the server so
    // peek counts surface to other players. Skip if the server already knows
    // (already peeked, or already publicly revealed).
    if (autoReveal) {
      if (card0StartsRevealed && !card0IsPeeked && !card0IsRevealedToOthers) {
        onPeekCard?.(0);
      }
      if (card1StartsRevealed && !card1IsPeeked && !card1IsRevealedToOthers) {
        onPeekCard?.(1);
      }
    }
  }, [
    autoReveal,
    card0IsPeeked,
    card0IsRevealedToOthers,
    card0StartsRevealed,
    card1IsPeeked,
    card1IsRevealedToOthers,
    card1StartsRevealed,
    currentCardsKey,
    onPeekCard,
    progress0,
    progress1,
  ]);

  useEffect(() => {
    if (card0IsPeeked) hasPeeked0Ref.current = true;
    if (card1IsPeeked) hasPeeked1Ref.current = true;
  }, [card0IsPeeked, card1IsPeeked]);

  useEffect(() => {
    if (card0ShouldForceOpen && !card0Revealed) {
      setCard0Revealed(true);
      // If autoReveal flipped on mid-hand, send the peek for any card that
      // wasn't already peeked or publicly revealed.
      if (!hasPeeked0Ref.current && !card0IsPeeked && !card0IsRevealedToOthers) {
        onPeekCard?.(0);
      }
      hasPeeked0Ref.current = true;
    }
    if (card1ShouldForceOpen && !card1Revealed) {
      setCard1Revealed(true);
      if (!hasPeeked1Ref.current && !card1IsPeeked && !card1IsRevealedToOthers) {
        onPeekCard?.(1);
      }
      hasPeeked1Ref.current = true;
    }
  }, [
    card0IsPeeked,
    card0IsRevealedToOthers,
    card0Revealed,
    card0ShouldForceOpen,
    card1IsPeeked,
    card1IsRevealedToOthers,
    card1Revealed,
    card1ShouldForceOpen,
    onPeekCard,
  ]);

  useEffect(() => {
    onRevealChange?.(card0Revealed && card1Revealed);
  }, [card0Revealed, card1Revealed, onRevealChange]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .onBegin((event) => {
          const target =
            event.numberOfPointers >= 2 && card0CanPeel.value && card1CanPeel.value
              ? "pair"
              : selectNativePeelTarget({
                  x: event.x,
                  cardWidth,
                  gap: CARD_GAP,
                  card0CanPeel: card0CanPeel.value,
                  card1CanPeel: card1CanPeel.value,
                });
          activeTarget.value = targetToCode(target);
          startProgress0.value = progress0.value;
          startProgress1.value = progress1.value;
          if (activeTarget.value !== TARGET_NONE) runOnJS(fireSelection)();
        })
        .onUpdate((event) => {
          if (event.numberOfPointers >= 2 && card0CanPeel.value && card1CanPeel.value) {
            activeTarget.value = TARGET_PAIR;
          }
          const target = activeTarget.value;
          if (target === TARGET_NONE) return;

          if (target === TARGET_CARD_0 || target === TARGET_PAIR) {
            const next = mapNativePeelDragToProgress({
              startProgress: startProgress0.value,
              translationY: event.translationY,
              cardHeight,
            });
            progress0.value = next;
          }

          if (target === TARGET_CARD_1) {
            const next = mapNativePeelDragToProgress({
              startProgress: startProgress1.value,
              translationY: event.translationY,
              cardHeight,
            });
            progress1.value = next;
          }

          if (target === TARGET_PAIR) {
            const next = mapNativePairedSecondaryProgress(progress0.value);
            progress1.value = next;
          }
        })
        .onFinalize((event) => {
          const target = activeTarget.value;
          if (target === TARGET_NONE) return;

          if (target === TARGET_CARD_0 || target === TARGET_PAIR) {
            const releasedProgress = progress0.value;
            const open = shouldCommitNativePeelOpen({
              progress: releasedProgress,
              velocityY: event.velocityY,
            });
            const releaseVelocity = Math.max(
              -PEEL_RELEASE_MAX_VELOCITY,
              Math.min(PEEL_RELEASE_MAX_VELOCITY, -event.velocityY / Math.max(1, cardHeight)),
            );
            progress0.value = withSpring(open ? 1 : 0, {
              damping: PEEL_RELEASE_DAMPING,
              stiffness: PEEL_RELEASE_STIFFNESS,
              mass: PEEL_RELEASE_MASS,
              velocity: releaseVelocity,
            });
            runOnJS(settleCard)(0, open, releasedProgress);
          }

          if (target === TARGET_CARD_1 || target === TARGET_PAIR) {
            const releasedProgress = progress1.value;
            const open = shouldCommitNativePeelOpen({
              progress: releasedProgress,
              velocityY: event.velocityY,
            });
            const releaseVelocity = Math.max(
              -PEEL_RELEASE_MAX_VELOCITY,
              Math.min(PEEL_RELEASE_MAX_VELOCITY, -event.velocityY / Math.max(1, cardHeight)),
            );
            progress1.value = withSpring(open ? 1 : 0, {
              damping: PEEL_RELEASE_DAMPING,
              stiffness: PEEL_RELEASE_STIFFNESS,
              mass: PEEL_RELEASE_MASS,
              velocity: releaseVelocity,
            });
            runOnJS(settleCard)(1, open, releasedProgress);
          }

          activeTarget.value = TARGET_NONE;
        }),
    [
      activeTarget,
      card0CanPeel,
      card1CanPeel,
      cardHeight,
      cardWidth,
      fireSelection,
      progress0,
      progress1,
      settleCard,
      startProgress0,
      startProgress1,
    ],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(260)
        .maxDistance(10)
        .onEnd((event, success) => {
          if (!success) return;
          const target = selectNativePeelTarget({
            x: event.x,
            cardWidth,
            gap: CARD_GAP,
            card0CanPeel: card0CanPeel.value,
            card1CanPeel: card1CanPeel.value,
          });
          const targetCode = targetToCode(target);
          if (targetCode === TARGET_NONE || targetCode === TARGET_PAIR) return;

          runOnJS(fireSelection)();
          if (targetCode === TARGET_CARD_0) {
            cancelAnimation(progress0);
            progress0.value = withTiming(
              1,
              { duration: getNativeTapOpenDuration(progress0.value), easing: mapNativeTapOpenTiming },
              (finished) => {
                "worklet";
                if (finished) runOnJS(settleCard)(0, true, 1);
              },
            );
          }
          if (targetCode === TARGET_CARD_1) {
            cancelAnimation(progress1);
            progress1.value = withTiming(
              1,
              { duration: getNativeTapOpenDuration(progress1.value), easing: mapNativeTapOpenTiming },
              (finished) => {
                "worklet";
                if (finished) runOnJS(settleCard)(1, true, 1);
              },
            );
          }
        }),
    [card0CanPeel, card1CanPeel, cardWidth, fireSelection, progress0, progress1, settleCard],
  );

  const peelGesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  return (
    <GestureDetector gesture={peelGesture}>
      <View style={[holeStyles.row, style]}>
        <NativePeelCard
          card={cards?.[0]}
          width={cardWidth}
          height={cardHeight}
          progress={progress0}
          revealed={card0Revealed}
          emphasis={emphasisByIndex[0] ?? "neutral"}
          autoReveal={autoReveal}
          onRevealChange={(v) => v && setCard0Revealed(true)}
          canRevealToOthers={canRevealToOthers}
          isRevealedToOthers={card0IsRevealedToOthers}
          onRevealToOthers={() => onRevealToOthers?.(0)}
          sevenTwoEligible={sevenTwoEligible}
        />
        <NativePeelCard
          card={cards?.[1]}
          width={cardWidth}
          height={cardHeight}
          progress={progress1}
          revealed={card1Revealed}
          emphasis={emphasisByIndex[1] ?? "neutral"}
          autoReveal={autoReveal}
          onRevealChange={(v) => v && setCard1Revealed(true)}
          canRevealToOthers={canRevealToOthers}
          isRevealedToOthers={card1IsRevealedToOthers}
          onRevealToOthers={() => onRevealToOthers?.(1)}
          sevenTwoEligible={sevenTwoEligible}
        />
      </View>
    </GestureDetector>
  );
}

const holeStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: CARD_GAP,
  },
});

export { nativeLightTheme };
