import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getAvatarColor, getInitials } from "./avatarColor";
import type { Card } from "@pokington/shared";

export interface TablePlayer {
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
  hasCards?: boolean;
  lastAction?: string | null;
  winType?: "full" | "partial" | null;
  winAnimationKey?: string | null;
  peekedCount?: number;
  holeCards?: [Card | null, Card | null] | null;
}

// ── Metrics (derived from Web / Goal layout) ──────────────────────────────────
const METRICS = {
  containerWidth: 60,
  avatarSize: 48,
  badgeSize: 22,
  badgeInset: -2,
  showdownCardWidth: 16,
  showdownCardHeight: 20,
  showdownCardSpreadX: 9,
  showdownCardOffsetY: 8,
  primaryBadgeHeight: 18,
  primaryBadgeOffsetY: -12, // overlaps avatar
};

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const ACTION_LABELS: Record<string, string> = {
  fold: "FOLD",
  check: "CHECK",
  call: "CALL",
  raise: "RAISE",
  "all-in": "ALL IN",
};

function formatBetAmount(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) {
    const compact =
      dollars >= 10000
        ? Math.round(dollars / 1000)
        : Math.round(dollars / 100) / 10;
    return `$${compact}k`;
  }
  if (dollars >= 10) return `$${dollars.toFixed(1)}`;
  return `$${dollars.toFixed(2)}`;
}

function resolvePrimaryBadge(
  player: TablePlayer,
): { kind: "bet" | "all-in" | "action"; label: string } | null {
  if (player.currentBet > 0 && !player.isFolded) {
    return { kind: "bet", label: formatBetAmount(player.currentBet) };
  }
  if (player.isAllIn) return { kind: "all-in", label: "ALL IN" };
  if (player.lastAction) {
    return {
      kind: "action",
      label:
        ACTION_LABELS[player.lastAction] ?? player.lastAction.toUpperCase(),
    };
  }
  return null;
}

function isRedSuit(suit?: string | null) {
  return suit === "hearts" || suit === "diamonds";
}

interface PlayerBubbleProps {
  player: TablePlayer | null;
  seatIndex: number;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  seatSelectionLocked?: boolean;
  onPress?: () => void;
  detailSelected?: boolean;
  showdownSpotlightSelected?: boolean;
  showdownCardEmphasisByIndex?: Array<"neutral" | "highlighted" | "dimmed">;
  runItOddsPercentage?: number | null;
}

