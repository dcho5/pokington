import { useNativeTheme, type NativeTheme } from "@pokington/ui/native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface FooterStatusBannerProps {
  message: string | null;
  tone?: "neutral" | "active";
  isFloating?: boolean;
}

export default function FooterStatusBanner({ message, tone = "neutral", isFloating = false }: FooterStatusBannerProps) {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!message) return null;

  return (
    <View style={isFloating ? styles.wrapFloating : styles.wrap}>
      <View style={[styles.pill, tone === "active" && styles.activePill, isFloating && styles.pillFloating, isFloating && tone === "active" && styles.activePillFloating]}>
        <Text style={[styles.text, tone === "active" && styles.activeText]} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </View>
  );
}

function createStyles(t: NativeTheme) { return StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  wrapFloating: {
    alignItems: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  pill: {
    maxWidth: "80%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 5,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  pillFloating: {
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceSoft,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  activePill: {
    borderColor: "rgba(248,113,113,0.36)",
    backgroundColor: t.colors.accentTint,
    shadowColor: "#ef4444",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  activePillFloating: {
    borderColor: "rgba(248,113,113,0.28)",
    backgroundColor: t.colors.accentTintStrong,
    shadowOpacity: 0.14,
  },
  text: {
    color: t.colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  activeText: {
    color: "#b91c1c",
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
}); }
