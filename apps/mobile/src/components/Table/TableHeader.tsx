import React from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { BlurView } from "expo-blur";
import { NativeIconButton, useNativeTheme, type NativeTheme } from "@pokington/ui/native";
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
  const theme = useNativeTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const styles = createStyles(theme);

  return (
    <View style={styles.header}>
      <BlurView
        intensity={72}
        tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
        style={StyleSheet.absoluteFill}
      />
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

function createStyles(theme: NativeTheme) {
  return StyleSheet.create({
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
      backgroundColor: theme.colors.border,
    },
    backButtonOffset: {
      marginLeft: -4,
      flexShrink: 0,
    },
    backArrow: {
      color: theme.colors.text,
      fontSize: 28,
      lineHeight: 30,
      fontWeight: "500",
      marginTop: -2,
    },
    tableName: {
      flexShrink: 1,
      flexGrow: 1,
      minWidth: 0,
      color: theme.colors.text,
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
      color: theme.colors.muted,
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
      color: theme.colors.text,
      fontSize: 22,
      lineHeight: 24,
      fontWeight: "900",
    },
  });
}
