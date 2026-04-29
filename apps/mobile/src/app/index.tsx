import { env } from "@pokington/config";
import { normalizePartyKitHost } from "@pokington/network";
import {
  NativeButton as SharedNativeButton,
  NativePanel as SharedNativePanel,
  NativeTextField as SharedNativeTextField,
  StatusPill as SharedStatusPill,
} from "@pokington/ui/native";
import { tokens } from "@pokington/ui";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const NativeButton = SharedNativeButton as React.ComponentType<any>;
const NativePanel = SharedNativePanel as React.ComponentType<any>;
const NativeTextField = SharedNativeTextField as React.ComponentType<any>;
const StatusPill = SharedStatusPill as React.ComponentType<any>;

export default function HomeScreen() {
  const [tableCode, setTableCode] = useState("");
  const normalizedHost = useMemo(
    () => (env.partyKitHost ? normalizePartyKitHost(env.partyKitHost) : null),
    [],
  );
  const canJoin = tableCode.trim().length > 0;

  const joinTable = () => {
    const code = tableCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/table/${encodeURIComponent(code)}` as never);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <StatusPill label="Mobile table client" />
            <Text style={styles.title}>Pokington</Text>
            <Text style={styles.subtitle}>Join an active table and play from the native client.</Text>
          </View>

          <NativePanel>
            <NativeTextField
              label="Table code"
              value={tableCode}
              onChangeText={(value: string) => setTableCode(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
              onSubmitEditing={joinTable}
              returnKeyType="go"
              placeholder="ABC123"
              maxLength={12}
            />
            <NativeButton label="Join Table" disabled={!canJoin} onPress={joinTable} />
          </NativePanel>

          <NativePanel>
            <Text style={styles.panelTitle}>Connection</Text>
            <Text style={styles.bodyText}>
              Realtime host: {normalizedHost ?? "set EXPO_PUBLIC_PARTYKIT_HOST to connect outside local dev"}
            </Text>
          </NativePanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.lg,
  },
  header: {
    gap: tokens.spacing.md,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 40,
    fontWeight: "900",
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 17,
    lineHeight: 24,
  },
  panelTitle: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  bodyText: {
    color: tokens.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
