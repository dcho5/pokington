import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface FooterStatusBannerProps {
  message: string | null;
  tone?: "neutral" | "active";
  isFloating?: boolean;
}

export default function FooterStatusBanner({ message, tone = "neutral", isFloating = false }: FooterStatusBannerProps) {
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

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  wrapFloating: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  pill: {
    maxWidth: "80%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  pillFloating: {
    borderColor: "rgba(148,163,184,0.16)",
    backgroundColor: "rgba(255,255,255,0.58)",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  activePill: {
    borderColor: "rgba(248,113,113,0.36)",
    backgroundColor: "rgba(255,241,242,0.96)",
    shadowColor: "#ef4444",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  activePillFloating: {
    borderColor: "rgba(248,113,113,0.28)",
    backgroundColor: "rgba(255,241,242,0.62)",
    shadowOpacity: 0.14,
  },
  text: {
    color: "#6b7280",
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
});
