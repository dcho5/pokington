import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { nativeLightTheme } from "@pokington/ui/native";
import { getAvatarColor, getInitials } from "./avatarColor";

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
}

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
    const compact = dollars >= 10000
      ? Math.round(dollars / 1000)
      : Math.round(dollars / 100) / 10;
    return `$${compact}k`;
  }
  if (dollars >= 10) return `$${dollars.toFixed(1)}`;
  return `$${dollars.toFixed(2)}`;
}

function resolvePrimaryBadge(player: TablePlayer): { kind: "bet" | "all-in" | "action"; label: string } | null {
  if (player.currentBet > 0 && !player.isFolded) {
    return { kind: "bet", label: formatBetAmount(player.currentBet) };
  }
  if (player.isAllIn) return { kind: "all-in", label: "ALL IN" };
  if (player.lastAction) {
    return { kind: "action", label: ACTION_LABELS[player.lastAction] ?? player.lastAction.toUpperCase() };
  }
  return null;
}

interface PlayerBubbleProps {
  player: TablePlayer | null;
  seatIndex: number;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  seatSelectionLocked?: boolean;
  onPress?: () => void;
}

export default function PlayerBubble({
  player,
  seatIndex,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  seatSelectionLocked = false,
  onPress,
}: PlayerBubbleProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (player?.isActor) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [player?.isActor, pulseAnim]);

  if (!player) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Empty seat ${seatIndex + 1}`}
        disabled={seatSelectionLocked}
        onPress={onPress}
        style={[styles.bubble, styles.emptyBubble, seatSelectionLocked && styles.lockedBubble]}
      >
        <Text style={styles.emptySeatLabel}>SEAT</Text>
        <Text style={styles.emptySeatNumber}>{seatIndex + 1}</Text>
      </Pressable>
    );
  }

  const avatarColor = getAvatarColor(player.name);
  const initials = player.isViewer ? "YOU" : getInitials(player.name);
  const badge = resolvePrimaryBadge(player);
  const roles = [
    isDealer ? "D" : null,
    isSmallBlind ? "SB" : null,
    isBigBlind ? "BB" : null,
  ].filter(Boolean) as string[];

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Seat ${seatIndex + 1}, ${player.name}`}
      onPress={onPress}
      style={[styles.bubble, player.isFolded && styles.foldedBubble]}
    >
      {/* Actor pulse ring */}
      {player.isActor && (
        <Animated.View
          style={[
            styles.pulseRing,
            { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
          ]}
        />
      )}

      {/* Role badges top-left */}
      {roles.length > 0 && (
        <View style={styles.rolesColumn}>
          {roles.map((role) => (
            <View key={role} style={[styles.roleBadge, role === "D" && styles.roleBadgeDealer]}>
              <Text style={styles.roleBadgeText}>{role}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          { backgroundColor: avatarColor },
          player.isActor && styles.avatarActorRing,
          player.isViewer && styles.avatarViewerRing,
        ]}
      >
        <Text style={[styles.avatarText, player.isViewer && styles.avatarTextYou]}>{initials}</Text>
      </View>

      {/* Name below avatar */}
      <Text style={styles.playerName} numberOfLines={1}>{player.name.split(" ")[0]}</Text>

      {/* Primary badge (bet / all-in / action) */}
      {badge ? (
        <View style={[styles.primaryBadge, badge.kind === "bet" && styles.betBadge, badge.kind === "all-in" && styles.allInBadge]}>
          <Text style={[styles.primaryBadgeText, badge.kind === "bet" && styles.betBadgeText]}>{badge.label}</Text>
        </View>
      ) : null}

      {/* Peek indicator dot */}
      {player.hasCards && !player.isFolded && !player.isViewer && (
        <View style={styles.peekDot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: 60,
    alignItems: "center",
  },
  emptyBubble: {
    justifyContent: "center",
  },
  lockedBubble: {
    opacity: 0.4,
  },
  foldedBubble: {
    opacity: 0.38,
  },

  pulseRing: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#ef4444",
    top: 0,
  },

  rolesColumn: {
    position: "absolute",
    top: 0,
    left: -4,
    gap: 2,
    zIndex: 10,
  },
  roleBadge: {
    minWidth: 20,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f3d742",
    backgroundColor: "#0b1427",
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadgeDealer: {
    borderColor: "#ffffff",
    backgroundColor: "#1e3a5f",
  },
  roleBadgeText: {
    color: "#f3d742",
    fontSize: 6,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActorRing: {
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  avatarViewerRing: {
    borderWidth: 1.5,
    borderColor: "rgba(244,114,182,0.7)",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  avatarTextYou: {
    fontSize: 9,
  },

  playerName: {
    marginTop: 3,
    color: "rgba(255,255,255,0.82)",
    fontSize: 9,
    fontWeight: "700",
    maxWidth: 56,
    textAlign: "center",
  },

  primaryBadge: {
    position: "absolute",
    bottom: -14,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  betBadge: {
    backgroundColor: "#f3d742",
    borderWidth: 1,
    borderColor: "rgba(255,255,220,0.5)",
  },
  allInBadge: {
    backgroundColor: "#ef4444",
  },
  primaryBadgeText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 8,
    fontWeight: "900",
  },
  betBadgeText: {
    color: "#000000",
  },

  peekDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#60a5fa",
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },

  emptySeatLabel: {
    color: "rgba(148,163,184,0.7)",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  emptySeatNumber: {
    color: "rgba(148,163,184,0.75)",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 1,
  },
});
