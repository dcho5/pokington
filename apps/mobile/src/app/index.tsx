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
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
  const [isLaunchActive, setIsLaunchActive] = useState(true);
  const [firstSceneLayout, setFirstSceneLayout] = useState<LayoutRectangle | null>(null);
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(null);
  const [brandLayout, setBrandLayout] = useState<LayoutRectangle | null>(null);
  const [brandChipLayout, setBrandChipLayout] = useState<LayoutRectangle | null>(null);
  const [blindIdx, setBlindIdx] = useState(0);
  const [bountyIdx, setBountyIdx] = useState(0);
  const [tableName, setTableName] = useState("");
  const [tableCode, setTableCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const requestHostname = useMemo(() => getExpoRequestHostname(), []);
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const launchProgress = useRef(new Animated.Value(0)).current;
  const menuIntroProgress = useRef(new Animated.Value(0)).current;

  const contentInset = useMemo(
    () => ({
      paddingTop: Math.max(18, height * 0.03),
      paddingBottom: Math.max(34, insets.bottom + 24),
    }),
    [height, insets.bottom],
  );

  const initialJoinReserve = Math.max(214, height * 0.24);
  const firstSceneMinHeight = Math.max(
    420,
    height - contentInset.paddingTop - contentInset.paddingBottom - initialJoinReserve,
  );

  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, 420],
    outputRange: [0, 236],
    extrapolate: "clamp",
  });
  const heroScale = scrollY.interpolate({
    inputRange: [0, 420],
    outputRange: [1, 0.86],
    extrapolate: "clamp",
  });
  const panelTranslateY = scrollY.interpolate({
    inputRange: [0, 260],
    outputRange: [0, 8],
    extrapolate: "clamp",
  });
  const launchChipSize = 92;
  const heroChipSize = 54;
  const launchTitleSize = 34;
  const launchChipCenterY = height * 0.5 - 26;
  const launchTitleCenterY = height * 0.5 + 53;
  const measuredHeaderX = (firstSceneLayout?.x ?? 18) + (headerLayout?.x ?? 0);
  const measuredHeaderY = (firstSceneLayout?.y ?? contentInset.paddingTop) + (headerLayout?.y ?? 0);
  const finalChipCenterX = brandChipLayout
    ? measuredHeaderX + brandChipLayout.x + brandChipLayout.width / 2
    : width / 2 + Math.min(150, width * 0.36);
  const finalChipCenterY = brandChipLayout
    ? measuredHeaderY + brandChipLayout.y + brandChipLayout.height / 2
    : contentInset.paddingTop + firstSceneMinHeight / 2;
  const finalBrandCenterX = brandLayout
    ? measuredHeaderX + brandLayout.x + brandLayout.width / 2
    : width / 2 - 42;
  const finalBrandCenterY = brandLayout
    ? measuredHeaderY + brandLayout.y + brandLayout.height / 2
    : contentInset.paddingTop + firstSceneMinHeight / 2;
  const logoLayoutReady = !!firstSceneLayout && !!headerLayout && !!brandLayout && !!brandChipLayout;
  const brandLaunchTranslateX = launchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [width / 2 - finalBrandCenterX, 0],
  });
  const brandLaunchTranslateY = launchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [launchTitleCenterY - finalBrandCenterY, 0],
  });
  const brandLaunchScale = launchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [launchTitleSize / 52, 1],
  });
  const chipLaunchTranslateX = launchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [width / 2 - finalChipCenterX, 0],
  });
  const chipLaunchTranslateY = launchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [launchChipCenterY - finalChipCenterY, 0],
  });
  const chipLaunchScale = launchProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [1, launchChipSize / 90, heroChipSize / launchChipSize],
  });
  const panelIntroOpacity = menuIntroProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const panelIntroTranslateY = menuIntroProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  useEffect(() => {
    if (!logoLayoutReady) return undefined;

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(launchProgress, {
          toValue: 1,
          duration: 860,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(690),
          Animated.timing(menuIntroProgress, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) setIsLaunchActive(false);
      });
    }, 620);

    return () => {
      clearTimeout(timer);
      launchProgress.stopAnimation();
      menuIntroProgress.stopAnimation();
    };
  }, [launchProgress, logoLayoutReady, menuIntroProgress]);

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

  const renderJoinPanel = () => (
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
  );

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
          <View
            onLayout={(event) => setFirstSceneLayout(event.nativeEvent.layout)}
            style={[styles.firstScene, { minHeight: firstSceneMinHeight }]}
          >
            <Animated.View
              onLayout={(event) => setHeaderLayout(event.nativeEvent.layout)}
              style={[styles.header, { transform: [{ translateY: heroTranslateY }, { scale: heroScale }] }]}
            >
              <Animated.Text
                onLayout={(event) => setBrandLayout(event.nativeEvent.layout)}
                style={[
                  styles.brand,
                  {
                    transform: [
                      { translateX: brandLaunchTranslateX },
                      { translateY: brandLaunchTranslateY },
                      { scale: brandLaunchScale },
                    ],
                  },
                ]}
              >
                Pokington
              </Animated.Text>
              <Animated.View
                onLayout={(event) => setBrandChipLayout(event.nativeEvent.layout)}
                style={[
                  styles.brandChip,
                  {
                    transform: [
                      { translateX: chipLaunchTranslateX },
                      { translateY: chipLaunchTranslateY },
                      { scale: chipLaunchScale },
                    ],
                  },
                ]}
              >
                <NativePokerChip size={launchChipSize} />
              </Animated.View>
            </Animated.View>
          </View>

          <Animated.View
            pointerEvents={isLaunchActive ? "none" : "auto"}
            style={[
              styles.finalPanelStack,
              {
                opacity: panelIntroOpacity,
                transform: [{ translateY: panelTranslateY }, { translateY: panelIntroTranslateY }],
              },
            ]}
          >
            <View style={styles.swipeHandle} />
            {renderJoinPanel()}
            <View style={styles.createSection}>
              <View style={styles.joinHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Create</Text>
                  <Text style={styles.sectionSubtitle}>Set stakes, create, share link.</Text>
                </View>
                <Text style={styles.codeLabel}>New</Text>
              </View>

              <NativeTextField
                label=""
                value={tableName}
                onChangeText={setTableName}
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                }}
                returnKeyType="done"
                blurOnSubmit
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
  keyboard: {
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    gap: 16,
  },
  firstScene: {
    justifyContent: "center",
  },
  header: {
    flex: 1,
    minHeight: 260,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  brand: {
    color: nativeLightTheme.colors.text,
    fontSize: 52,
    fontWeight: "900",
    lineHeight: 58,
  },
  brandChip: {
    width: 92,
    height: 92,
    marginHorizontal: (54 - 92) / 2,
  },
  finalPanelStack: {
    gap: 20,
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
    padding: 16,
    gap: 12,
    ...nativeLightTheme.shadow.surface,
  },
  sectionTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 4,
    color: nativeLightTheme.colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  selectorBlock: {
    gap: 6,
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
    gap: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 16,
    ...nativeLightTheme.shadow.surface,
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
