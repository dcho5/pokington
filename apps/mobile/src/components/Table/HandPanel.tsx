import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { NativeHoleCards, nativeLightTheme } from "@pokington/ui/native";
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
  autoPeelEnabled: boolean;
  revealedToOthersIndices?: Set<0 | 1>;
  peekedCardIndices?: Set<0 | 1>;
  /** Tapping the identity card opens the add-chips / rebuy sheet. */
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
  autoPeelEnabled,
  revealedToOthersIndices,
  peekedCardIndices,
  onIdentityPress,
  onPeekCard,
  onRevealCard,
  onToggleAutoPeel,
}: HandPanelProps) {
  const { width: screenWidth } = useWindowDimensions();
  // cardsArea width = screenWidth - 2*8 (panel padding) - 2*78 (side cards) - 2*8 (gaps)
  const cardAreaWidth = screenWidth - 188;
  const cardWidth = Math.floor((cardAreaWidth - 5) / 2);
  const cardHeight = Math.min(142, Math.round(cardWidth * 7 / 5));

  const handLabel = useMemo(
    () => computeHandLabel(holeCards, communityCards),
    [holeCards, communityCards],
  );

  const avatarColor = viewer ? getAvatarColor(viewer.name) : "#436a15";
  const initials = viewer ? getInitials(viewer.name) : "IN";

  return (
    <View style={styles.panel}>
      {/* Left: identity */}
      <Pressable
        accessibilityRole={viewer ? "button" : undefined}
        onPress={onIdentityPress}
        style={styles.identityCard}
      >
        <View style={[styles.viewerAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.viewerAvatarText}>{initials}</Text>
          {viewer ? (
            <View style={styles.youDot} pointerEvents="none">
              <Text style={styles.youDotText}>YOU</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.viewerName} numberOfLines={1}>
          {viewer?.name ?? "Not seated"}
        </Text>

        <Pressable
          onPress={onToggleAutoPeel}
          accessibilityRole="switch"
          accessibilityState={{ checked: autoPeelEnabled }}
          accessibilityLabel="Auto peel"
          hitSlop={6}
          style={[styles.autoPeelToggle, autoPeelEnabled && styles.autoPeelToggleActive]}
        >
          <Text
            style={[
              styles.autoPeelGlyph,
              autoPeelEnabled && styles.autoPeelGlyphActive,
            ]}
          >
            👁
          </Text>
        </Pressable>

        <Text style={styles.viewerMeta} numberOfLines={1}>
          {viewer ? "ADD CHIPS" : "tap a seat"}
        </Text>
      </Pressable>

      {/* Center: hole cards */}
      <View style={styles.cardsArea}>
        {holeCards ? (
          <NativeHoleCards
            cards={holeCards}
            cardHeight={cardHeight}
            autoReveal={autoPeelEnabled}
            canRevealToOthers
            revealedToOthersIndices={revealedToOthersIndices}
            peekedCardIndices={peekedCardIndices}
            onPeekCard={onPeekCard}
            onRevealToOthers={onRevealCard}
          />
        ) : (
          <View style={styles.noCardsWrap}>
            <Text style={styles.noCardsText}>No cards</Text>
          </View>
        )}
      </View>

      {/* Right: stack / hand / bet */}
      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>STACK</Text>
        <Text style={styles.stackValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {viewer ? formatCents(viewer.stack) : "--"}
        </Text>

        <View style={styles.statsDivider} />

        <Text style={styles.statsLabel}>HAND</Text>
        <Text style={styles.statsValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {handLabel}
        </Text>

        {(viewer?.currentBet ?? 0) > 0 ? (
          <View style={styles.betPill}>
            <Text style={styles.betPillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCents(viewer!.currentBet)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: 154,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: 8,
  },

  identityCard: {
    width: 78,
    minWidth: 78,
    alignItems: "center",
    justifyContent: "space-evenly",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 6,
    paddingVertical: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  viewerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerAvatarText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  // Small "YOU" badge tucked at the avatar's bottom-right corner.
  youDot: {
    position: "absolute",
    bottom: -3,
    right: -8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: nativeLightTheme.colors.accent,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  youDotText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  viewerName: {
    maxWidth: "100%",
    color: nativeLightTheme.colors.text,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  autoPeelToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  autoPeelToggleActive: {
    backgroundColor: "#0f172a",
    borderColor: "transparent",
  },
  autoPeelGlyph: {
    fontSize: 13,
    color: nativeLightTheme.colors.muted,
  },
  autoPeelGlyphActive: {
    color: "#fbbf24",
  },
  viewerMeta: {
    color: nativeLightTheme.colors.muted,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  cardsArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noCardsWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noCardsText: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  statsCard: {
    width: 78,
    minWidth: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 2,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  statsLabel: {
    color: "#9ca3af",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  statsValue: {
    maxWidth: "100%",
    color: nativeLightTheme.colors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  statsDivider: {
    height: 1,
    width: "70%",
    backgroundColor: "rgba(148,163,184,0.22)",
    marginVertical: 4,
  },
  betPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#facc15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    maxWidth: "100%",
  },
  betPillText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "900",
  },
  stackValue: {
    maxWidth: "100%",
    color: nativeLightTheme.colors.text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
});
