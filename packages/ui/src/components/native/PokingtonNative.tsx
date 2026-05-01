import React, { useEffect, useRef } from "react";
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
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { Card } from "@pokington/shared";
import { tokens } from "../../theme/tokens";
import { nativeThemeStyles } from "../../theme/stylesheet";

type Tone = "primary" | "secondary" | "danger";

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
  { scale: 1, opacity: 0.08 },
  { scale: 0.84, opacity: 0.11 },
  { scale: 0.68, opacity: 0.14 },
  { scale: 0.52, opacity: 0.17 },
  { scale: 0.36, opacity: 0.2 },
  { scale: 0.22, opacity: 0.24 },
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
    header: "rgba(255,255,255,0.9)",
    surface: "#ffffff",
    surfaceSoft: "rgba(255,255,255,0.78)",
    surfaceMuted: "#eef0f5",
    border: "#e3e6ee",
    borderStrong: "#d5d9e4",
    text: "#111322",
    muted: "#6b7280",
    faint: "#9ca3af",
    accent: "#ef4444",
    accentStrong: "#b91c1c",
    danger: "#ef4444",
    tableOuter: "#32384c",
    tableInner: "#111623",
    cardBack: "#111827",
    cardInk: "#111322",
    cardRed: "#dc2626",
    yellow: "#f8e600",
  },
  shadow: {
    surface: {
      shadowColor: "#111827",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    soft: {
      shadowColor: "#111827",
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    red: {
      shadowColor: "#ef4444",
      shadowOpacity: 0.28,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
} as const;

export interface NativeButtonProps extends PressableProps {
  label: string;
  tone?: Tone;
  loading?: boolean;
}

export function NativeButton({ label, tone = "primary", loading = false, disabled, style, ...props }: NativeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.button,
        tone === "secondary" && styles.secondaryButton,
        tone === "danger" && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        state.pressed && !disabled && !loading && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={tone === "secondary" ? nativeLightTheme.colors.text : "#ffffff"} />
      ) : (
        <Text style={[styles.buttonText, tone === "secondary" && styles.secondaryButtonText]}>{label}</Text>
      )}
    </Pressable>
  );
}

export interface NativePanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function NativePanel({ children, style }: NativePanelProps) {
  return <View style={[nativeThemeStyles.panel, style]}>{children}</View>;
}

export interface NativeTextFieldProps extends TextInputProps {
  label: string;
  containerStyle?: ViewStyle;
}

export function NativeTextField({ label, containerStyle, style, ...props }: NativeTextFieldProps) {
  return (
    <View style={[styles.field, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={nativeLightTheme.colors.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[styles.input, style]}
        {...props}
      />
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
    <View style={[styles.card, compact && styles.compactCard, style]}>
      {showBack ? (
        <View style={styles.cardBackInset}>
          <View style={styles.cardBackStripe} />
        </View>
      ) : (
        <>
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
  const paddedCards = [...cards, ...Array.from<Card | null>({ length: Math.max(0, 5 - cards.length) }).fill(null)].slice(0, 5);
  return (
    <View style={styles.board}>
      {paddedCards.map((card, index) => (
        <NativeCard key={`${card?.rank ?? "empty"}-${card?.suit ?? "slot"}-${index}`} card={card} hidden={!card} compact />
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
        {player.currentBet > 0 ? <Text style={styles.playerBet}>Bet ${(player.currentBet / 100).toFixed(2)}</Text> : null}
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
  return (
    <View style={[styles.optionGrid, compact && styles.optionGridCompact]}>
      {options.map((option, index) => {
        const active = index === value;
        return (
          <Pressable
            key={`${option}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(index)}
            style={({ pressed }) => [
              styles.optionButton,
              compact && styles.optionButtonCompact,
              active && styles.optionButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.optionText, compact && styles.optionTextCompact, active && styles.optionTextActive]} numberOfLines={1}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NativeBottomSheet({
  visible,
  onDismiss,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(34)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(34);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.sheetModalRoot}>
        <Pressable style={styles.sheetScrim} onPress={onDismiss} />
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: nativeLightTheme.colors.accent,
    paddingHorizontal: tokens.spacing.md,
    ...nativeLightTheme.shadow.red,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: nativeLightTheme.colors.surfaceMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  dangerButton: {
    backgroundColor: nativeLightTheme.colors.danger,
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  secondaryButtonText: {
    color: nativeLightTheme.colors.text,
  },
  field: {
    gap: tokens.spacing.sm,
  },
  fieldLabel: {
    color: nativeLightTheme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: nativeLightTheme.colors.surfaceSoft,
    color: nativeLightTheme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: tokens.spacing.md,
    ...nativeLightTheme.shadow.soft,
  },
  board: {
    flexDirection: "row",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
  card: {
    width: 54,
    aspectRatio: 0.72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "#ffffff",
    padding: 5,
    justifyContent: "space-between",
    ...nativeLightTheme.shadow.soft,
  },
  compactCard: {
    width: 42,
    borderRadius: 8,
    padding: 4,
  },
  cardBackInset: {
    flex: 1,
    borderRadius: 7,
    backgroundColor: nativeLightTheme.colors.cardBack,
    overflow: "hidden",
  },
  cardBackStripe: {
    flex: 1,
    margin: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#14233c",
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
    fontSize: 12,
    lineHeight: 13,
    fontWeight: "900",
  },
  cardSuitSmall: {
    color: nativeLightTheme.colors.cardInk,
    fontSize: 10,
    lineHeight: 11,
    fontWeight: "900",
  },
  cardSuitLarge: {
    color: nativeLightTheme.colors.cardInk,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  redCardText: {
    color: nativeLightTheme.colors.cardRed,
  },
  playerRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSubtle,
    padding: tokens.spacing.md,
  },
  actorRow: {
    borderColor: tokens.colors.accent,
  },
  viewerRow: {
    backgroundColor: tokens.colors.feltOverlay,
  },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  playerMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  playerNumbers: {
    alignItems: "flex-end",
  },
  playerStack: {
    color: tokens.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  playerBet: {
    color: tokens.colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: tokens.radii.pill,
    backgroundColor: nativeLightTheme.colors.surfaceMuted,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  statusPillText: {
    color: nativeLightTheme.colors.text,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
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
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: nativeLightTheme.colors.surfaceMuted,
    paddingHorizontal: 12,
  },
  optionButtonCompact: {
    flexBasis: 0,
    minHeight: 32,
    paddingHorizontal: 4,
  },
  optionButtonActive: {
    borderColor: nativeLightTheme.colors.accent,
    backgroundColor: nativeLightTheme.colors.accent,
  },
  optionText: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "900",
  },
  optionTextCompact: {
    fontSize: 11,
  },
  optionTextActive: {
    color: "#ffffff",
  },
  sheetModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  bottomSheet: {
    gap: tokens.spacing.md,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: nativeLightTheme.colors.surface,
    padding: tokens.spacing.lg,
    ...nativeLightTheme.shadow.surface,
  },
});
