import { StyleSheet } from "react-native";
import { tokens } from "./tokens";

export const nativeThemeStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  panel: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  pill: {
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
});
