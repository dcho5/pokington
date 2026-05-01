import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCents } from "@pokington/shared";

interface TableHeaderProps {
  tableName: string;
  blinds: { small: number; big: number } | null;
  sevenTwoBountyBB?: number | null;
  onBack: () => void;
  onMenu: () => void;
}

export default function TableHeader({ tableName, blinds, sevenTwoBountyBB, onBack, onMenu }: TableHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backArrow}>‹</Text>
      </Pressable>

      <Text style={styles.tableName} numberOfLines={1}>
        {tableName}
      </Text>

      {!!(sevenTwoBountyBB ?? 0) && (
        <View style={styles.bountyPill}>
          <Text style={styles.bountyText}>7-2 {sevenTwoBountyBB}×</Text>
        </View>
      )}

      {blinds ? (
        <View style={styles.blindsPill}>
          <Text style={styles.blindsText}>
            {formatCents(blinds.small)} / {formatCents(blinds.big)}
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Table menu"
        onPress={onMenu}
        style={styles.menuButton}
      >
        <Text style={styles.menuDots}>⋮</Text>
      </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
    backgroundColor: "#fbfbfc",
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
    flexShrink: 0,
  },
  backArrow: {
    color: "#111827",
    fontSize: 42,
    lineHeight: 42,
    fontWeight: "500",
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
  bountyPill: {
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    backgroundColor: "rgba(255,237,237,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bountyText: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "900",
  },
  blindsPill: {
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  blindsText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "900",
  },
  menuButton: {
    flexShrink: 0,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  menuDots: {
    color: "#111827",
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "900",
  },
});