export default function PlayerBubble({
  player,
  seatIndex,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  seatSelectionLocked = false,
  onPress,
  detailSelected = false,
  showdownSpotlightSelected = false,
  showdownCardEmphasisByIndex = ["neutral", "neutral"],
  runItOddsPercentage = null,
}: PlayerBubbleProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const winGlowAnim = useRef(new Animated.Value(0)).current;
  const winBurstScale = useRef(new Animated.Value(1)).current;
  const winBurstOpacity = useRef(new Animated.Value(0)).current;
  const prevWinAnimKey = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (player?.isActor) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [player?.isActor, pulseAnim]);

  useEffect(() => {
    if (player?.winType) {
      const half = player.winType === "full" ? 725 : 650;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(winGlowAnim, {
            toValue: 1,
            duration: half,
            useNativeDriver: true,
          }),
          Animated.timing(winGlowAnim, {
            toValue: 0,
            duration: half,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        winGlowAnim.setValue(0);
      };
    } else {
      winGlowAnim.setValue(0);
    }
  }, [player?.winType, winGlowAnim]);

  useEffect(() => {
    if (
      !player?.winAnimationKey ||
      player.winAnimationKey === prevWinAnimKey.current
    )
      return;
    prevWinAnimKey.current = player.winAnimationKey;
    winBurstScale.setValue(1);
    winBurstOpacity.setValue(player.winType === "full" ? 1 : 0.92);
    const targetScale = player.winType === "full" ? 1.9 : 1.72;
    const duration = player.winType === "full" ? 1150 : 1000;
    Animated.parallel([
      Animated.timing(winBurstScale, {
        toValue: targetScale,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(winBurstOpacity, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    player?.winAnimationKey,
    player?.winType,
    winBurstScale,
    winBurstOpacity,
  ]);

  if (!player) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          seatSelectionLocked
            ? `Seat ${seatIndex + 1} unavailable after game starts`
            : `Empty seat ${seatIndex + 1}, tap to sit`
        }
        disabled={seatSelectionLocked}
        onPress={seatSelectionLocked ? undefined : onPress}
        style={styles.bubble}
      >
        <View
          style={[
            styles.emptySeatCircle,
            seatSelectionLocked && styles.emptySeatCircleLocked,
          ]}
        >
          <Text style={styles.emptySeatLabel}>Seat</Text>
          <Text style={styles.emptySeatNumber}>{seatIndex + 1}</Text>
        </View>
      </Pressable>
    );
  }

  const avatarColor = getAvatarColor(player.name);
  const initials = getInitials(player.name);
  const badge = resolvePrimaryBadge(player);
  const role = isDealer ? "D" : isSmallBlind ? "SB" : isBigBlind ? "BB" : null;

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const winGlowScale = winGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const visibleHoleCards =
    player.holeCards?.some(Boolean) ? player.holeCards : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Seat ${seatIndex + 1}, ${player.name}`}
      onPress={onPress}
      style={[
        styles.bubble,
        player.isFolded && styles.foldedBubble,
        player.isAway && !player.isFolded && styles.awayBubble,
      ]}
    >
      <View style={styles.avatarContainer}>
        {/* Glow / Pulse Effects */}
        {player.isActor && <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }] }]} />}
        {!!player.winType && <Animated.View style={[styles.winGlowRing, { transform: [{ scale: winGlowScale }] }]} />}

        {/* Selection Rings */}
        {detailSelected && <View style={styles.detailRing} />}
        {showdownSpotlightSelected && <View style={styles.spotlightRing} />}

        {/* Peek Eye Icon (Top Left) */}
        {player.hasCards && !player.isFolded && (() => {
          const pc = player.peekedCount ?? 0;
          return (
            <View style={[
              styles.peekBadge,
              pc === 0 ? styles.peekBadgeGray : pc === 1 ? styles.peekBadgeYellow : styles.peekBadgeGreen,
            ]}>
              <Text style={{ fontSize: 12 }}>
                {pc === 0 ? "➖" : pc === 1 ? "👁️" : "👀"}
              </Text>
            </View>
          );
        })()}

        {/* Role Badge (Top Right) */}
        {role && (
          <View style={[styles.roleCircle, role === "D" && styles.roleDealer]}>
            <Text style={[styles.roleText, role === "D" && styles.roleTextDealer]}>{role}</Text>
          </View>
        )}

        {/* Main Avatar Circle */}
        <View style={[styles.avatar, { backgroundColor: player.isViewer ? "#000000" : avatarColor }]}>
          <Text style={styles.avatarText}>{player.isViewer ? "YOU" : initials}</Text>
        </View>

        {/* Showdown hole cards overlay */}
        {visibleHoleCards && (
          <View style={styles.showdownRow}>
            {visibleHoleCards.map((card, index) => (
              <View key={index} style={[styles.showdownCard, card ? (isRedSuit(card.suit) ? styles.showdownCardRed : styles.showdownCardBlack) : styles.showdownCardBack]}>
                {card && <Text style={[styles.showdownCardText, isRedSuit(card.suit) && styles.showdownCardTextRed]}>{card.rank}{SUIT_SYMBOLS[card.suit]}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Primary Badge (Bet / Action) - Positioned to overlap bottom of avatar */}
      {badge && (
        <View style={[styles.primaryBadge, badge.kind !== "action" && styles.primaryBadgeGold]}>
          <Text style={[styles.primaryBadgeText, badge.kind !== "action" && styles.primaryBadgeDarkText]}>
            {badge.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: METRICS.containerWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarContainer: {
    width: METRICS.avatarSize,
    height: METRICS.avatarSize,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: METRICS.avatarSize,
    height: METRICS.avatarSize,
    borderRadius: METRICS.avatarSize / 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    overflow: "hidden",
  },
  foldedBubble: { opacity: 0.4 },
  awayBubble: { opacity: 0.6 },

  // ── Badges (Circular) ─────────────────────────────────────────────────────────
  roleCircle: {
    position: "absolute",
    top: METRICS.badgeInset,
    right: METRICS.badgeInset,
    width: METRICS.badgeSize,
    height: METRICS.badgeSize,
    borderRadius: METRICS.badgeSize / 2,
    backgroundColor: "#0b1427",
    borderWidth: 2,
    borderColor: "#f3d742",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  roleDealer: {
    backgroundColor: "#ffffff",
    borderColor: "#ef4444",
  },
  roleText: {
    color: "#f3d742",
    fontSize: 9,
    fontWeight: "900",
  },
  roleTextDealer: {
    color: "#ef4444",
  },
  peekBadge: {
    position: "absolute",
    top: METRICS.badgeInset,
    left: METRICS.badgeInset,
    width: METRICS.badgeSize,
    height: METRICS.badgeSize,
    borderRadius: METRICS.badgeSize / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  peekBadgeGray: { backgroundColor: "rgba(55,65,81,0.8)", borderColor: "rgba(107,114,128,0.4)" },
  peekBadgeYellow: { backgroundColor: "rgba(202,138,4,0.9)", borderColor: "rgba(250,204,21,0.5)" },
  peekBadgeGreen: { backgroundColor: "rgba(5,150,105,0.9)", borderColor: "rgba(52,211,153,0.5)" },

  // ── Primary (Bet) Badge (Pill) ───────────────────────────────────────────────
  primaryBadge: {
    position: "absolute",
    bottom: METRICS.primaryBadgeOffsetY,
    minWidth: METRICS.avatarSize, // Covers width of avatar
    height: METRICS.primaryBadgeHeight,
    paddingHorizontal: 8,
    borderRadius: METRICS.primaryBadgeHeight / 2, // Pill shape
    backgroundColor: "rgba(0,0,0,0.8)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  primaryBadgeGold: {
    backgroundColor: "#f3d742",
    borderColor: "#fef9c3",
  },
  primaryBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  primaryBadgeDarkText: {
    color: "#000000",
  },

  // ── Rings & Effects (Pulsing/Winning/Selection) ──────────────────────────────
  pulseRing: {
    position: "absolute",
    width: METRICS.avatarSize + 4,
    height: METRICS.avatarSize + 4,
    borderRadius: (METRICS.avatarSize + 4) / 2,
    borderWidth: 2.5,
    borderColor: "#ef4444",
  },
  winGlowRing: {
    position: "absolute",
    width: METRICS.avatarSize + 8,
    height: METRICS.avatarSize + 8,
    borderRadius: (METRICS.avatarSize + 8) / 2,
    borderWidth: 3,
    borderColor: "#f59e0b",
  },
  detailRing: {
    position: "absolute",
    width: METRICS.avatarSize + 6,
    height: METRICS.avatarSize + 6,
    borderRadius: (METRICS.avatarSize + 6) / 2,
    borderWidth: 2.5,
    borderColor: "#38bdf8",
  },
  spotlightRing: {
    position: "absolute",
    width: METRICS.avatarSize + 6,
    height: METRICS.avatarSize + 6,
    borderRadius: (METRICS.avatarSize + 6) / 2,
    borderWidth: 2.5,
    borderColor: "#f3d742",
  },

  // ── Text & Misc ─────────────────────────────────────────────────────────────
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  emptySeatCircle: {
    width: METRICS.avatarSize,
    height: METRICS.avatarSize,
    borderRadius: METRICS.avatarSize / 2,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(156,163,175,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptySeatCircleLocked: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  emptySeatLabel: { color: "#9ca3af", fontSize: 6, fontWeight: "900" },
  emptySeatNumber: { color: "#ffffff", fontSize: 14, fontWeight: "900" },

  showdownRow: {
    position: "absolute",
    flexDirection: "row",
    gap: 1,
    zIndex: 30,
    top: METRICS.showdownCardOffsetY,
  },
  showdownCard: {
    width: METRICS.showdownCardWidth,
    height: METRICS.showdownCardHeight,
    borderRadius: 3,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  showdownCardBack: { backgroundColor: "#1e3a5f" },
  showdownCardRed: { borderWidth: 1, borderColor: "#fca5a5" },
  showdownCardBlack: { borderWidth: 1, borderColor: "#94a3b8" },
  showdownCardText: { fontSize: 8, fontWeight: "900", color: "#000" },
  showdownCardTextRed: { color: "#ef4444" },
});
