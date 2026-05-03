import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { NativeCard, nativeLightTheme } from "./PokingtonNative";
import { canStartPublicReveal } from "../../lib/holeCardReveal";
import type { Card as CardType } from "@pokington/shared";

const HOLD_TO_REVEAL_MS = 550;
const HOLD_CANCEL_DISTANCE_PX = 14;

// ── NativePeelCard ────────────────────────────────────────────────────────────

/**
 * Single hole card with swipe-up peel gesture. Mirrors the web PeelCard in
 * packages/ui/src/components/web/poker/HoleCards.tsx.
 *
 * Animation: back face scaleY 1→0, front face scaleY 0→1, both pinned to the
 * bottom edge via a compensating translateY.
 *
 * Two interaction modes:
 *   • canArmReveal=false  → PanResponder swipe-up to peek/reveal
 *   • canArmReveal=true   → Pressable hold-to-reveal (fill animation)
 */
function NativePeelCard({
  card,
  width,
  height,
  revealed = false,
  emphasis = "neutral",
  autoReveal,
  onRevealChange,
  canRevealToOthers,
  isRevealedToOthers,
  onRevealToOthers,
  sevenTwoEligible,
  onPeekCard,
}: {
  card?: CardType;
  width: number;
  height: number;
  revealed?: boolean;
  emphasis?: "neutral" | "highlighted" | "dimmed";
  autoReveal?: boolean;
  onRevealChange?: (revealed: boolean) => void;
  canRevealToOthers?: boolean;
  isRevealedToOthers?: boolean;
  onRevealToOthers?: () => void;
  sevenTwoEligible?: boolean;
  onPeekCard?: () => void;
}) {
  // ── animation state ─────────────────────────────────────────────────────────
  const progressAnim = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const revealFillAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef(revealed ? 1 : 0);
  const startProgressRef = useRef(0);
  const hasRevealedRef = useRef(revealed);
  const hasPeekedRef = useRef(revealed);
  const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const holdStartXRef = useRef(0);
  const holdStartYRef = useRef(0);
  const holdActiveRef = useRef(false);

  // ── canArmReveal (ref so PanResponder closure stays current) ─────────────────
  const canArmReveal = canStartPublicReveal({
    isPrivatelyRevealed: revealed,
    canRevealToOthers,
    isRevealedToOthers,
    sevenTwoEligible,
  });
  const canArmRevealRef = useRef(canArmReveal);
  useEffect(() => {
    canArmRevealRef.current = canArmReveal;
  }, [canArmReveal]);

  // ── Bottom-pinned scaleY helpers ─────────────────────────────────────────────
  // To pin the bottom edge as scaleY changes around the element center:
  //   translateY = H * (1 - scaleY) / 2
  // Back face (scaleY = 1 - progress): translateY = H * progress / 2
  // Front face (scaleY = progress):    translateY = H * (1 - progress) / 2
  const backScaleY = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const backTranslateY = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, height / 2] });
  const frontScaleY = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const frontTranslateY = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] });
  const hintOpacity = progressAnim.interpolate({ inputRange: [0, 0.12], outputRange: [1, 0], extrapolate: "clamp" });
  const revealFillOpacity = revealFillAnim;
  const revealFillScaleY = revealFillAnim;

  // ── snap/apply helpers ───────────────────────────────────────────────────────
  function snapTo(target: number) {
    Animated.spring(progressAnim, {
      toValue: target,
      useNativeDriver: true,
      speed: 14,
      bounciness: 5,
    }).start();
    progressRef.current = target;
    if (target === 1 && !hasRevealedRef.current) {
      hasRevealedRef.current = true;
      onRevealChange?.(true);
    }
  }

  // ── PanResponder (peel gesture) ──────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !canArmRevealRef.current,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !canArmRevealRef.current && Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        startProgressRef.current = progressRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        if (canArmRevealRef.current) return;
        const dy = -gestureState.dy; // positive = dragged up
        const delta = dy / (height * 0.85);
        const next = Math.max(0, Math.min(1, startProgressRef.current + delta));
        progressAnim.setValue(next);
        progressRef.current = next;

        if (next > 0 && !hasPeekedRef.current) {
          hasPeekedRef.current = true;
          onPeekCard?.();
        }

        // Auto-snap once past 50%
        if (next >= 0.5 && startProgressRef.current < 0.5) {
          snapTo(1);
        }
      },
      onPanResponderRelease: () => {
        if (canArmRevealRef.current) return;
        snapTo(progressRef.current > 0.4 ? 1 : 0);
      },
      onPanResponderTerminate: () => {
        if (canArmRevealRef.current) return;
        snapTo(progressRef.current > 0.4 ? 1 : 0);
      },
    }),
  ).current;

  // ── Hold-to-reveal handlers ──────────────────────────────────────────────────
  function cancelHold() {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    holdAnimRef.current?.stop();
    holdAnimRef.current = null;
    Animated.timing(revealFillAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();
  }

  function onHoldPressIn(x: number, y: number) {
    holdActiveRef.current = true;
    holdStartXRef.current = x;
    holdStartYRef.current = y;
    revealFillAnim.setValue(0);
    const anim = Animated.timing(revealFillAnim, {
      toValue: 1,
      duration: HOLD_TO_REVEAL_MS,
      useNativeDriver: true,
      easing: Easing.linear,
    });
    holdAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished && holdActiveRef.current) {
        holdActiveRef.current = false;
        holdAnimRef.current = null;
        // If card is face-down (7-2 case), flip first then reveal
        snapTo(1);
        onRevealToOthers?.();
      }
    });
  }

  function onHoldPressOut() {
    cancelHold();
  }

  function onHoldMove(x: number, y: number) {
    if (!holdActiveRef.current) return;
    const dx = x - holdStartXRef.current;
    const dy = y - holdStartYRef.current;
    if (Math.hypot(dx, dy) > HOLD_CANCEL_DISTANCE_PX) {
      cancelHold();
    }
  }

  // ── prop-driven effects ──────────────────────────────────────────────────────
  useEffect(() => {
    cancelHold();
    if (revealed) {
      snapTo(1);
    } else {
      hasRevealedRef.current = false;
      hasPeekedRef.current = false;
      progressAnim.setValue(0);
      progressRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  useEffect(() => {
    if (autoReveal) snapTo(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReveal]);

  useEffect(() => {
    if (isRevealedToOthers) cancelHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealedToOthers]);

  useEffect(() => () => cancelHold(), []);

  // ── card style driven by emphasis ────────────────────────────────────────────
  const cardStyle: ViewStyle = emphasis === "dimmed" ? { opacity: 0.38 } : {};

  return (
    <View style={[peelStyles.root, { width, height }]}>
      {/* Revealed-to-others ring */}
      <View
        style={[
          peelStyles.revealedRing,
          { width: width + 4, height: height + 4, borderRadius: 14 },
          { opacity: isRevealedToOthers ? 1 : 0 },
        ]}
        pointerEvents="none"
      />

      {/* Gesture area */}
      {canArmReveal ? (
        // Hold-to-reveal mode: Pressable drives the fill animation
        <Pressable
          style={[peelStyles.cardArea, { width, height }]}
          onPressIn={(e) => onHoldPressIn(e.nativeEvent.pageX, e.nativeEvent.pageY)}
          onPressOut={onHoldPressOut}
          onTouchMove={(e) => {
            const touch = e.nativeEvent.touches[0];
            if (touch) onHoldMove(touch.pageX, touch.pageY);
          }}
        >
          {/* Front face (always visible in arm-reveal mode) */}
          <NativeCard card={card} style={{ width, height, ...cardStyle }} />

          {/* Blue fill overlay (grows upward from bottom during hold) */}
          <Animated.View
            pointerEvents="none"
            style={[
              peelStyles.revealFill,
              { width, height },
              {
                opacity: revealFillOpacity,
                transform: [{ translateY: revealFillAnim.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) }, { scaleY: revealFillScaleY }],
              },
            ]}
          />
        </Pressable>
      ) : (
        // Peel-drag mode: PanResponder
        <View
          style={[peelStyles.cardArea, { width, height }]}
          {...panResponder.panHandlers}
        >
          {/* Back face */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  { translateY: backTranslateY },
                  { scaleY: backScaleY },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <NativeCard card={undefined} style={{ width, height }} />
          </Animated.View>

          {/* Front face */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  { translateY: frontTranslateY },
                  { scaleY: frontScaleY },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <NativeCard card={card} style={{ width, height, ...cardStyle }} />
          </Animated.View>

          {/* Peek hint */}
          <Animated.View
            pointerEvents="none"
            style={[peelStyles.hintContainer, { opacity: hintOpacity }]}
          >
            <Text style={peelStyles.hintText}>peek ↑</Text>
          </Animated.View>
        </View>
      )}
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
  cardArea: {
    overflow: "hidden",
    borderRadius: 12,
  },
  revealFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    borderRadius: 12,
    backgroundColor: "rgba(37,99,235,0.7)",
    transformOrigin: "bottom",
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

// ── NativeHoleCards ───────────────────────────────────────────────────────────

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
  emphasisByIndex = ["neutral", "neutral"],
}: NativeHoleCardsProps) {
  const cardWidth = Math.round((cardHeight * 5) / 7);

  const [card0Revealed, setCard0Revealed] = React.useState(autoReveal);
  const [card1Revealed, setCard1Revealed] = React.useState(autoReveal);

  useEffect(() => {
    if (!autoReveal) return;
    setCard0Revealed(true);
    setCard1Revealed(true);
  }, [autoReveal]);

  useEffect(() => {
    onRevealChange?.(card0Revealed && card1Revealed);
  }, [card0Revealed, card1Revealed, onRevealChange]);

  return (
    <View style={[holeStyles.row, style]}>
      <NativePeelCard
        card={cards?.[0]}
        width={cardWidth}
        height={cardHeight}
        revealed={card0Revealed}
        emphasis={emphasisByIndex[0] ?? "neutral"}
        autoReveal={autoReveal}
        onRevealChange={(v) => v && setCard0Revealed(true)}
        canRevealToOthers={canRevealToOthers}
        isRevealedToOthers={revealedToOthersIndices?.has(0) ?? false}
        onRevealToOthers={() => onRevealToOthers?.(0)}
        sevenTwoEligible={sevenTwoEligible}
        onPeekCard={() => onPeekCard?.(0)}
      />
      <NativePeelCard
        card={cards?.[1]}
        width={cardWidth}
        height={cardHeight}
        revealed={card1Revealed}
        emphasis={emphasisByIndex[1] ?? "neutral"}
        autoReveal={autoReveal}
        onRevealChange={(v) => v && setCard1Revealed(true)}
        canRevealToOthers={canRevealToOthers}
        isRevealedToOthers={revealedToOthersIndices?.has(1) ?? false}
        onRevealToOthers={() => onRevealToOthers?.(1)}
        sevenTwoEligible={sevenTwoEligible}
        onPeekCard={() => onPeekCard?.(1)}
      />
    </View>
  );
}

const holeStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
  },
});

// Re-export theme ref for callers that need it
export { nativeLightTheme };
