import { StyleSheet } from "react-native";
import type { NativeTheme } from "@pokington/ui/native";

export function createHomePanelStyles(t: NativeTheme) {
  return StyleSheet.create({
    panel: {
      borderRadius: 26,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      padding: 16,
      gap: 12,
      ...t.shadow.surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 16,
    },
    title: {
      color: t.colors.text,
      fontSize: 20,
      fontWeight: "900",
    },
    largeTitle: {
      color: t.colors.text,
      fontSize: 24,
      fontWeight: "900",
    },
    subtitle: {
      marginTop: 4,
      color: t.colors.muted,
      fontSize: 13,
      fontWeight: "800",
    },
    badgeLabel: {
      color: t.colors.faint,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 6,
      textTransform: "uppercase",
    },
    errorText: {
      color: t.colors.accent,
      fontSize: 13,
      fontWeight: "800",
    },
  });
}
