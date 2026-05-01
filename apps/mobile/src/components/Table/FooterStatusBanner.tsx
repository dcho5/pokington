import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface FooterStatusBannerProps {
  message: string | null;
}

export default function FooterStatusBanner({ message }: FooterStatusBannerProps) {
  if (!message) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.text} numberOfLines={1}>
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
  text: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
