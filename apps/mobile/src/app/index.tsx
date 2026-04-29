import { createDeck } from "@pokington/engine";
import { env } from "@pokington/config";
import { NETWORK_PACKAGE_STATUS, normalizePartyKitHost } from "@pokington/network";
import { tokens } from "@pokington/ui";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const sampleBoard = createDeck()
  .slice(0, 5)
  .map((card) => `${card.rank}${card.suit[0].toUpperCase()}`);

export default function HomeScreen() {
  const normalizedHost = env.partyKitHost ? normalizePartyKitHost(env.partyKitHost) : "not set";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SDK 55 scaffold</Text>
          <Text style={styles.title}>Pokington Mobile</Text>
          <Text style={styles.subtitle}>
            This app is intentionally minimal: it proves Expo SDK 55, Expo Dev Client,
            and shared workspace package resolution without changing the current web UX.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Workspace Resolution</Text>
          <Text style={styles.rowLabel}>@pokington/engine</Text>
          <Text style={styles.rowValue}>Sample board: {sampleBoard.join(" ")}</Text>
          <Text style={styles.rowLabel}>@pokington/config</Text>
          <Text style={styles.rowValue}>PartyKit host: {normalizedHost}</Text>
          <Text style={styles.rowLabel}>@pokington/network</Text>
          <Text style={styles.rowValue}>Status: {NETWORK_PACKAGE_STATUS}</Text>
          <Text style={styles.rowLabel}>@pokington/ui</Text>
          <Text style={styles.rowValue}>Accent token: {tokens.colors.accent}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Next Steps</Text>
          <Text style={styles.bullet}>Build native table screens against the shared connection contract.</Text>
          <Text style={styles.bullet}>Wire AsyncStorage and AppState into the mobile table lifecycle.</Text>
          <Text style={styles.bullet}>Keep web and native message handling on the same adapter test suite.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07111d",
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.lg,
  },
  hero: {
    gap: tokens.spacing.sm,
  },
  eyebrow: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: tokens.colors.text,
    fontSize: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  panelTitle: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  rowLabel: {
    color: tokens.colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: tokens.spacing.sm,
  },
  rowValue: {
    color: tokens.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  bullet: {
    color: tokens.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
