import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeBottomSheet, NativeCard, nativeLightTheme } from "@pokington/ui/native";
import { formatCents } from "@pokington/shared";
import { getAvatarColor, getInitials } from "./avatarColor";
import type { TablePlayer } from "./PlayerBubble";

interface OpponentDetailSheetProps {
  player: TablePlayer | null;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  onDismiss: () => void;
}

export default function OpponentDetailSheet({
  player,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  onDismiss,
}: OpponentDetailSheetProps) {
  return (
    <NativeBottomSheet visible={player != null} onDismiss={onDismiss}>
      {player ? (
        <>
          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: getAvatarColor(player.name) },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(player.name)}</Text>
            </View>
          </View>

          {/* Name + seat */}
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.seatLabel}>Seat {player.seatIndex + 1}</Text>

          {/* Position markers */}
          {(isDealer || isSmallBlind || isBigBlind) && (
            <View style={styles.markersRow}>
              {isDealer && (
                <View style={[styles.marker, styles.markerDealer]}>
                  <Text style={[styles.markerText, styles.markerDealerText]}>D</Text>
                </View>
              )}
              {isSmallBlind && (
                <View style={[styles.marker, styles.markerSB]}>
                  <Text style={[styles.markerText, styles.markerSBText]}>SB</Text>
                </View>
              )}
              {isBigBlind && (
                <View style={[styles.marker, styles.markerBB]}>
                  <Text style={[styles.markerText, styles.markerBBText]}>BB</Text>
                </View>
              )}
            </View>
          )}

          {/* State badges */}
          {(player.isFolded || player.isAllIn || player.isAway) && (
            <View style={styles.stateRow}>
              {player.isFolded && (
                <Text style={styles.stateBadge}>Folded</Text>
              )}
              {player.isAllIn && (
                <Text style={[styles.stateBadge, styles.stateBadgeAllIn]}>
                  All-in
                </Text>
              )}
              {player.isAway && (
                <Text style={styles.stateBadge}>Away</Text>
              )}
            </View>
          )}

          {/* Stack + bet */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>STACK</Text>
              <Text style={styles.statValue}>{formatCents(player.stack)}</Text>
            </View>
            {player.currentBet > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>BET</Text>
                <Text style={styles.statValue}>
                  {formatCents(player.currentBet)}
                </Text>
              </View>
            )}
          </View>

          {/* Revealed hole cards */}
          {player.holeCards?.some(Boolean) && (
            <View style={styles.cardsRow}>
              {player.holeCards.map((card, i) => (
                <NativeCard
                  key={i}
                  card={card}
                  hidden={!card}
                  style={styles.card}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </NativeBottomSheet>
  );
}

const styles = StyleSheet.create({
  avatarRow: {
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  playerName: {
    color: nativeLightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  seatLabel: {
    color: nativeLightTheme.colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 8,
  },

  markersRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  marker: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDealer: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(239,68,68,0.8)",
  },
  markerSB: {
    backgroundColor: "#020617",
    borderColor: "rgba(252,211,77,0.9)",
  },
  markerBB: {
    backgroundColor: "#020617",
    borderColor: "#facc15",
  },
  markerText: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  markerDealerText: {
    color: "#dc2626",
  },
  markerSBText: {
    color: "#fef3c7",
  },
  markerBBText: {
    color: "#fef9c3",
  },

  stateRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
  },
  stateBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.15)",
    color: nativeLightTheme.colors.muted,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stateBadgeAllIn: {
    backgroundColor: "rgba(251,191,36,0.15)",
    color: "#92400e",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    color: "#9ca3af",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  statValue: {
    color: nativeLightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  cardsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  card: {
    width: 60,
  },
});
