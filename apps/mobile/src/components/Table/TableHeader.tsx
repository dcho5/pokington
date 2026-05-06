import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { NativeIconButton } from "@pokington/ui/native";
import { formatCents } from "@pokington/shared";

interface TableHeaderProps {
  tableName: string;
  blinds: { small: number; big: number } | null;
  sevenTwoBountyBB?: number | null;
  onBack: () => void;
  onMenu: () => void;
}

export default function TableHeader({ tableName, blinds, sevenTwoBountyBB, onBack, onMenu }: TableHeaderProps) {
  const hasBounty = !!(sevenTwoBountyBB ?? 0);

  return (
    <View style={styles.header}>
      <BlurView intensity={72} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.headerBottomLine} />

      <NativeIconButton
        size={38}
        icon={<Text style={styles.backArrow}>‹</Text>}
        onPress={onBack}
        accessibilityLabel="Go back"
        style={styles.backButtonOffset}
      />

      <Text style={styles.tableName} numberOfLines={1}>
        {tableName}
      </Text>

      {/* Stacked info column — same container regardless of bounty so tableName never shifts */}
      <View style={styles.pillStack}>
        {blinds ? (
          <Text style={styles.blindsText} numberOfLines={1}>
            {formatCents(blinds.small)}/{formatCents(blinds.big)}
          </Text>
        ) : null}
        {hasBounty ? (
          <Text style={styles.bountyText} numberOfLines={1}>
            7-2 · {sevenTwoBountyBB}× Bounty
          </Text>
        ) : null}
      </View>

      <NativeIconButton
        size={38}
        icon={<Text style={styles.menuDots}>⋮</Text>}
        onPress={onMenu}
        accessibilityLabel="Table menu"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  headerBottomLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  backButtonOffset: {
    marginLeft: -4,
    flexShrink: 0,
  },
  backArrow: {
    color: "#111827",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "500",
    marginTop: -2,
  },
  tableName: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  pillStack: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
  },
  blindsText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  bountyText: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "800",
  },
  menuDots: {
    color: "#111827",
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "900",
  },
});
