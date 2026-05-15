import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@pokington/config";
import {
  createNativeTable,
  getNativeTable,
  getOrCreateNativeClientId,
  requestNativeQueuedSeatLeave,
} from "@pokington/network";
import { BLIND_CENTS, BOUNTY_VALUES } from "@pokington/shared";
import {
  NativePokerChip,
  useNativeTheme,
  type NativeTheme,
} from "@pokington/ui/native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
  type LayoutRectangle,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import CreateTablePanel from "../components/Home/CreateTablePanel";
import JoinTablePanel from "../components/Home/JoinTablePanel";
import LiveRejoinStrip from "../components/Home/LiveRejoinStrip";
import { getExpoRequestHostname } from "../lib/nativePartyHost";
import {
  getSeatedTables,
  removeSeatedTable,
  type SeatedTableRecord,
} from "../lib/seatedTables";

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
  const [seatedTables, setSeatedTables] = useState<SeatedTableRecord[]>([]);
  const [revealedLeaveCode, setRevealedLeaveCode] = useState<string | null>(null);
  const [leaveRecord, setLeaveRecord] = useState<SeatedTableRecord | null>(null);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [leavingCode, setLeavingCode] = useState<string | null>(null);

  const theme = useNativeTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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

  const panelTranslateY = scrollY.interpolate({
    inputRange: [0, 260],
    outputRange: [0, 8],
    extrapolate: "clamp",
  });

  const chipRenderSize = 108;
  const launchChipVisualSize = 92;
  const heroChipVisualSize = 54;
  const chipHeroScale = heroChipVisualSize / chipRenderSize;
  const chipLaunchStartScale = launchChipVisualSize / chipRenderSize;

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
    inputRange: [0, 1],
    outputRange: [chipLaunchStartScale, chipHeroScale],
  });

  const panelIntroOpacity = menuIntroProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const panelIntroTranslateY = menuIntroProgress.interpolate({
    inputRange: [0, 0.4],
    outputRange: [18, 0],
  });

  const createPanelCatchupTranslateY = scrollY.interpolate({
    inputRange: [0, 510],
    outputRange: [144, 0],
    extrapolate: "clamp",
  });

  const liveStripTop = insets.top + 18;
  const topBlurHeight = insets.top;

  const liveStripTranslateY = useMemo((): Animated.AnimatedInterpolation<number> => {
    const STRIP_VIS_H = 66;
    const GUARD_GAP = 8;

    const heroTopY0 = contentInset.paddingTop + firstSceneMinHeight / 2 - 29;
    const stripBottomY0 = liveStripTop + STRIP_VIS_H;
    const gap0 = heroTopY0 - stripBottomY0;

    const SV1 = -10 / 160;
    const SV2 = -105 / 360;
    const HERO_V = 236 / 420 - 1;

    let lockS: number;
    if (gap0 <= GUARD_GAP) {
      lockS = 0;
    } else {
      const close1 = HERO_V - SV1;
      const gapAt160 = gap0 + close1 * 160;
      if (gapAt160 <= GUARD_GAP) {
        lockS = (gap0 - GUARD_GAP) / (-close1);
      } else {
        const close2 = HERO_V - SV2;
        lockS = 160 + (gapAt160 - GUARD_GAP) / (-close2);
      }
    }
    lockS = Math.max(0, Math.min(lockS, 520));

    const tyAtLock = lockS <= 160
      ? SV1 * lockS
      : -10 + SV2 * (lockS - 160);

    const tyAt420 = lockS < 420
      ? tyAtLock + HERO_V * (420 - lockS)
      : tyAtLock;

    const tyAt1500 = tyAt420 - (1500 - 420);

    const inp: number[] = [];
    const out: number[] = [];
    const add = (x: number, y: number) => {
      if (inp.length === 0 || inp[inp.length - 1] !== x) {
        inp.push(x);
        out.push(y);
      }
    };

    add(0, 0);
    if (lockS > 160) add(160, -10);
    add(lockS, tyAtLock);
    if (lockS < 420) add(420, tyAt420);
    add(1500, tyAt1500);

    return scrollY.interpolate({ inputRange: inp, outputRange: out, extrapolate: "clamp" });
  }, [scrollY, contentInset.paddingTop, firstSceneMinHeight, liveStripTop]);

  const refreshSeatedTables = useCallback(async () => {
    setSeatedTables(await getSeatedTables(AsyncStorage));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSeatedTables();
    }, [refreshSeatedTables]),
  );

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

  const removeSavedTable = useCallback(async (code: string) => {
    setSeatedTables(await removeSeatedTable(AsyncStorage, code));
    setRevealedLeaveCode((current) => (current === code ? null : current));
  }, []);

  const handleCreate = useCallback(async () => {
    setCreateError(null);
    setIsCreating(true);
    try {
      const creatorClientId = await getOrCreateNativeClientId(AsyncStorage);
      const blinds = BLIND_CENTS[blindIdx] ?? BLIND_CENTS[0];
      const response = await createNativeTable(
        {
          tableName: tableName.trim(),
          blinds,
          creatorClientId,
          sevenTwoBountyBB: BOUNTY_VALUES[bountyIdx],
        },
        { explicitHost: env.partyKitHost, requestHostname },
      );
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

  const handleRejoin = useCallback(async (record: SeatedTableRecord) => {
    setRejoinError(null);
    try {
      const table = await getNativeTable(record.code, { explicitHost: env.partyKitHost, requestHostname });
      if (!table.exists || table.status !== "active") {
        await removeSavedTable(record.code);
        setRejoinError("That table is no longer live.");
        return;
      }
      navigateToTable(record.code);
    } catch (error) {
      if (error instanceof Error && error.message === "TABLE_NOT_FOUND") {
        await removeSavedTable(record.code);
        setRejoinError("That table is no longer live.");
        return;
      }
      setRejoinError(mapJoinError(error));
    }
  }, [navigateToTable, removeSavedTable, requestHostname]);

  const handleConfirmLeave = useCallback(async () => {
    if (!leaveRecord) return;
    const code = leaveRecord.code;
    setRejoinError(null);
    setLeavingCode(code);
    try {
      const clientId = await getOrCreateNativeClientId(AsyncStorage);
      await requestNativeQueuedSeatLeave(code, clientId, {
        explicitHost: env.partyKitHost,
        requestHostname,
      });
      await removeSavedTable(code);
      setLeaveRecord(null);
    } catch (error) {
      if (error instanceof Error && (error.message === "TABLE_NOT_FOUND" || error.message === "PLAYER_NOT_SEATED")) {
        await removeSavedTable(code);
        setLeaveRecord(null);
        setRejoinError("That seat is no longer live.");
        return;
      }
      setRejoinError("Couldn’t leave that seat right now. Try again.");
    } finally {
      setLeavingCode(null);
    }
  }, [leaveRecord, removeSavedTable, requestHostname]);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, contentInset]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
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
              style={[
                styles.header,
                {
                  opacity: logoLayoutReady ? 1 : 0,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
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
                  styles.brandChipSlot,
                  {
                    transform: [
                      { translateX: chipLaunchTranslateX },
                      { translateY: chipLaunchTranslateY },
                    ],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.brandChipInner,
                    {
                      width: chipRenderSize,
                      height: chipRenderSize,
                      transform: [{ scale: chipLaunchScale }],
                    },
                  ]}
                  renderToHardwareTextureAndroid
                >
                  <NativePokerChip size={chipRenderSize} />
                </Animated.View>
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
            <JoinTablePanel
              tableCode={tableCode}
              joinError={joinError}
              isJoining={isJoining}
              onChangeTableCode={(value) => {
                setTableCode(value);
                if (joinError) setJoinError(null);
              }}
              onJoin={handleJoin}
            />
            <Animated.View
              style={{
                transform: [{ translateY: createPanelCatchupTranslateY }],
              }}
            >
              <CreateTablePanel
                tableName={tableName}
                blindIdx={blindIdx}
                bountyIdx={bountyIdx}
                createError={createError}
                isCreating={isCreating}
                onChangeTableName={setTableName}
                onTableNameFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                }}
                onChangeBlindIdx={setBlindIdx}
                onChangeBountyIdx={setBountyIdx}
                onCreate={handleCreate}
              />
            </Animated.View>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <View pointerEvents={isLaunchActive ? "none" : "box-none"} style={styles.overlayLayer}>
        <LiveRejoinStrip
          records={seatedTables}
          top={liveStripTop}
          translateY={liveStripTranslateY}
          opacity={panelIntroOpacity}
          revealedCode={revealedLeaveCode}
          leaveRecord={leaveRecord}
          error={rejoinError}
          leavingCode={leavingCode}
          onRejoin={handleRejoin}
          onRevealLeave={(code) => setRevealedLeaveCode((current) => (current === code ? null : code))}
          onCancelReveal={() => setRevealedLeaveCode(null)}
          onRequestLeave={setLeaveRecord}
          onCancelLeave={() => setLeaveRecord(null)}
          onConfirmLeave={handleConfirmLeave}
        />
        <View pointerEvents="none" style={[styles.topBlurLayer, { height: topBlurHeight }]}>
          <BlurView
            intensity={42}
            tint={colorScheme === "dark" ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={colorScheme === "dark"
              ? ["rgba(7,17,29,0.9)", "rgba(7,17,29,0.6)", "rgba(7,17,29,0.28)", "rgba(7,17,29,0.08)", "rgba(7,17,29,0)"]
              : ["rgba(246,245,247,0.9)", "rgba(246,245,247,0.6)", "rgba(246,245,247,0.28)", "rgba(246,245,247,0.08)", "rgba(246,245,247,0)"]}
            locations={[0, 0.35, 0.65, 0.88, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(t: NativeTheme) { return StyleSheet.create({
  screen: {
    flex: 1,
    position: "relative",
    backgroundColor: t.colors.background,
  },
  overlayLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
  topBlurLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: 60,
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
    color: t.colors.text,
    fontSize: 52,
    fontWeight: "900",
    lineHeight: 58,
  },
  brandChipSlot: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },

  brandChipInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  finalPanelStack: {
    gap: 20,
  },
  swipeHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: t.colors.borderStrong,
  },
}); }
