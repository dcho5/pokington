import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeCard, nativeLightTheme } from "@pokington/ui/native";
import { evaluateBest } from "@pokington/engine";
import { formatCents } from "@pokington/shared";
import type { Card } from "@pokington/shared";
import { getAvatarColor, getInitials } from "./avatarColor";

interface HandPanelPlayer {
  id: string;
  name: string;
  stack: number;
  currentBet: number;
  isFolded: boolean;
  isViewer?: boolean;
}

interface HandPanelProps {
  viewer: HandPanelPlayer | null;
  holeCards: [Card, Card] | null;
  communityCards: Card[];
  leaveQueued: boolean;
  autoPeelEnabled: boolean;
  onIdentityPress: () => void;
  onPeekCard: (index: 0 | 1) => void;
  onRevealCard: (index: 0 | 1) => void;
  onToggleAutoPeel: () => void;
}

function computeHandLabel(holeCards: [Card, Card] | null, communityCards: Card[]): string {
  if (!holeCards) return "--";
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return "--";
  try {
    const result = evaluateBest(allCards);
    return result.label;
  } catch {
    return "--";
  }
}

export default function HandPanel({
  viewer,
  holeCards,
  communityCards,
  leaveQueued,
  autoPeelEnabled,
  onIdentityPress,
  onPeekCard,
  onRevealCard,
  onToggleAutoPeel,
}: HandPanelProps) {
  const handLabel = useMemo(
    () => computeHandLabel(holeCards, communityCards),
    [holeCards, communityCards],
  );

  const avatarColor = viewer ? getAvatarColor(viewer.name) : "#436a15";
  const initials = viewer ? getInitials(viewer.name) : "IN";

  return (
    <View style={styles.panel}>
      {/* Left: identity + auto-peel */}
      <Pressable
        accessibilityRole={viewer ? "button" : undefined}
        onPress={onIdentityPress}
        style={styles.identityCard}
      >
        {viewer ? (
          <View style={styles.youBadgeWrap}>
            <Text style={styles.youBadge}>YOU</Text>
          </View>
        ) : null}

        <View style={[styles.viewerAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.viewerAvatarText}>{initials}</Text>
        </View>

        <Text style={styles.viewerName} numberOfLines={1}>
          {viewer?.name ?? "Not seated"}
        </Text>

        <Pressable onPress={onToggleAutoPeel} style={[styles.autoPeelPill, autoPeelEnabled && styles.autoPeelPillActive]}>
          <Text style={[styles.autoPeelText, autoPeelEnabled && styles.autoPeelTextActive]}>
            AUTO PEEL
          </Text>
        </Pressable>

        <Text style={styles.viewerMeta} numberOfLines={1}>
          {viewer ? (leaveQueued ? "LEAVING" : "TAP TO LEAVE") : "tap an open seat"}
        </Text>
      </Pressable>

      {/* Center: hole cards */}
      <View style={styles.cardsArea}>
        {([0, 1] as const).map((index) => {
          const card = holeCards?.[index] ?? null;
          return (
            <Pressable
              key={`hole-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Hole card ${index + 1}`}
              onPress={() => onPeekCard(index)}
              onLongPress={() => onRevealCard(index)}
              style={styles.holeCardWrap}
            >
              <NativeCard card={card} hidden={!card} style={styles.holeCard} />
            </Pressable>
          );
        })}
      </View>

      {/* Right: hand / bet / stack */}
      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>HAND</Text>
        <Text style={styles.statsValue} numberOfLines={1}>{handLabel}</Text>

        {(viewer?.currentBet ?? 0) > 0 ? (
          <>
            <Text style={styles.statsLabel}>BET</Text>
            <View style={styles.betPill}>
              <Text style={styles.betPillText}>{formatCents(viewer!.currentBet)}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.statsLabel}>STACK</Text>
        <Text style={styles.stackValue}>{viewer ? formatCents(viewer.stack) : "--"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: 154,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },

  identityCard: {
    width: 110,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  youBadgeWrap: {
    alignSelf: "stretch",
    alignItems: "flex-start",
  },
  youBadge: {
    overflow: "hidden",
    borderRadius: 7,
    backgroundColor: "#fee2e2",
    color: nativeLightTheme.colors.accent,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerAvatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  viewerName: {
    maxWidth: "100%",
    color: nativeLightTheme.colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  autoPeelPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.06)",
  },
  autoPeelPillActive: {
    backgroundColor: "#0f172a",
    borderColor: "transparent",
  },
  autoPeelText: {
    color: nativeLightTheme.colors.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  autoPeelTextActive: {
    color: "#fbbf24",
  },
  viewerMeta: {
    color: nativeLightTheme.colors.muted,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  cardsArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 10,
  },
  holeCardWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  holeCard: {
    width: "100%",
    maxWidth: 84,
  },

  statsCard: {
    width: 100,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 3,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  statsLabel: {
    color: "#9ca3af",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  statsValue: {
    color: nativeLightTheme.colors.text,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  betPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#facc15",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  betPillText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "900",
  },
  stackValue: {
    color: nativeLightTheme.colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
});
