import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { NativeBottomSheet, NativeCard, useNativeTheme, type NativeTheme } from "@pokington/ui/native";
import { formatCents } from "@pokington/shared";
import type { TablePlayer } from "./PlayerBubble";

interface OpponentDetailSheetProps {
  player: TablePlayer | null;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  runItOddsPercentage?: number | null;
  onDismiss: () => void;
}

function labelizeAction(action?: string | null) {
  if (!action) return null;
  if (action === "all-in") return "All-in";
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export default function OpponentDetailSheet({
  player,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  runItOddsPercentage = null,
  onDismiss,
}: OpponentDetailSheetProps) {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isVisible = player != null;

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isVisible]);

  const statusLabel = player
    ? labelizeAction(player.lastAction) ?? (player.isActor ? "ACTION" : "In Hand")
    : null;
  const previewCards = player?.holeCards ?? [null, null];

  return (
    <NativeBottomSheet visible={player != null} onDismiss={onDismiss}>
      {player ? (
        <>
          {/* Header: name+seat left, badges right */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.seatLabel}>Seat {player.seatIndex + 1}</Text>
              <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            </View>
            <View style={styles.badgesWrap}>
              {player.isViewer && (
                <View style={[styles.badge, styles.badgeYou]}>
                  <Text style={[styles.badgeText, styles.badgeYouText]}>You</Text>
                </View>
              )}
              {isDealer && (
                <View style={[styles.badge, styles.badgeDealer]}>
                  <Text style={[styles.badgeText, styles.badgeDealerText]}>Dealer</Text>
                </View>
              )}
              {isSmallBlind && (
                <View style={[styles.badge, styles.badgePosition]}>
                  <Text style={[styles.badgeText, styles.badgePositionText]}>Small Blind</Text>
                </View>
              )}
              {isBigBlind && (
                <View style={[styles.badge, styles.badgePosition]}>
                  <Text style={[styles.badgeText, styles.badgePositionText]}>Big Blind</Text>
                </View>
              )}
              {player.isAway && (
                <View style={[styles.badge, styles.badgeAway]}>
                  <Text style={[styles.badgeText, styles.badgeAwayText]}>Away</Text>
                </View>
              )}
              {player.isFolded && (
                <View style={[styles.badge, styles.badgeMuted]}>
                  <Text style={[styles.badgeText, styles.badgeMutedText]}>Folded</Text>
                </View>
              )}
              {player.isAllIn && (
                <View style={[styles.badge, styles.badgeAway]}>
                  <Text style={[styles.badgeText, styles.badgeAwayText]}>All-in</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stack + Cards */}
          <View style={styles.stackCardsRow}>
            <View style={[styles.box, styles.stackBox]}>
              <Text style={styles.boxLabel}>Stack</Text>
              <Text style={styles.stackValue}>{formatCents(player.stack)}</Text>
            </View>
            <View style={styles.cardsRow}>
              {previewCards.map((card, index) => (
                <NativeCard
                  key={card ? `${card.rank}${card.suit}` : `hidden-${index}`}
                  card={card}
                  hidden={!card}
                  compact
                  style={styles.card}
                />
              ))}
            </View>
          </View>

          {/* State box */}
          <View style={styles.box}>
            <View style={styles.stateBoxInner}>
              <View>
                <Text style={styles.boxLabel}>State</Text>
                <Text style={styles.stateValue}>{statusLabel ?? "In Hand"}</Text>
              </View>
              {runItOddsPercentage != null && (
                <View style={styles.oddsBadge}>
                  <Text style={styles.oddsBadgeText}>
                    {runItOddsPercentage.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
            {(player.currentBet ?? 0) > 0 && (
              <Text style={styles.liveBet}>
                Live bet {formatCents(player.currentBet ?? 0)}
              </Text>
            )}
          </View>
        </>
      ) : null}
    </NativeBottomSheet>
  );
}

function createStyles(t: NativeTheme) { return StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  seatLabel: {
    color: t.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  playerName: {
    color: t.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
    maxWidth: "55%",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  badgeYou: {
    backgroundColor: "rgba(254,226,226,0.95)",
    borderColor: "rgba(252,165,165,0.6)",
  },
  badgeYouText: {
    color: "#dc2626",
  },
  badgeDealer: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  badgeDealerText: {
    color: t.colors.text,
  },
  badgePosition: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  badgePositionText: {
    color: t.colors.text,
  },
  badgeAway: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(252,211,77,0.35)",
  },
  badgeAwayText: {
    color: "#d97706",
  },
  badgeMuted: {
    backgroundColor: "rgba(107,114,128,0.10)",
    borderColor: "rgba(209,213,219,0.35)",
  },
  badgeMutedText: {
    color: t.colors.muted,
  },

  stackCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  box: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stackBox: {
    flex: 1,
    marginBottom: 0,
  },
  boxLabel: {
    color: t.colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  stackValue: {
    color: t.colors.text,
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  cardsRow: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    width: 42,
    height: 58,
    borderRadius: 8,
  },

  stateBoxInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  stateValue: {
    color: t.colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  oddsBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(252,165,165,0.30)",
    backgroundColor: "rgba(239,68,68,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  oddsBadgeText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  liveBet: {
    marginTop: 8,
    color: "#d97706",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
}); }
