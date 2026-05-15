import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getAvatarColor, getInitials } from "@pokington/shared";
import type { Card } from "@pokington/shared";
import { PeekEyeIcon } from "@pokington/ui/native";

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
  showdownCardWidth: 20,
  showdownCardHeight: 17,
  showdownCardSpreadX: 9,
  showdownCardOffsetY: 4,
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

  const initiallyVisible = !!(player?.holeCards?.some(Boolean));
  const showdownRevealAnim = useRef(new Animated.Value(initiallyVisible ? 1 : 0)).current;
  const prevVisibleHoleCardsRef = useRef<boolean>(initiallyVisible);

  // Pop-in when a player first occupies a seat (key change causes remount)
  const mountScale = useRef(new Animated.Value(player ? 0.55 : 1)).current;
  const mountOpacity = useRef(new Animated.Value(player ? 0 : 1)).current;

  useEffect(() => {
    if (!player) return;
    Animated.parallel([
      Animated.spring(mountScale, {
        toValue: 1,
        tension: 280,
        friction: 16,
        useNativeDriver: true,
      }),
      Animated.timing(mountOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (player?.isActor) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(350),
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

  const visibleNow = !!(player?.holeCards?.some(Boolean));
  useEffect(() => {
    const wasVisible = prevVisibleHoleCardsRef.current;
    prevVisibleHoleCardsRef.current = visibleNow;
    if (visibleNow && !wasVisible) {
      showdownRevealAnim.setValue(0);
      Animated.spring(showdownRevealAnim, {
        toValue: 1,
        tension: 340,
        friction: 15,
        useNativeDriver: true,
      }).start();
    } else if (!visibleNow) {
      showdownRevealAnim.setValue(0);
    }
  }, [visibleNow, showdownRevealAnim]);

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
          <Text style={[styles.emptySeatLabel, seatSelectionLocked && styles.emptySeatTextLocked]}>Seat</Text>
          <Text style={[styles.emptySeatNumber, seatSelectionLocked && styles.emptySeatTextLocked]}>{seatIndex + 1}</Text>
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
    outputRange: [1.0, 1.45],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0.55, 0],
  });
  const winGlowScale = winGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const visibleHoleCards = visibleNow ? player.holeCards : null;
  const showRunItOdds =
    runItOddsPercentage != null && Number.isFinite(runItOddsPercentage);

  return (
    <Animated.View style={{ transform: [{ scale: mountScale }], opacity: mountOpacity }}>
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
        {player.isActor && <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />}
        {!!player.winType && <Animated.View style={[styles.winGlowRing, { transform: [{ scale: winGlowScale }] }]} />}

        {/* Selection Rings */}
        {detailSelected && <View style={styles.detailRing} />}
        {showdownSpotlightSelected && <View style={styles.spotlightRing} />}

        {/* Peek Eye Icon (Top Left) */}
        {player.hasCards && !player.isFolded && (() => {
          const pc = player.peekedCount ?? 0;
          const iconColor = pc === 0 ? "#9ca3af" : pc === 1 ? "#fde047" : "#34d399";
          return (
            <View style={[
              styles.peekBadge,
              pc === 0 ? styles.peekBadgeGray : pc === 1 ? styles.peekBadgeYellow : styles.peekBadgeGreen,
            ]}>
              <PeekEyeIcon count={pc} size={14} strokeWidth={2.5} color={iconColor} />
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
        <View
          style={[
            styles.avatar,
            showRunItOdds
              ? styles.runItOddsAvatar
              : { backgroundColor: player.isViewer ? "#000000" : avatarColor },
          ]}
        >
          {showRunItOdds ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[
                styles.runItOddsAvatarText,
                runItOddsPercentage >= 100 && styles.runItOddsAvatarTextCompact,
              ]}
            >
              {runItOddsPercentage.toFixed(1)}%
            </Text>
          ) : (
            <Text style={styles.avatarText}>{player.isViewer ? "YOU" : initials}</Text>
          )}
        </View>

        {/* Showdown hole cards overlay */}
        {visibleHoleCards && (
          <Animated.View style={[
            styles.showdownRow,
            {
              opacity: showdownRevealAnim,
              transform: [{
                scale: showdownRevealAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.55, 1],
                }),
              }],
            },
          ]}>
            {visibleHoleCards.map((card, index) => (
              <View key={index} style={[styles.showdownCard, card ? (isRedSuit(card.suit) ? styles.showdownCardRed : styles.showdownCardBlack) : styles.showdownCardBack]}>
                {card && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.showdownCardText, isRedSuit(card.suit) && styles.showdownCardTextRed]}>{card.rank}{SUIT_SYMBOLS[card.suit]}</Text>}
              </View>
            ))}
          </Animated.View>
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
    </Animated.View>
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
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 3,
  },
  roleDealer: {
    borderColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  roleText: {
    color: "#ffffff",
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
  runItOddsAvatar: {
    backgroundColor: "#dc2626",
    borderWidth: 1,
    borderColor: "rgba(254,226,226,0.46)",
    shadowColor: "#7f1d1d",
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  runItOddsAvatarText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    includeFontPadding: false,
  },
  runItOddsAvatarTextCompact: {
    fontSize: 10,
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
    backgroundColor: "rgba(7,17,29,0.65)",
    borderColor: "rgba(255,255,255,0.08)",
    borderStyle: "solid",
  },
  emptySeatLabel: { color: "#9ca3af", fontSize: 6, fontWeight: "900" },
  emptySeatNumber: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  emptySeatTextLocked: { color: "rgba(255,255,255,0.32)" },

  showdownRow: {
    position: "absolute",
    flexDirection: "row",
    gap: 1,
    zIndex: 30,
    top: METRICS.avatarSize / 2 + METRICS.showdownCardOffsetY,
    left: (METRICS.avatarSize - (METRICS.showdownCardWidth * 2 + 1)) / 2,
  },
  showdownCard: {
    width: METRICS.showdownCardWidth,
    height: METRICS.showdownCardHeight,
    borderRadius: 4,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    overflow: "hidden",
  },
  showdownCardBack: { backgroundColor: "#1e3a5f" },
  showdownCardRed: { borderWidth: 1, borderColor: "#fca5a5" },
  showdownCardBlack: { borderWidth: 1, borderColor: "#94a3b8" },
  showdownCardText: { fontSize: 10, fontWeight: "900", color: "#000", lineHeight: 10, includeFontPadding: false },
  showdownCardTextRed: { color: "#ef4444" },
});
