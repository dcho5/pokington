import { useNativeTheme, type NativeTheme } from "@pokington/ui/native";
import { BlurView } from "expo-blur";
import React, { useMemo } from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";

interface FooterStatusBannerProps {
  message: string | null;
  tone?: "neutral" | "active";
  isFloating?: boolean;
}

export default function FooterStatusBanner({ message, tone = "neutral", isFloating = false }: FooterStatusBannerProps) {
  const theme = useNativeTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!message) return null;

  return (
    <View style={isFloating ? styles.wrapFloating : styles.wrap}>
      <View style={[styles.pill, tone === "active" && styles.activePill, isFloating && styles.pillFloating, isFloating && tone === "active" && styles.activePillFloating]}>
        <BlurView
          intensity={55}
          tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
          style={StyleSheet.absoluteFill}
        />
        {tone === "active" && (
          <View style={[StyleSheet.absoluteFill, styles.activeOverlay, isFloating && styles.activeOverlayFloating]} />
        )}
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
    overflow: "hidden",
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
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  activePill: {
    borderColor: "rgba(248,113,113,0.36)",
    shadowColor: "#ef4444",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  activePillFloating: {
    borderColor: "rgba(248,113,113,0.28)",
    shadowOpacity: 0.14,
  },
  activeOverlay: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderRadius: 999,
  },
  activeOverlayFloating: {
    backgroundColor: "rgba(239,68,68,0.14)",
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
