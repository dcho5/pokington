import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import ReAnimated, {
  Easing as REasing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { Card } from "@pokington/shared";
import { tokens } from "../../theme/tokens";
import { nativeThemeStyles } from "../../theme/stylesheet";

type Tone = "primary" | "secondary" | "danger";

const HAIRLINE = StyleSheet.hairlineWidth;
const IOS_SPRING = tokens.motion.ios.spring;
const IOS_PRESS_SPRING = tokens.motion.ios.pressSpring;
const IOS_SHEET_SPRING = tokens.motion.ios.sheetSpring;

let blurResolved = false;
let cachedBlurView: React.ComponentType<any> | null = null;
function getBlurView(): React.ComponentType<any> | null {
  if (blurResolved) return cachedBlurView;
  blurResolved = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedBlurView = require("expo-blur").BlurView ?? null;
  } catch {
    cachedBlurView = null;
  }
  return cachedBlurView;
}

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
      impactAsync: (style: "Light" | "Medium" | "Heavy") => {
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

const CHIP_ROTATE_RANGE = 1080;

const CHIP_BODY_LAYERS = [
  { scale: 1, color: "#7f1d1d", opacity: 1 },
  { scale: 0.94, color: "#8b2222", opacity: 0.78 },
  { scale: 0.86, color: "#972626", opacity: 0.58 },
  { scale: 0.76, color: "#a52a2a", opacity: 0.44 },
  { scale: 0.64, color: "#b22b2b", opacity: 0.34 },
  { scale: 0.5, color: "#ba2929", opacity: 0.25 },
  { scale: 0.34, color: "#be1c1c", opacity: 0.16 },
] as const;

const CHIP_GLINT_LAYERS = [
  { scale: 1, opacity: 0.06 },
  { scale: 0.84, opacity: 0.08 },
  { scale: 0.68, opacity: 0.1 },
  { scale: 0.52, opacity: 0.13 },
  { scale: 0.36, opacity: 0.16 },
  { scale: 0.22, opacity: 0.18 },
] as const;

const CHIP_HALO_LAYERS = [
  { scale: 0.96, opacity: 0.06 },
  { scale: 0.78, opacity: 0.08 },
  { scale: 0.6, opacity: 0.08 },
  { scale: 0.42, opacity: 0.05 },
] as const;

function getShortestAngleDelta(targetAngle: number, currentAngle: number) {
  const delta = ((targetAngle - currentAngle + 540) % 360) - 180;
  return delta === -180 ? 180 : delta;
}

export const nativeLightTheme = {
  colors: {
    background: "#f3f4f8",
    header: "rgba(255,255,255,0.86)",
    surface: "#ffffff",
    surfaceSoft: "rgba(255,255,255,0.72)",
    surfaceMuted: "#eef0f5",
    border: "#e3e6ee",
    borderStrong: "#d5d9e4",
    text: "#111322",
    muted: "#6b7280",
    faint: "#9ca3af",
    accent: "#ef4444",
    accentStrong: "#b91c1c",
    accentTint: "rgba(239,68,68,0.16)",
    accentTintStrong: "rgba(239,68,68,0.22)",
    danger: "#ef4444",
    tableOuter: "#32384c",
    tableInner: "#111623",
    cardBack: "#0d1726",
    cardBackInner: "#162236",
    cardInk: "#111322",
    cardRed: "#dc2626",
    yellow: "#f8e600",
  },
  shadow: {
    surface: {
      shadowColor: "#0b1220",
      shadowOpacity: 0.08,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 8,
    },
    soft: {
      shadowColor: "#0b1220",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    red: {
      shadowColor: "#ef4444",
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
  },
} as const;

export interface NativeButtonProps extends PressableProps {
  label: string;
  tone?: Tone;
  loading?: boolean;
}

export function NativeButton({
  label,
  tone = "primary",
  loading = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: NativeButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      scale.value = withSpring(0.97, IOS_PRESS_SPRING);
      opacity.value = withTiming(0.85, { duration: 80 });
      getHaptics()?.selectionAsync();
      onPressIn?.(e);
    },
    [onPressIn, opacity, scale],
  );

  const handlePressOut = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      scale.value = withSpring(1, IOS_PRESS_SPRING);
      opacity.value = withTiming(1, { duration: 140 });
      onPressOut?.(e);
    },
    [onPressOut, opacity, scale],
  );

  return (
    <ReAnimated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={(state) => [
          styles.button,
          tone === "secondary" && styles.secondaryButton,
          tone === "danger" && styles.dangerButton,
          (disabled || loading) && styles.disabled,
          typeof style === "function" ? style(state) : style,
        ]}
        {...props}
      >
        {tone === "primary" ? (
          <View pointerEvents="none" style={styles.buttonGloss} />
        ) : null}
        {loading ? (
          <ActivityIndicator color={tone === "secondary" ? tokens.ios.systemBlue : "#ffffff"} />
        ) : (
          <Text
            style={[
              styles.buttonText,
              tone === "secondary" && styles.secondaryButtonText,
              tone === "danger" && styles.dangerButtonText,
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </ReAnimated.View>
  );
}

export interface NativePanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "plain" | "grouped" | "translucent";
}

export function NativePanel({ children, style, variant = "plain" }: NativePanelProps) {
  const BlurView = variant === "translucent" ? getBlurView() : null;

  if (BlurView) {
    return (
      <View style={[styles.panel, styles.panelTranslucent, style]}>
        <BlurView
          intensity={80}
          tint="systemThinMaterialLight"
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.panelTopHighlight} />
        <View>{children}</View>
      </View>
    );
  }

  return (
    <View
      style={[
        nativeThemeStyles.panel,
        variant === "grouped" && styles.panelGrouped,
        style,
      ]}
    >
      {variant !== "grouped" ? (
        <View pointerEvents="none" style={styles.panelTopHighlight} />
      ) : null}
      {children}
    </View>
  );
}

export interface NativeTextFieldProps extends TextInputProps {
  label: string;
  containerStyle?: ViewStyle;
}

export function NativeTextField({
  label,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: NativeTextFieldProps) {
  const focus = useSharedValue(0);

  const wrapperStyle = useAnimatedStyle(() => ({
    backgroundColor: focus.value > 0.5
      ? "rgba(118,118,128,0.18)"
      : "rgba(118,118,128,0.10)",
    transform: [{ scale: interpolate(focus.value, [0, 1], [1, 1.005]) }],
  }));

  return (
    <View style={[styles.field, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <ReAnimated.View style={[styles.inputWrapper, wrapperStyle]}>
        <TextInput
          placeholderTextColor={tokens.ios.tertiaryLabel}
          autoCapitalize="characters"
          autoCorrect={false}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: 180 });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: 180 });
            onBlur?.(e);
          }}
          style={[styles.input, style]}
          {...props}
        />
      </ReAnimated.View>
    </View>
  );
}

