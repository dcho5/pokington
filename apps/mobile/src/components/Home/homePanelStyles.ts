import { StyleSheet } from "react-native";
import { nativeLightTheme } from "@pokington/ui/native";

export const homePanelStyles = StyleSheet.create({
  panel: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 16,
    gap: 12,
    ...nativeLightTheme.shadow.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  title: {
    color: nativeLightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  largeTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    color: nativeLightTheme.colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  badgeLabel: {
    color: nativeLightTheme.colors.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  errorText: {
    color: nativeLightTheme.colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
});
