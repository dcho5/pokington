import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@pokington/config";
import {
  createNativeTable,
  getNativeTable,
  getOrCreateNativeClientId,
} from "@pokington/network";
import { BLIND_CENTS, BLIND_OPTIONS, BOUNTY_OPTIONS, BOUNTY_VALUES } from "@pokington/shared";
import {
  NativeButton,
  NativeOptionSelector,
  NativePokerChip,
  NativeTextField,
  nativeLightTheme,
} from "@pokington/ui/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getExpoRequestHostname } from "../lib/nativePartyHost";

function mapCreateError(error: unknown) {
  if (!(error instanceof Error)) return "Couldn’t create a table right now. Try again.";
  if (error.message === "CODE_ALLOCATION_FAILED") return "Couldn’t reserve a unique code. Try again.";
  if (error.message === "PARTYKIT_UNAVAILABLE") return "Realtime server unavailable. Restart `pnpm dev`.";
  return "Couldn’t create a table right now. Try again.";
}

function mapJoinError(error: unknown) {
  if (error instanceof Error && error.message === "PARTYKIT_UNAVAILABLE") {
    return "Realtime server unavailable. Restart `pnpm dev`.";
  }
  return "Couldn’t verify that table. Try again.";
}

export default function HomeScreen() {
  const [showLaunch, setShowLaunch] = useState(true);
  const [blindIdx, setBlindIdx] = useState(0);
  const [bountyIdx, setBountyIdx] = useState(0);
  const [tableName, setTableName] = useState("");
  const [tableCode, setTableCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const requestHostname = useMemo(() => getExpoRequestHostname(), []);
  const { height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const contentInset = useMemo(
    () => ({
      paddingTop: Math.max(72, Math.min(126, height * 0.15)),
      paddingBottom: Math.max(32, height * 0.16),
    }),
    [height],
  );

  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [0, 44],
    extrapolate: "clamp",
  });
  const heroScale = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [1, 0.96],
    extrapolate: "clamp",
  });
  const panelTranslateY = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [0, 18],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowLaunch(false), 1050);
    return () => clearTimeout(timer);
  }, []);

  const navigateToTable = useCallback((code: string) => {
    router.push(`/table/${encodeURIComponent(code.toUpperCase())}` as never);
  }, []);

  const handleCreate = useCallback(async () => {
    setCreateError(null);
    setIsCreating(true);
    try {
      const creatorClientId = await getOrCreateNativeClientId(AsyncStorage);
      const blinds = BLIND_CENTS[blindIdx] ?? BLIND_CENTS[0];
      const response = await createNativeTable({
        tableName: tableName.trim(),
        blinds,
        creatorClientId,
        sevenTwoBountyBB: BOUNTY_VALUES[bountyIdx],
      }, { explicitHost: env.partyKitHost, requestHostname });
      navigateToTable(response.code);
    } catch (error) {
      setCreateError(mapCreateError(error));
    } finally {
      setIsCreating(false);
    }
  }, [blindIdx, bountyIdx, navigateToTable, requestHostname, tableName]);

  const handleJoin = useCallback(async () => {
    const code = tableCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError("Table codes are exactly 6 characters.");
      return;
    }
    setJoinError(null);
    setIsJoining(true);
    try {
      const table = await getNativeTable(code, { explicitHost: env.partyKitHost, requestHostname });
      if (!table.exists || table.status !== "active") {
        setJoinError("Table not found. Check the code and try again.");
        return;
      }
      navigateToTable(code);
    } catch (error) {
      setJoinError(mapJoinError(error));
    } finally {
      setIsJoining(false);
    }
  }, [navigateToTable, requestHostname, tableCode]);

  if (showLaunch) {
    return (
      <SafeAreaView style={styles.launchScreen}>
        <NativePokerChip size={92} />
        <Text style={styles.launchTitle}>Pokington</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, contentInset]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
        >
          <Animated.View style={[styles.header, { transform: [{ translateY: heroTranslateY }, { scale: heroScale }] }]}>
            <Text style={styles.brand}>Pokington</Text>
            <NativePokerChip size={40} />
          </Animated.View>

          <Animated.View style={[styles.panelStack, { transform: [{ translateY: panelTranslateY }] }]}>
            <View style={styles.swipeHandle} />
            <View style={styles.createSection}>
              <View>
                <Text style={styles.sectionTitle}>Create</Text>
              </View>

              <NativeTextField
                label=""
                value={tableName}
                onChangeText={setTableName}
                onSubmitEditing={handleCreate}
                returnKeyType="go"
                placeholder="Table name"
                autoCapitalize="none"
              />

              <View style={styles.selectorBlock}>
                <Text style={styles.selectorLabel}>Blinds</Text>
                <NativeOptionSelector compact options={BLIND_OPTIONS} value={blindIdx} onChange={setBlindIdx} />
              </View>

              <View style={styles.selectorBlock}>
                <Text style={styles.selectorLabel}>Bounty</Text>
                <NativeOptionSelector compact options={BOUNTY_OPTIONS} value={bountyIdx} onChange={setBountyIdx} />
              </View>

              <NativeButton
                label={isCreating ? "Creating..." : "Create Table"}
                loading={isCreating}
                disabled={isCreating}
                onPress={handleCreate}
                style={styles.createButton}
              />
              {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
            </View>

            <View style={styles.joinSection}>
              <View style={styles.joinHeader}>
                <View>
                  <Text style={styles.joinTitle}>Join</Text>
                  <Text style={styles.joinSubtitle}>Enter a 6-character code.</Text>
                </View>
                <Text style={styles.codeLabel}>Code</Text>
              </View>
              <View style={styles.joinRow}>
                <NativeTextField
                  label=""
                  containerStyle={styles.codeField}
                  value={tableCode}
                  onChangeText={(value: string) => {
                    setTableCode(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase());
                    if (joinError) setJoinError(null);
                  }}
                  onSubmitEditing={handleJoin}
                  onFocus={() => {
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                  }}
                  returnKeyType="go"
                  placeholder="Table code"
                  autoCapitalize="characters"
                  maxLength={6}
                  style={styles.codeInput}
                />
                <NativeButton
                  label={isJoining ? "..." : "Join"}
                  disabled={isJoining}
                  loading={isJoining}
                  onPress={handleJoin}
                  style={styles.joinButton}
                />
              </View>
              {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: nativeLightTheme.colors.background,
  },
  launchScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: nativeLightTheme.colors.background,
  },
  launchTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 34,
    fontWeight: "900",
  },
  keyboard: {
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    gap: 18,
  },
  header: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  brand: {
    color: nativeLightTheme.colors.text,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 48,
  },
  panelStack: {
    gap: 14,
  },
  swipeHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: nativeLightTheme.colors.borderStrong,
  },
  createSection: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 12,
    gap: 9,
    ...nativeLightTheme.shadow.surface,
  },
  sectionTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  selectorBlock: {
    gap: 4,
  },
  selectorLabel: {
    color: nativeLightTheme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  createButton: {
    minHeight: 48,
    borderRadius: 18,
  },
  joinSection: {
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.88)",
    padding: 12,
    ...nativeLightTheme.shadow.soft,
  },
  joinHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  joinTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  joinSubtitle: {
    marginTop: 4,
    color: nativeLightTheme.colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  codeLabel: {
    color: nativeLightTheme.colors.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  joinRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  codeInput: {
    minHeight: 50,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  codeField: {
    flex: 1,
    minWidth: 0,
  },
  joinButton: {
    minWidth: 78,
    borderRadius: 18,
    backgroundColor: nativeLightTheme.colors.text,
    shadowOpacity: 0,
    elevation: 0,
  },
  errorText: {
    color: nativeLightTheme.colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
});
