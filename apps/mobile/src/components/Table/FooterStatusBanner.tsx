import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface FooterStatusBannerProps {
  message: string | null;
  tone?: "neutral" | "active";
}

export default function FooterStatusBanner({ message, tone = "neutral" }: FooterStatusBannerProps) {
  if (!message) return null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, tone === "active" && styles.activePill]}>
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
  activePill: {
    borderColor: "rgba(248,113,113,0.36)",
    backgroundColor: "rgba(255,241,242,0.96)",
    shadowColor: "#ef4444",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
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