const SUIT_SYMBOLS = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
} as const;

function displayRank(rank: string): string {
  return rank === "T" ? "10" : rank;
}

function isRedSuit(card: Card | null | undefined): boolean {
  return card?.suit === "hearts" || card?.suit === "diamonds";
}

export function NativePokerChip({
  size = 38,
  animated = true,
  glowAngle = 0,
}: {
  size?: number;
  animated?: boolean;
  glowAngle?: number;
}) {
  const rim = Math.round(size * 0.96);
  const body = Math.round(size * 0.8);
  const inner = Math.round(size * 0.68);
  const ring = Math.round(size * 0.7);
  const glint = Math.round(size * 0.46);
  const glintLeft = body * 0.65 - glint / 2;
  const glintTop = body * 0.3125 - glint / 2;
  const pulse = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(glowAngle)).current;
  const currentAngleRef = useRef(glowAngle);
  const targetAngleRef = useRef(glowAngle);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) {
      pulse.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    pulse.setValue(0);
    pulseLoop.start();
    return () => {
      pulseLoop.stop();
    };
  }, [animated, pulse]);

  useEffect(() => {
    if (!animated) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      velocityRef.current = 0;
      rotation.setValue(glowAngle);
      currentAngleRef.current = glowAngle;
      targetAngleRef.current = glowAngle;
      return;
    }

    targetAngleRef.current = glowAngle;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const tick = () => {
      const delta = getShortestAngleDelta(targetAngleRef.current, currentAngleRef.current);
      velocityRef.current = velocityRef.current * 0.82 + delta * 0.14;
      currentAngleRef.current += velocityRef.current;
      rotation.setValue(currentAngleRef.current);

      if (Math.abs(delta) > 0.15 || Math.abs(velocityRef.current) > 0.15) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      currentAngleRef.current = targetAngleRef.current;
      velocityRef.current = 0;
      rotation.setValue(currentAngleRef.current);
      rafRef.current = null;
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [animated, glowAngle, rotation]);

  const pulseInputRange = [0, 0.5, 1];
  const chipScale = pulse.interpolate({ inputRange: pulseInputRange, outputRange: [1, 1.04, 1] });
  const chipOpacity = pulse.interpolate({ inputRange: pulseInputRange, outputRange: [0.85, 1, 0.85] });
  const haloScale = pulse.interpolate({ inputRange: pulseInputRange, outputRange: [1, 56 / 48, 1] });
  const haloOpacity = pulse.interpolate({ inputRange: pulseInputRange, outputRange: [0.8, 0.3, 0.8] });
  const glintRotate = rotation.interpolate({
    inputRange: [-CHIP_ROTATE_RANGE, CHIP_ROTATE_RANGE],
    outputRange: [`-${CHIP_ROTATE_RANGE}deg`, `${CHIP_ROTATE_RANGE}deg`],
  });

  return (
    <View
      accessibilityIgnoresInvertColors
      style={[styles.chipContainer, { width: size, height: size }]}
    >
      <Animated.View
        style={[
          styles.chipPulseWrapper,
          {
            width: size,
            height: size,
            opacity: animated ? chipOpacity : 1,
            transform: [{ scale: animated ? chipScale : 1 }],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.chipHalo,
            {
              width: size,
              height: size,
              opacity: animated ? haloOpacity : 0.8,
              transform: [{ scale: animated ? haloScale : 1 }],
            },
          ]}
        >
          {CHIP_HALO_LAYERS.map((layer) => {
            const layerSize = size * layer.scale;
            return (
              <View
                key={layer.scale}
                style={[
                  styles.chipHaloLayer,
                  {
                    width: layerSize,
                    height: layerSize,
                    borderRadius: layerSize / 2,
                    opacity: layer.opacity,
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        <Animated.View
          style={[
            styles.chipRim,
            {
              width: rim,
              height: rim,
              borderRadius: rim / 2,
              transform: [{ rotate: glintRotate }],
            },
          ]}
        >
          <View style={[styles.chipBody, { width: body, height: body, borderRadius: body / 2 }]}>
            {CHIP_BODY_LAYERS.map((layer) => {
              const layerSize = body * layer.scale;
              return (
                <View
                  key={layer.scale}
                  style={[
                    styles.chipBodyLayer,
                    {
                      width: layerSize,
                      height: layerSize,
                      borderRadius: layerSize / 2,
                      backgroundColor: layer.color,
                      opacity: layer.opacity,
                    },
                  ]}
                />
              );
            })}
            <View style={[styles.chipInnerWash, { width: inner, height: inner, borderRadius: inner / 2 }]} />
            <View
              style={[
                styles.chipRing,
                {
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  borderWidth: Math.max(1, size * 0.03),
                },
              ]}
            />
            <View
              style={[
                styles.chipGlint,
                {
                  width: glint,
                  height: glint,
                  borderRadius: glint / 2,
                  left: glintLeft,
                  top: glintTop,
                },
              ]}
            >
              {CHIP_GLINT_LAYERS.map((layer) => {
                const layerSize = glint * layer.scale;
                return (
                  <View
                    key={layer.scale}
                    style={[
                      styles.chipGlintLayer,
                      {
                        width: layerSize,
                        height: layerSize,
                        borderRadius: layerSize / 2,
                        opacity: layer.opacity,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View
              style={[
                styles.chipEdgeShade,
                {
                  width: body,
                  height: body,
                  borderRadius: body / 2,
                  borderWidth: Math.max(1, size * 0.035),
                },
              ]}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export function NativeCard({
  card,
  hidden = false,
  compact = false,
  style,
}: {
  card: Card | null | undefined;
  hidden?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const showBack = hidden || !card;
  const red = isRedSuit(card);
  const rank = card ? displayRank(card.rank) : "";
  const suit = card ? SUIT_SYMBOLS[card.suit] : "";

  return (
    <View
      style={[
        styles.card,
        compact && styles.compactCard,
        !compact && nativeLightTheme.shadow.soft,
        style,
      ]}
    >
      {showBack ? (
        <View style={styles.cardBackInset}>
          <View style={styles.cardBackStripe}>
            <Text style={styles.cardBackGlyph}>♠</Text>
          </View>
        </View>
      ) : (
        <>
          <View pointerEvents="none" style={styles.cardHighlight} />
          <View pointerEvents="none" style={styles.cardSheen} />
          <View style={styles.cardCorner}>
            <Text style={[styles.cardRank, red && styles.redCardText]}>{rank}</Text>
            <Text style={[styles.cardSuitSmall, red && styles.redCardText]}>{suit}</Text>
          </View>
          <Text style={[styles.cardSuitLarge, red && styles.redCardText]}>{suit}</Text>
          <View style={[styles.cardCorner, styles.cardCornerBottom]}>
            <Text style={[styles.cardRank, red && styles.redCardText]}>{rank}</Text>
            <Text style={[styles.cardSuitSmall, red && styles.redCardText]}>{suit}</Text>
          </View>
        </>
      )}
    </View>
  );
}

export const PokerCard = NativeCard;

export function CommunityBoard({ cards }: { cards: Card[] }) {
  const paddedCards = [
    ...cards,
    ...Array.from<Card | null>({ length: Math.max(0, 5 - cards.length) }).fill(null),
  ].slice(0, 5);
  return (
    <View style={styles.board}>
      {paddedCards.map((card, index) => (
        <NativeCard
          key={`${card?.rank ?? "empty"}-${card?.suit ?? "slot"}-${index}`}
          card={card}
          hidden={!card}
          compact
        />
      ))}
    </View>
  );
}

export interface PlayerSummary {
  id: string;
  name: string;
  seatIndex: number;
  stack: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isAway?: boolean;
  isActor?: boolean;
  isViewer?: boolean;
}

export function PlayerRow({ player }: { player: PlayerSummary }) {
  return (
    <View style={[styles.playerRow, player.isActor && styles.actorRow, player.isViewer && styles.viewerRow]}>
      {player.isActor ? <View pointerEvents="none" style={styles.actorAccent} /> : null}
      <View style={styles.playerIdentity}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name || `Seat ${player.seatIndex + 1}`}
        </Text>
        <Text style={styles.playerMeta}>
          Seat {player.seatIndex + 1}
          {player.isAway ? " · Away" : ""}
          {player.isFolded ? " · Folded" : ""}
          {player.isAllIn ? " · All-in" : ""}
        </Text>
      </View>
      <View style={styles.playerNumbers}>
        <Text style={styles.playerStack}>${(player.stack / 100).toFixed(2)}</Text>
        {player.currentBet > 0 ? (
          <Text style={styles.playerBet}>Bet ${(player.currentBet / 100).toFixed(2)}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

export interface NativeSegmentedControlProps {
  options: readonly string[];
  value: number;
  onChange: (idx: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function NativeSegmentedControl({
  options,
  value,
  onChange,
  style,
}: NativeSegmentedControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = options.length > 0 ? trackWidth / options.length : 0;
  const offset = useSharedValue(value);

  useEffect(() => {
    offset.value = withSpring(value, IOS_SPRING);
  }, [offset, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * segmentWidth }],
    width: segmentWidth,
  }));

  return (
    <View
      style={[styles.segmentedTrack, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {trackWidth > 0 ? (
        <ReAnimated.View pointerEvents="none" style={[styles.segmentedThumb, thumbStyle]} />
      ) : null}
      {options.map((option, index) => {
        const active = index === value;
        return (
          <Pressable
            key={`${option}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              getHaptics()?.selectionAsync();
              onChange(index);
            }}
            style={styles.segmentedItem}
          >
            <Text
              style={[styles.segmentedText, active && styles.segmentedTextActive]}
              numberOfLines={1}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NativeOptionSelector({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: readonly string[];
  value: number;
  onChange: (idx: number) => void;
  compact?: boolean;
}) {
  if (compact && options.length >= 2 && options.length <= 4) {
    return <NativeSegmentedControl options={options} value={value} onChange={onChange} />;
  }

  return (
    <View style={[styles.optionGrid, compact && styles.optionGridCompact]}>
      {options.map((option, index) => {
        const active = index === value;
        return (
          <Pressable
            key={`${option}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              getHaptics()?.selectionAsync();
              onChange(index);
            }}
            style={({ pressed }) => [
              styles.optionButton,
              compact && styles.optionButtonCompact,
              active && styles.optionButtonActive,
              pressed && styles.optionButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                compact && styles.optionTextCompact,
                active && styles.optionTextActive,
              ]}
              numberOfLines={1}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SHEET_DISMISS_DISTANCE_RATIO = 0.25;
const SHEET_DISMISS_VELOCITY = 800;

export function NativeBottomSheet({
  visible,
  onDismiss,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const translateY = useSharedValue(600);
  const scrimOpacity = useSharedValue(0);
  const sheetScale = useSharedValue(0.985);
  const sheetHeight = useRef(0);
  const BlurView = getBlurView();

  useEffect(() => {
    if (!visible) return;
    translateY.value = 600;
    scrimOpacity.value = 0;
    sheetScale.value = 0.985;
    translateY.value = withSpring(0, IOS_SHEET_SPRING);
    sheetScale.value = withSpring(1, IOS_SHEET_SPRING);
    scrimOpacity.value = withTiming(1, {
      duration: 220,
      easing: REasing.out(REasing.cubic),
    });
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(scrimOpacity);
      cancelAnimation(sheetScale);
    };
  }, [translateY, scrimOpacity, sheetScale, visible]);

  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        const ratio = sheetHeight.current
          ? Math.max(0, 1 - e.translationY / sheetHeight.current)
          : 1;
        scrimOpacity.value = ratio;
      }
    })
    .onEnd((e) => {
      const threshold = sheetHeight.current * SHEET_DISMISS_DISTANCE_RATIO;
      if (e.translationY > threshold || e.velocityY > SHEET_DISMISS_VELOCITY) {
        translateY.value = withTiming(sheetHeight.current || 600, {
          duration: 220,
          easing: REasing.out(REasing.cubic),
        });
        scrimOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, IOS_SHEET_SPRING);
        scrimOpacity.value = withTiming(1, { duration: 160 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: sheetScale.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.sheetModalRoot}>
        <ReAnimated.View style={[styles.sheetScrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </ReAnimated.View>
        <GestureDetector gesture={pan}>
          <ReAnimated.View
            onLayout={(e) => {
              sheetHeight.current = e.nativeEvent.layout.height;
            }}
            style={[styles.bottomSheet, sheetStyle]}
          >
            {BlurView ? (
              <BlurView
                intensity={92}
                tint="systemThickMaterialLight"
                style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}
              />
            ) : null}
            <View pointerEvents="none" style={styles.sheetTopHighlight} />
            <View style={styles.sheetGrabber} />
            {children}
          </ReAnimated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

export interface NativeListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showsChevron?: boolean;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NativeListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  destructive = false,
  showsChevron = false,
  isLast = false,
  style,
}: NativeListRowProps) {
  const Container: React.ComponentType<any> = onPress ? Pressable : View;
  return (
    <Container
      accessibilityRole={onPress ? "button" : undefined}
      onPress={
        onPress
          ? () => {
              getHaptics()?.selectionAsync();
              onPress();
            }
          : undefined
      }
      style={({ pressed }: { pressed?: boolean }) => [
        styles.listRow,
        !isLast && styles.listRowSeparator,
        pressed && styles.listRowPressed,
        style,
      ]}
    >
      {leading ? <View style={styles.listRowLeading}>{leading}</View> : null}
      <View style={styles.listRowContent}>
        <Text
          numberOfLines={1}
          style={[styles.listRowTitle, destructive && styles.listRowTitleDestructive]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.listRowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.listRowTrailing}>{trailing}</View> : null}
      {showsChevron ? <Text style={styles.listRowChevron}>›</Text> : null}
    </Container>
  );
}

export interface NativeIconButtonProps {
  icon: React.ReactNode;
  onPress?: () => void;
  size?: number;
  tone?: "plain" | "tinted";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function NativeIconButton({
  icon,
  onPress,
  size = 44,
  tone = "plain",
  accessibilityLabel,
  style,
  disabled,
}: NativeIconButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReAnimated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.92, IOS_PRESS_SPRING);
          getHaptics()?.selectionAsync();
        }}
        onPressOut={() => {
          scale.value = withSpring(1, IOS_PRESS_SPRING);
        }}
        onPress={onPress}
        style={[
          styles.iconButton,
          tone === "tinted" && styles.iconButtonTinted,
          { width: size, height: size, borderRadius: size / 2 },
          disabled && styles.disabled,
          style,
        ]}
      >
        {icon}
      </Pressable>
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radii.ios.lg,
    backgroundColor: nativeLightTheme.colors.accent,
    paddingHorizontal: tokens.spacing.md,
    overflow: "hidden",
    ...nativeLightTheme.shadow.red,
  },
  buttonGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  secondaryButton: {
    backgroundColor: "rgba(118,118,128,0.16)",
    shadowOpacity: 0,
    elevation: 0,
  },
  dangerButton: {
    backgroundColor: tokens.ios.systemRed,
  },
  disabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  secondaryButtonText: {
    color: tokens.ios.systemBlue,
  },
  dangerButtonText: {
    color: "#ffffff",
  },
  panel: {
    borderRadius: tokens.radii.ios.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    overflow: "hidden",
    backgroundColor: nativeLightTheme.colors.surface,
  },
  panelTopHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  panelTranslucent: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  panelGrouped: {
    padding: 0,
    gap: 0,
    overflow: "hidden",
    borderRadius: tokens.radii.ios.md,
    backgroundColor: tokens.ios.systemBackground,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: tokens.ios.secondaryLabel,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.08,
  },
  inputWrapper: {
    borderRadius: 12,
    backgroundColor: "rgba(118,118,128,0.10)",
  },
  input: {
    minHeight: 46,
    color: tokens.ios.label,
    fontSize: 17,
    fontWeight: "500",
    paddingHorizontal: 16,
    letterSpacing: -0.4,
  },
  board: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  card: {
    width: 54,
    aspectRatio: 0.72,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 5,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  compactCard: {
    width: 42,
    borderRadius: 8,
    padding: 4,
  },
  cardHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  cardSheen: {
    position: "absolute",
    top: -10,
    left: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.4)",
    opacity: 0.45,
  },
  cardBackInset: {
    flex: 1,
    borderRadius: 7,
    backgroundColor: nativeLightTheme.colors.cardBack,
    overflow: "hidden",
  },
  cardBackStripe: {
    flex: 1,
    margin: 3,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: nativeLightTheme.colors.cardBackInner,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBackGlyph: {
    color: "rgba(255,255,255,0.07)",
    fontSize: 22,
    fontWeight: "800",
  },
  cardCorner: {
    alignSelf: "flex-start",
    alignItems: "center",
  },
  cardCornerBottom: {
    alignSelf: "flex-end",
    transform: [{ rotate: "180deg" }],
  },
  cardRank: {
    color: nativeLightTheme.colors.cardInk,
    fontSize: 14,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  cardSuitSmall: {
    color: nativeLightTheme.colors.cardInk,
    fontSize: 10,
    lineHeight: 11,
    fontWeight: "800",
  },
  cardSuitLarge: {
    color: nativeLightTheme.colors.cardInk,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  redCardText: {
    color: nativeLightTheme.colors.cardRed,
  },
  playerRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    backgroundColor: tokens.ios.systemBackground,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: tokens.ios.separator,
  },
  actorRow: {
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  actorAccent: {
    position: "absolute",
    top: 8,
    bottom: 8,
    left: 0,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: nativeLightTheme.colors.accent,
  },
  viewerRow: {
    backgroundColor: tokens.ios.tertiarySystemFill,
  },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: tokens.ios.label,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.32,
  },
  playerMeta: {
    color: tokens.ios.secondaryLabel,
    fontSize: 13,
    lineHeight: 18,
  },
  playerNumbers: {
    alignItems: "flex-end",
  },
  playerStack: {
    color: tokens.ios.label,
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  playerBet: {
    color: nativeLightTheme.colors.accent,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  statusPill: {
    alignSelf: "flex-start",
    height: 22,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(120,120,128,0.16)",
    paddingHorizontal: 10,
  },
  statusPillText: {
    color: tokens.ios.secondaryLabel,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.08,
  },
  chipContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  chipPulseWrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  chipHalo: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  chipHaloLayer: {
    position: "absolute",
    backgroundColor: "#be1c1c",
  },
  chipRim: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    ...nativeLightTheme.shadow.red,
  },
  chipBody: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7f1d1d",
    overflow: "hidden",
  },
  chipBodyLayer: {
    position: "absolute",
  },
  chipInnerWash: {
    position: "absolute",
    backgroundColor: "#ffffff",
    opacity: 0.08,
  },
  chipRing: {
    position: "absolute",
    borderColor: "rgba(255,255,255,0.18)",
  },
  chipGlint: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  chipGlintLayer: {
    position: "absolute",
    backgroundColor: "#ffffff",
  },
  chipEdgeShade: {
    position: "absolute",
    borderColor: "rgba(127,29,29,0.34)",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionGridCompact: {
    flexWrap: "nowrap",
    gap: 6,
  },
  optionButton: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(118,118,128,0.10)",
    paddingHorizontal: 14,
  },
  optionButtonCompact: {
    flexBasis: 0,
    minHeight: 32,
    paddingHorizontal: 4,
  },
  optionButtonActive: {
    backgroundColor: nativeLightTheme.colors.accentTint,
  },
  optionButtonPressed: {
    opacity: 0.78,
  },
  optionText: {
    color: tokens.ios.label,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  optionTextCompact: {
    fontSize: 12,
  },
  optionTextActive: {
    color: nativeLightTheme.colors.accentStrong,
  },
  segmentedTrack: {
    position: "relative",
    flexDirection: "row",
    minHeight: 32,
    borderRadius: 9,
    backgroundColor: tokens.ios.tertiarySystemFill,
    padding: 2,
  },
  segmentedThumb: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentedItem: {
    flex: 1,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentedText: {
    color: tokens.ios.label,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.08,
  },
  segmentedTextActive: {
    fontWeight: "600",
  },
  sheetModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetScrim: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bottomSheet: {
    gap: tokens.spacing.md,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 14,
    paddingBottom: tokens.spacing.lg,
    overflow: "hidden",
    ...nativeLightTheme.shadow.surface,
  },
  sheetTopHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(60,60,67,0.3)",
    marginBottom: 8,
  },
  listRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    backgroundColor: tokens.ios.systemBackground,
  },
  listRowSeparator: {
    borderBottomWidth: HAIRLINE,
    borderBottomColor: tokens.ios.separator,
  },
  listRowPressed: {
    backgroundColor: "#E5E5EA",
  },
  listRowLeading: {
    marginRight: 12,
  },
  listRowContent: {
    flex: 1,
    minWidth: 0,
  },
  listRowTitle: {
    color: tokens.ios.label,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -0.4,
  },
  listRowTitleDestructive: {
    color: tokens.ios.systemRed,
  },
  listRowSubtitle: {
    color: tokens.ios.secondaryLabel,
    fontSize: 13,
    marginTop: 2,
  },
  listRowTrailing: {
    marginLeft: 8,
  },
  listRowChevron: {
    color: tokens.ios.tertiaryLabel,
    fontSize: 22,
    fontWeight: "400",
    marginLeft: 6,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(118,118,128,0.16)",
  },
  iconButtonTinted: {
    backgroundColor: "rgba(255,59,48,0.16)",
  },
});
