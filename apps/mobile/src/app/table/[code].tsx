import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@pokington/config";
import {
  requestNativeJoinToken,
  useGameConnection,
  type JoinTokenResponse,
  type PartyKitServerMessage,
} from "@pokington/network";
import {
  NativeBottomSheet,
  NativeButton,
  NativeListRow,
  NativePanel,
  NativePokerChip,
  NativeTextField,
  deriveNativeBoundaryControl,
  useNativeTheme,
  type NativeTheme,
  type PlayerSummary,
  NativeSeatManager,
} from "@pokington/ui/native";
import { useRaiseAmount } from "@pokington/ui";
import {
  readPersistedAutoPeelPreference,
  writePersistedAutoPeelPreference,
} from "@pokington/ui/lib/holeCardReveal";
import {
  buildShowdownSpotlight,
  mergeEmphasisArrays,
  type Emphasis,
} from "@pokington/ui/lib/showdownSpotlight";
import { formatCents, getBuyInPresets } from "@pokington/shared";
import { LinearGradient } from "expo-linear-gradient";
import {
  BOMB_POT_VOTING_TIMEOUT_MS,
  RUN_IT_VOTING_TIMEOUT_MS,
  buildRunItOddsContext,
  calculateExactRunItOdds,
  calculateFinalRunItOdds,
  createMonteCarloOddsAccumulator,
  createSeededRng,
  hashSeed,
  shouldShowRunItOddsPanel,
  type BombPotAnteBB,
  type GameEvent,
  type GameFeedbackCueEnvelope,
  type RunResult,
  type WinnerInfo,
} from "@pokington/engine";
import type { Card } from "@pokington/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import ReAnimated, {
  Easing as ReEasing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Haptics, playNativeFeedbackHaptic } from "../../lib/haptics";
import { getExpoRequestHostname } from "../../lib/nativePartyHost";
import { removeSeatedTable, upsertSeatedTable } from "../../lib/seatedTables";

import TableHeader from "../../components/Table/TableHeader";
import OpponentStrip from "../../components/Table/OpponentStrip";
import type { TablePlayer } from "../../components/Table/PlayerBubble";
import HandPanel from "../../components/Table/HandPanel";
import FooterStatusBanner from "../../components/Table/FooterStatusBanner";
import OpponentDetailSheet from "../../components/Table/OpponentDetailSheet";
import CommunityCards from "../../components/Table/CommunityCards";
import {
  DynamicPotPanel,
  type BombPotDecisionAnnouncement,
  type DynamicPotMode,
  type LedgerSummaryInfo,
  type PotIslandRect,
} from "../../components/Table/DynamicPotPanel";
import { LedgerOverlay } from "../../components/Table/LedgerOverlay";
import { useTimedPanelVisibility } from "../../components/Table/useTimedPanelVisibility";
import FeltReconnectDim from "../../components/Table/FeltReconnectDim";

const PROTOCOL_VERSION = 4;
const MAX_SEATS = 10;
const DEFAULT_BUY_IN_CENTS = 10_000;
const DEG_PER_RAD = 180 / Math.PI;
const CHIP_HIGHLIGHT_BASE_ANGLE = Math.atan2(35 - 50, 62 - 50) * DEG_PER_RAD;
const DEFAULT_CHIP_ANGLE = -90 - CHIP_HIGHLIGHT_BASE_ANGLE;
const MOBILE_CHIP_POINT = { x: 0.5, y: 0.66 };
const RUN_IT_ODDS_SAMPLE_COUNT = 20_000;
const RUN_IT_ODDS_SAMPLE_BATCH_SIZE = 1_000;
const RUN_IT_BOARD_CARD_COUNT = 5;

const MOBILE_VIEWPORT_COLUMN_X = [0.1, 0.3, 0.5, 0.7, 0.9];
const MOBILE_VIEWPORT_ROW_Y = [0.13, 0.205];
const CLOCKWISE_GRID_POSITIONS = [
  { row: 0, column: 2 },
  { row: 0, column: 3 },
  { row: 0, column: 4 },
  { row: 1, column: 4 },
  { row: 1, column: 3 },
  { row: 1, column: 2 },
  { row: 1, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: 0 },
  { row: 0, column: 1 },
] as const;

interface PublicPlayer {
  id: string;
  name: string;
  seatIndex: number;
  stack: number;
  currentBet: number;
  totalContribution?: number;
  isFolded: boolean;
  isAllIn: boolean;
  hasCards?: boolean;
  lastAction?: string | null;
  sitOutUntilBB?: boolean;
}

interface PublicTableState {
  phase: string;
  tableName: string;
  players: Record<string, PublicPlayer>;
  communityCards: Card[];
  communityCards2?: Card[];
  pot: number;
  roundBet: number;
  lastLegalRaiseIncrement?: number;
  isBlindIncomplete?: boolean;
  blinds: { small: number; big: number };
  sevenTwoBountyBB?: number;
  handNumber: number;
  needsToAct: string[];
  closedActors?: string[];
  dealerSeatIndex?: number;
  smallBlindSeatIndex?: number;
  bigBlindSeatIndex?: number;
  winners: WinnerInfo[] | null;
  runItVotes?: Record<string, 1 | 2 | 3>;
  runCount?: 1 | 2 | 3;
  runResults?: RunResult[];
  runItVotingStartedAt?: number | null;
  runDealStartedAt?: number | null;
  runAnnouncement?: 1 | 2 | 3 | null;
  knownCardCount?: number;
  knownCardCountAtRunIt?: number;
  showdownStartedAt?: number | null;
  nextHandStartsAt?: number | null;
  isRunItBoard?: boolean;
  isBombPot?: boolean;
  bombPotVote?: {
    anteBB: BombPotAnteBB;
    proposedBy: string;
    votes: Record<string, boolean>;
  } | null;
  bombPotVotingStartedAt?: number | null;
  bombPotNextHand?: { anteBB: BombPotAnteBB } | null;
  bombPotCooldown?: string[];
  pendingBoundaryUpdates?: Record<string, PendingBoundaryUpdate>;
}

interface LedgerEntry {
  playerId: string;
  name: string;
  buyIns: number[];
  cashOuts: number[];
  isSeated: boolean;
  currentStack: number;
}

interface PendingBoundaryUpdate {
  playerId: string;
  leaveSeat: boolean;
  moveToSeatIndex: number | null;
  chipDelta: number;
  requestedAt?: number;
}

interface LedgerRow {
  playerId: string;
  name: string;
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
  isSeated: boolean;
}

interface PayoutInstruction {
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  amount: number;
}

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MobileServerMessage =
  | PartyKitServerMessage<PublicTableState>
  | { type: "PRIVATE_STATE"; holeCards: [Card, Card] | null; revealedHoleCards: Record<string, [Card | null, Card | null]>; peekedCardMask?: number }
  | {
      type: "ROOM_PRESENCE";
      connectedPlayerIds: string[];
      awayPlayerIds: string[];
      peekedCounts: Record<string, number>;
      queuedLeavePlayerIds: string[];
    }
  | { type: "LEDGER_STATE"; entries: LedgerEntry[] }
  | { type: "ERROR"; code: string; message: string };

function cents(amount: number | null | undefined): string {
  return formatCents(amount ?? 0);
}

function computeAngleBetweenPoints(
  fromPoint: { x: number; y: number },
  toPoint: { x: number; y: number },
) {
  return Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x) * DEG_PER_RAD;
}

function computeChipFacingAngle(
  fromPoint: { x: number; y: number },
  toPoint: { x: number; y: number },
) {
  return computeAngleBetweenPoints(fromPoint, toPoint) - CHIP_HIGHLIGHT_BASE_ANGLE;
}

function getMobileSeatPoint({
  seatIndex,
  viewerSeatIndex = null,
  totalSeats = MAX_SEATS,
}: {
  seatIndex: number | null;
  viewerSeatIndex?: number | null;
  totalSeats?: number;
}) {
  if (seatIndex == null || seatIndex < 0 || seatIndex >= totalSeats) return null;

  const gridPosition = CLOCKWISE_GRID_POSITIONS[seatIndex];
  if (!gridPosition) return null;

  return {
    x: MOBILE_VIEWPORT_COLUMN_X[gridPosition.column],
    y: MOBILE_VIEWPORT_ROW_Y[gridPosition.row],
  };
}

function computeMobileChipAngle({
  actorSeatIndex,
  viewerSeatIndex = null,
  totalSeats = MAX_SEATS,
}: {
  actorSeatIndex: number | null;
  viewerSeatIndex?: number | null;
  totalSeats?: number;
}) {
  if (actorSeatIndex !== null && viewerSeatIndex !== null && actorSeatIndex === viewerSeatIndex) {
    return computeChipFacingAngle(MOBILE_CHIP_POINT, { x: 0.5, y: 1.0 });
  }
  const actorPoint = getMobileSeatPoint({ seatIndex: actorSeatIndex, viewerSeatIndex, totalSeats });
  if (!actorPoint) return DEFAULT_CHIP_ANGLE;
  return computeChipFacingAngle(MOBILE_CHIP_POINT, actorPoint);
}

function rectsMatch(a: LayoutRect | null, b: LayoutRect) {
  return !!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function clampRunItCardCount(count: number | null | undefined) {
  return Math.max(0, Math.min(RUN_IT_BOARD_CARD_COUNT, count ?? 0));
}

function deriveRunItOddsVisibleRunState(
  runResults: RunResult[],
  knownCardCount: number,
  totalRuns = Math.max(1, runResults.length),
) {
  if (runResults.length === 0) {
    return { currentRun: 0, revealedCount: knownCardCount };
  }

  const clampedKnownCardCount = clampRunItCardCount(knownCardCount);
  const counts = Array.from({ length: Math.max(1, totalRuns) }, (_, runIndex) => {
    const runBoardLength = runResults[runIndex]?.board?.length;
    return clampRunItCardCount(runBoardLength ?? clampedKnownCardCount);
  });
  const activeRun = counts.reduce<number>(
    (current, count, runIndex) => (count > clampedKnownCardCount ? runIndex : current),
    -1,
  );

  return {
    currentRun: activeRun === -1 ? 0 : activeRun,
    revealedCount: counts[activeRun === -1 ? 0 : activeRun] ?? clampedKnownCardCount,
  };
}

function isPublicShowdownRevealComplete(state: PublicTableState | null) {
  if (!state || state.phase !== "showdown") return false;
  const runResults = state.runResults ?? [];
  if (runResults.length === 0) return true;

  const expectedRuns = Math.max(state.runCount ?? 1, runResults.length, 1);
  if (runResults.length < expectedRuns) return false;

  return runResults
    .slice(0, expectedRuns)
    .every((run) => (run.board?.length ?? 0) >= RUN_IT_BOARD_CARD_COUNT);
}

function centerOf(rect: LayoutRect, origin = { x: 0, y: 0 }) {
  return {
    x: origin.x + rect.x + rect.width / 2,
    y: origin.y + rect.y + rect.height / 2,
  };
}

function sumAmounts(amounts: number[] | undefined): number {
  return (amounts ?? []).reduce((sum, amount) => sum + amount, 0);
}

function derivePayoutInstructions(rows: LedgerRow[]): PayoutInstruction[] {
  const creditors = rows
    .filter((r) => r.net > 0)
    .map((r) => ({ ...r, rem: r.net }))
    .sort((a, b) => b.rem - a.rem);
  const debtors = rows
    .filter((r) => r.net < 0)
    .map((r) => ({ ...r, rem: -r.net }))
    .sort((a, b) => b.rem - a.rem);
  const payouts: PayoutInstruction[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].rem, debtors[di].rem);
    if (amount > 0) {
      payouts.push({
        fromPlayerId: debtors[di].playerId,
        fromName: debtors[di].name,
        toPlayerId: creditors[ci].playerId,
        toName: creditors[ci].name,
        amount,
      });
    }
    creditors[ci].rem -= amount;
    debtors[di].rem -= amount;
    if (creditors[ci].rem === 0) ci += 1;
    if (debtors[di].rem === 0) di += 1;
  }
  return payouts;
}

function deriveLedgerRows(entries: LedgerEntry[]): LedgerRow[] {
  return entries.map((entry) => {
    const totalBuyIn = sumAmounts(entry.buyIns);
    const realizedCashOut = sumAmounts(entry.cashOuts);
    const totalCashOut = realizedCashOut + (entry.isSeated ? entry.currentStack : 0);
    return {
      playerId: entry.playerId,
      name: entry.name,
      totalBuyIn,
      totalCashOut,
      net: totalCashOut - totalBuyIn,
      isSeated: entry.isSeated,
    };
  });
}

function isFeedbackCue(value: unknown): value is GameFeedbackCueEnvelope {
  return !!value && typeof value === "object" && "kind" in value && "key" in value;
}

async function requestJoinToken(
  roomId: string,
  clientId: string,
  requestHostname?: string | null,
): Promise<JoinTokenResponse> {
  return requestNativeJoinToken(roomId, clientId, { explicitHost: env.partyKitHost, requestHostname });
}

// ── Raise panel components ────────────────────────────────────────────────

const RAISE_THUMB_SIZE = 24;

function NativeRaiseSlider({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { minRef.current = min; }, [min]);
  useEffect(() => { maxRef.current = max; }, [max]);

  const updateFromX = useCallback((x: number) => {
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    onChangeRef.current(Math.round(minRef.current + ratio * (maxRef.current - minRef.current)));
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .enabled(!disabled)
        .onBegin((e) => updateFromX(e.x))
        .onUpdate((e) => updateFromX(e.x)),
    [disabled, updateFromX],
  );

  const pct = max > min ? (value - min) / (max - min) : 0;
  const thumbLeft = trackWidth > 0
    ? Math.max(0, Math.min(pct * trackWidth - RAISE_THUMB_SIZE / 2, trackWidth - RAISE_THUMB_SIZE))
    : 0;

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={styles.sliderOuter}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setTrackWidth(e.nativeEvent.layout.width);
        }}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: trackWidth * pct }]} />
        </View>
        {trackWidth > 0 && (
          <View style={[styles.sliderThumb, { left: thumbLeft }]} />
        )}
      </View>
    </GestureDetector>
  );
}

function NativeRaiseSheetContent({
  pot,
  stack,
  currentBet,
  minRaise,
  bigBlind,
  isFirstBet,
  onConfirm,
}: {
  pot: number;
  stack: number;
  currentBet: number;
  minRaise: number;
  bigBlind: number;
  isFirstBet: boolean;
  onConfirm: (amount: number) => void;
}) {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { amount, setAmount, increment, lowerBound, presets, clamp, allInTotal } = useRaiseAmount({
    minRaise,
    stack,
    pot,
    bigBlind,
    currentBet,
  });

  const isAllInOnly = lowerBound >= allInTotal;
  const label = isFirstBet ? "Bet" : "Raise to";
  const incrementLabel = formatCents(increment);

  return (
    <View style={styles.raiseSheetContent}>
      <View style={styles.raiseAmountRow}>
        <View style={styles.raiseStepSide}>
          <Pressable
            disabled={isAllInOnly}
            onPress={() => setAmount(clamp(amount - increment))}
            style={({ pressed }) => [
              styles.raiseStepBtn,
              pressed && styles.raiseStepBtnPressed,
              isAllInOnly && styles.raiseStepBtnDisabled,
            ]}
          >
            <Text style={styles.raiseStepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.raiseStepIncrement}>-{incrementLabel}</Text>
        </View>

        <View style={styles.raiseAmountCenter}>
          <Text style={styles.raiseAmountText}>{formatCents(amount)}</Text>
          {isAllInOnly && <Text style={styles.raiseAllInLabel}>ALL-IN</Text>}
        </View>

        <View style={styles.raiseStepSide}>
          <Pressable
            disabled={isAllInOnly}
            onPress={() => setAmount(clamp(amount + increment))}
            style={({ pressed }) => [
              styles.raiseStepBtn,
              pressed && styles.raiseStepBtnPressed,
              isAllInOnly && styles.raiseStepBtnDisabled,
            ]}
          >
            <Text style={styles.raiseStepBtnText}>+</Text>
          </Pressable>
          <Text style={styles.raiseStepIncrement}>+{incrementLabel}</Text>
        </View>
      </View>

      {isAllInOnly ? (
        <View style={styles.raiseAllInFill} />
      ) : (
        <NativeRaiseSlider
          value={amount}
          min={lowerBound}
          max={allInTotal}
          onChange={setAmount}
        />
      )}

      {!isAllInOnly && (
        <View style={styles.raisePresetRow}>
          {presets.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => setAmount(clamp(p.value))}
              style={({ pressed }) => [styles.raisePreset, pressed && styles.raisePresetPressed]}
            >
              <Text style={styles.raisePresetText}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <NativeButton
        label={`${label} ${formatCents(amount)}`}
        onPress={() => onConfirm(amount)}
        style={styles.raiseConfirmBtn}
      />
    </View>
  );
}



const SCREEN_PULSE_PERIOD_MS = 2400;
// Ticks at offsets within each 2400ms cycle. "light" = near peak (~1200ms),
// "sel" = edges. Mirrors the visual amplitude so haptic intensity feathers in/out.
const SCREEN_PULSE_TICKS: Array<[offsetMs: number, style: "sel" | "light"]> = [
  [120,  "sel"],
  [330,  "sel"],
  [570,  "sel"],
  [810,  "light"],
  [1020, "light"],
  [1200, "light"],
  [1380, "light"],
  [1590, "light"],
  [1830, "sel"],
  [2085, "sel"],
  [2310, "sel"],
];

function ScreenPulseLayer({ active }: { active: boolean }) {
  const presence = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    presence.value = withTiming(active ? 1 : 0, {
      duration: 300,
      easing: ReEasing.out(ReEasing.quad),
    });

    if (!active) {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 300 });
      return;
    }

    pulse.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SCREEN_PULSE_PERIOD_MS * 0.5, easing: ReEasing.inOut(ReEasing.sin) }),
        withTiming(0, { duration: SCREEN_PULSE_PERIOD_MS * 0.5, easing: ReEasing.inOut(ReEasing.sin) }),
      ),
      -1,
      false,
    );

    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const schedCycle = () => {
      if (cancelled) return;
      for (const [offsetMs, style] of SCREEN_PULSE_TICKS) {
        const t = setTimeout(() => {
          timers.delete(t);
          if (cancelled) return;
          if (style === "light") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          } else {
            Haptics.selectionAsync().catch(() => {});
          }
        }, offsetMs);
        timers.add(t);
      }
    };

    schedCycle();
    const interval = setInterval(schedCycle, SCREEN_PULSE_PERIOD_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      for (const t of timers) clearTimeout(t);
    };
  }, [active, presence, pulse]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: presence.value * (0.25 + pulse.value * 0.65),
  }));

  return (
    <ReAnimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, screenPulseStyles.layer]}>
      <ReAnimated.View style={[screenPulseStyles.bottomWash, washStyle]}>
        <LinearGradient
          colors={[
            "rgba(239,68,68,0)",
            "rgba(239,68,68,0.05)",
            "rgba(239,68,68,0.16)",
            "rgba(239,68,68,0.34)",
          ] as const}
          locations={[0, 0.4, 0.78, 1] as const}
          style={StyleSheet.absoluteFill}
        />
      </ReAnimated.View>
    </ReAnimated.View>
  );
}

const screenPulseStyles = StyleSheet.create({
  layer: {
    zIndex: 10,
  },
  bottomWash: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
});

// Soft glow ring rendered behind the primary (Check/Call) action button when
// it's the user's turn. Pulses gently to draw the eye without being noisy.
function ActionFocusRing({ active }: { active: boolean }) {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const presence = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    presence.value = withTiming(active ? 1 : 0, {
      duration: 220,
      easing: ReEasing.out(ReEasing.quad),
    });
    if (active) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: ReEasing.inOut(ReEasing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 220 });
    }
    return () => {
      cancelAnimation(pulse);
    };
  }, [active, presence, pulse]);

  const ringStyle = useAnimatedStyle(() => {
    const breathe = 1 + pulse.value * 0.04;
    return {
      opacity: presence.value,
      transform: [{ scale: 0.96 + presence.value * 0.04 * breathe }],
    };
  });

  return (
    <ReAnimated.View
      pointerEvents="none"
      style={[styles.actionFocusRing, ringStyle]}
    />
  );
}

// Centered, max-width row that hosts the three action buttons. The primary
// (Check/Call) sits in a relative slot so the focus ring can absolutely-position
// itself behind only that button.
function ActionRow({
  fold,
  primary,
  trailing,
  canAct,
  focusActive,
}: {
  fold: React.ReactNode;
  primary: React.ReactNode;
  trailing: React.ReactNode;
  canAct: boolean;
  focusActive: boolean;
}) {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const popStyle = useActionRowPopStyle(canAct);
  return (
    <View style={styles.actionRowOuter}>
      <ReAnimated.View
        style={[styles.actionRow, !canAct && styles.disabledActions, popStyle]}
      >
        {fold}
        <View style={styles.primarySlot}>
          <ActionFocusRing active={focusActive} />
          {primary}
        </View>
        {trailing}
      </ReAnimated.View>
    </View>
  );
}

// Brief 1 → 1.03 → 1 scale-pop on the action row when canAct flips false → true.
function useActionRowPopStyle(canAct: boolean) {
  const scale = useSharedValue(1);
  const prevRef = useRef(canAct);
  useEffect(() => {
    if (!prevRef.current && canAct) {
      scale.value = withSequence(
        withSpring(1.03, { damping: 14, stiffness: 320, mass: 0.8 }),
        withSpring(1, { damping: 18, stiffness: 280, mass: 0.9 }),
      );
    }
    prevRef.current = canAct;
  }, [canAct, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

export default function TableScreen() {
  const theme = useNativeTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const params = useLocalSearchParams<{ code?: string }>();
  const roomId = String(params.code ?? "").toUpperCase();
  const [tableState, setTableState] = useState<PublicTableState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [holeCards, setHoleCards] = useState<[Card, Card] | null>(null);
  const [revealedHoleCards, setRevealedHoleCards] = useState<Record<string, [Card | null, Card | null]>>({});
  const [peekedCardMask, setPeekedCardMask] = useState(0);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>([]);
  const [peekedCounts, setPeekedCounts] = useState<Record<string, number>>({});
  const [queuedLeavePlayerIds, setQueuedLeavePlayerIds] = useState<string[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"seat" | "raise" | "menu" | "seatManager" | "foldConfirm" | null>(null);
  const [activePotTool, setActivePotTool] = useState<"bomb" | "ledger" | null>(null);
  const [ledgerOverlayVisible, setLedgerOverlayVisible] = useState(false);
  const [potIslandRect, setPotIslandRect] = useState<PotIslandRect | null>(null);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [sitName, setSitName] = useState("");
  const [buyIn, setBuyIn] = useState((DEFAULT_BUY_IN_CENTS / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const buyInRef = useRef<any>(null);
  const [rebuyAmount, setRebuyAmount] = useState("");
  const [autoPeelEnabled, setAutoPeelEnabled] = useState(false);
  const [detailSeatIndex, setDetailSeatIndex] = useState<number | null>(null);
  const [activeBombPotBoard, setActiveBombPotBoard] = useState(0);
  const [viewingRun, setViewingRun] = useState(0);
  const [bombPotDecision, setBombPotDecision] = useState<BombPotDecisionAnnouncement | null>(null);
  const [utilityRailLayout, setUtilityRailLayout] = useState<LayoutRect | null>(null);
  const [utilityChipLayout, setUtilityChipLayout] = useState<LayoutRect | null>(null);
  const seenFeedbackKeysRef = useRef(new Set<string>());
  const myPlayerIdRef = useRef<string | null>(null);
  const actionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestHostname = useMemo(() => getExpoRequestHostname(), []);

  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  useEffect(() => () => {
    if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
  }, []);

  const join = useCallback(
    ({ clientId }: { clientId: string; roomId: string }) => requestJoinToken(roomId, clientId, requestHostname),
    [requestHostname, roomId],
  );

  useEffect(() => {
    let isMounted = true;
    void readPersistedAutoPeelPreference(AsyncStorage).then((enabled) => {
      if (isMounted) setAutoPeelEnabled(enabled);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleAutoPeel = useCallback(() => {
    setAutoPeelEnabled((enabled) => {
      const nextEnabled = !enabled;
      void writePersistedAutoPeelPreference(nextEnabled, AsyncStorage);
      return nextEnabled;
    });
  }, []);

  const handleMessage = useCallback((message: MobileServerMessage) => {
    switch (message.type) {
      case "WELCOME":
        setMyPlayerId(message.playerSessionId);
        setIsCreator(message.isCreator);
        break;
      case "TABLE_STATE": {
        setTableState(message.state);
        setError(null);
        const feedback = Array.isArray(message.feedback) ? message.feedback.filter(isFeedbackCue) : [];
        for (const cue of feedback) {
          if (seenFeedbackKeysRef.current.has(cue.key)) continue;
          seenFeedbackKeysRef.current.add(cue.key);
          playNativeFeedbackHaptic(cue, { myPlayerId: myPlayerIdRef.current });
          if (cue.kind === "bomb_pot_scheduled") {
            setBombPotDecision({
              key: cue.key,
              kind: "scheduled",
              anteBB: cue.anteBB,
              title: "BOMB POT!",
              detail: `${cue.anteBB}x BB ante next hand`,
              expiresAt: Date.now() + 3_000,
            });
          }
          if (cue.kind === "bomb_pot_canceled") {
            setBombPotDecision({
              key: cue.key,
              kind: "canceled",
              anteBB: cue.anteBB,
              title: "Bomb Pot Canceled",
              detail: "A stack came up short, so this hand returns to standard blinds.",
              expiresAt: Date.now() + 4_000,
            });
          }
        }
        if (message.state.isBombPot) setBombPotDecision(null);
        break;
      }
      case "PRIVATE_STATE":
        setHoleCards(message.holeCards as [Card, Card] | null);
        setRevealedHoleCards((message.revealedHoleCards ?? {}) as Record<string, [Card | null, Card | null]>);
        setPeekedCardMask(message.peekedCardMask ?? 0);
        break;
      case "ROOM_PRESENCE":
        setAwayPlayerIds(message.awayPlayerIds ?? []);
        setPeekedCounts(message.peekedCounts ?? {});
        setQueuedLeavePlayerIds(message.queuedLeavePlayerIds ?? []);
        break;
      case "LEDGER_STATE":
        setLedgerEntries((message.entries ?? []) as LedgerEntry[]);
        break;
      case "ERROR":
        if (message.code === "ACTION_REJECTED") {
          if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
          setActionError(message.message || "Action rejected");
          actionErrorTimerRef.current = setTimeout(() => {
            setActionError(null);
            actionErrorTimerRef.current = null;
          }, 3_000);
          playNativeFeedbackHaptic({ kind: "action_error", key: `${Date.now()}:${message.code}` }, { myPlayerId: myPlayerIdRef.current });
          break;
        }
        setError(message.message || message.code);
        playNativeFeedbackHaptic({ kind: "action_error", key: `${Date.now()}:${message.code}` }, { myPlayerId: myPlayerIdRef.current });
        break;
    }
  }, []);

  const {
    connection,
    status: connectionStatus,
    terminalError,
    firstStateReceived,
  } = useGameConnection<MobileServerMessage, GameEvent>({
    adapter: "native",
    enabled: roomId.length > 0,
    roomId,
    protocolVersion: PROTOCOL_VERSION,
    storage: AsyncStorage,
    explicitHost: env.partyKitHost,
    requestHostname,
    appState: AppState,
    join,
    onJoin: (joinToken) => {
      setMyPlayerId(joinToken.playerSessionId);
      setIsCreator(joinToken.isCreator);
      setError(null);
    },
    onJoinError: (nextError) => {
      setError(nextError.message);
      playNativeFeedbackHaptic({ kind: "action_error", key: `join:${nextError.message}` }, { myPlayerId: myPlayerIdRef.current });
    },
    onStatusChange: (status) => {
      if (status === "connected") setError(null);
    },
    onTerminalError: (nextError) => {
      setError(nextError.message);
    },
    onMessage: handleMessage,
  });

  useEffect(() => {
    return () => connection?.disconnect();
  }, [connection]);

  useEffect(() => {
    if (!bombPotDecision) return;
    const remainingMs = Math.max(0, bombPotDecision.expiresAt - Date.now());
    const timer = setTimeout(() => setBombPotDecision(null), remainingMs);
    return () => clearTimeout(timer);
  }, [bombPotDecision]);

  // Build rich TablePlayer array (superset of PlayerSummary, includes lastAction + hasCards)
  const tablePlayers = useMemo<TablePlayer[]>(() => {
    if (!tableState) return [];
    const actorId = tableState.needsToAct[0] ?? null;
    const winnerIds = new Set(tableState.winners?.map((w) => w.playerId) ?? []);
    const isMultiWinner = (tableState.winners?.length ?? 0) > 1;
    return Object.values(tableState.players)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((player) => ({
        id: player.id,
        name: player.name,
        seatIndex: player.seatIndex,
        stack: player.stack,
        currentBet: player.currentBet,
        isFolded: player.isFolded,
        isAllIn: player.isAllIn && player.hasCards !== false && !player.sitOutUntilBB,
        isAway: awayPlayerIds.includes(player.id),
        isActor: actorId === player.id,
        isViewer: myPlayerId === player.id,
        hasCards: player.hasCards && !player.isFolded,
        lastAction: player.lastAction ?? null,
        peekedCount: peekedCounts[player.id] ?? 0,
        holeCards: (revealedHoleCards[player.id] ?? null) as [Card | null, Card | null] | null,
        winType: winnerIds.has(player.id)
          ? (isMultiWinner ? "partial" : "full")
          : null,
        winAnimationKey: winnerIds.has(player.id)
          ? `${tableState.handNumber}:${player.id}`
          : null,
      }));
  }, [awayPlayerIds, myPlayerId, tableState, peekedCounts, revealedHoleCards]);

  // Seat-indexed player slots for OpponentStrip (null = empty seat)
  const seatPlayers = useMemo(() => {
    const seats = Array.from<TablePlayer | null>({ length: MAX_SEATS }).fill(null);
    for (const player of tablePlayers) seats[player.seatIndex] = player;
    return seats;
  }, [tablePlayers]);

  const runItOddsSessionKey = useMemo(() => {
    if (!tableState) return "no-table";
    return [
      tableState.handNumber,
      tableState.showdownStartedAt ?? "no-showdown",
      tableState.runDealStartedAt ?? "no-run-deal",
    ].join(":");
  }, [tableState?.handNumber, tableState?.runDealStartedAt, tableState?.showdownStartedAt]);

  const runItOddsContext = useMemo(() => {
    if (!tableState) return null;
    const runResults = tableState.runResults ?? [];
    const panelVisible = shouldShowRunItOddsPanel({
      phase: tableState.phase,
      players: seatPlayers,
      runResults,
    });
    if (!panelVisible) return null;

    const { currentRun } = deriveRunItOddsVisibleRunState(
      runResults,
      tableState.knownCardCountAtRunIt ?? tableState.knownCardCount ?? 0,
      Math.max(tableState.runCount ?? 1, runResults.length, 1),
    );
    return buildRunItOddsContext({
      players: seatPlayers,
      runResults,
      currentRun,
    });
  }, [
    seatPlayers,
    tableState?.handNumber,
    tableState?.isBombPot,
    tableState?.isRunItBoard,
    tableState?.knownCardCount,
    tableState?.knownCardCountAtRunIt,
    tableState?.phase,
    tableState?.runCount,
    tableState?.runResults,
  ]);

  const [runItOddsPercentagesByPlayerId, setRunItOddsPercentagesByPlayerId] = useState<Record<string, number | null>>({});
  const runItOddsGenerationRef = useRef(0);

  useEffect(() => {
    runItOddsGenerationRef.current += 1;
    setRunItOddsPercentagesByPlayerId({});
  }, [runItOddsSessionKey]);

  useEffect(() => {
    runItOddsGenerationRef.current += 1;
    const generation = runItOddsGenerationRef.current;

    if (!runItOddsContext) {
      setRunItOddsPercentagesByPlayerId({});
      return;
    }

    const publishPercentages = (percentages: Record<string, number>) => {
      if (runItOddsGenerationRef.current !== generation) return;
      setRunItOddsPercentagesByPlayerId(percentages);
    };

    if (runItOddsContext.mode === "final") {
      publishPercentages(calculateFinalRunItOdds(runItOddsContext));
      return;
    }

    if (runItOddsContext.mode === "exact") {
      publishPercentages(calculateExactRunItOdds(runItOddsContext));
      return;
    }

    setRunItOddsPercentagesByPlayerId({});
    const calcKey = `${runItOddsSessionKey}:${runItOddsContext.contextKey}`;
    const accumulator = createMonteCarloOddsAccumulator(runItOddsContext, {
      sampleCount: RUN_IT_ODDS_SAMPLE_COUNT,
      rng: createSeededRng(hashSeed(calcKey)),
    });
    let timer: ReturnType<typeof setTimeout> | null = null;

    const step = () => {
      if (runItOddsGenerationRef.current !== generation) return;
      const result = accumulator.runBatch(RUN_IT_ODDS_SAMPLE_BATCH_SIZE);
      publishPercentages(result.percentages);
      if (!result.done) {
        timer = setTimeout(step, 0);
      }
    };

    step();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [runItOddsContext, runItOddsSessionKey]);

  // Legacy PlayerSummary subset for remaining logic
  const players = useMemo<PlayerSummary[]>(() =>
    tablePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      seatIndex: p.seatIndex,
      stack: p.stack,
      currentBet: p.currentBet,
      isFolded: p.isFolded,
      isAllIn: p.isAllIn,
      isAway: p.isAway,
      isActor: p.isActor,
      isViewer: p.isViewer,
    })),
    [tablePlayers],
  );

  const viewer = tablePlayers.find((p) => p.id === myPlayerId) ?? null;
  const lastPersistedSeatedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tableState || !myPlayerId || !roomId) return;
    if (!viewer) {
      lastPersistedSeatedKeyRef.current = null;
      void removeSeatedTable(AsyncStorage, roomId);
      return;
    }

    const persistKey = [
      roomId,
      viewer.id,
      viewer.name,
      tableState.tableName,
      tableState.blinds.small,
      tableState.blinds.big,
    ].join(":");
    if (lastPersistedSeatedKeyRef.current === persistKey) return;
    lastPersistedSeatedKeyRef.current = persistKey;

    void upsertSeatedTable(AsyncStorage, {
      code: roomId,
      tableName: tableState.tableName,
      playerName: viewer.name,
      playerSessionId: viewer.id,
      blinds: tableState.blinds,
    });
  }, [myPlayerId, roomId, tableState, viewer]);

  const actorId = tableState?.needsToAct[0] ?? null;
  const activeSeatIndex = tablePlayers.find((p) => p.id === actorId)?.seatIndex ?? null;

  const chipGlowAngle = useMemo(() => {
    if (!utilityRailLayout || !utilityChipLayout) {
      return computeMobileChipAngle({
        actorSeatIndex: activeSeatIndex,
        viewerSeatIndex: viewer?.seatIndex ?? null,
        totalSeats: MAX_SEATS,
      });
    }
    return computeMobileChipAngle({
      actorSeatIndex: activeSeatIndex,
      viewerSeatIndex: viewer?.seatIndex ?? null,
      totalSeats: MAX_SEATS,
    });
  }, [activeSeatIndex, utilityRailLayout, utilityChipLayout, viewer?.seatIndex]);

  const canAct = !!viewer && actorId === myPlayerId;
  const callAmount = viewer && tableState ? Math.max(0, tableState.roundBet - viewer.currentBet) : 0;
  const lastRaise = tableState?.lastLegalRaiseIncrement ?? tableState?.blinds.big ?? 0;
  const minRaiseTotal = tableState
    ? tableState.isBlindIncomplete
      ? tableState.blinds.big
      : tableState.roundBet + Math.max(lastRaise, tableState.blinds.big)
    : 0;
  const canCheck = canAct && callAmount <= 0;
  const canRaise = canAct && !!viewer && !(tableState?.closedActors ?? []).includes(viewer.id) && viewer.stack > callAmount;
  const canAllIn = canAct && !!viewer && viewer.stack > 0;
  const isWaiting = tableState?.phase === "waiting";
  const isShowdown = tableState?.phase === "showdown";
  const eligiblePlayerCount = players.filter((player) => player.stack > 0).length;
  const publicShowdownRevealComplete = useMemo(
    () => isPublicShowdownRevealComplete(tableState),
    [tableState],
  );
  useEffect(() => {
    const runResults = tableState?.runResults ?? [];
    if (
      tableState?.phase !== "showdown" ||
      !tableState.isRunItBoard ||
      tableState.isBombPot ||
      runResults.length === 0 ||
      publicShowdownRevealComplete
    ) {
      return;
    }
    const { currentRun } = deriveRunItOddsVisibleRunState(
      runResults,
      tableState.knownCardCountAtRunIt ?? tableState.knownCardCount ?? 0,
      Math.max(tableState.runCount ?? 1, runResults.length, 1),
    );
    setViewingRun((current) => (current < currentRun ? currentRun : current));
  }, [
    publicShowdownRevealComplete,
    tableState?.handNumber,
    tableState?.isBombPot,
    tableState?.isRunItBoard,
    tableState?.knownCardCount,
    tableState?.knownCardCountAtRunIt,
    tableState?.phase,
    tableState?.runCount,
    tableState?.runResults,
  ]);
  useEffect(() => {
    setViewingRun(0);
  }, [tableState?.handNumber]);
  const boundaryControl = useMemo(
    () => deriveNativeBoundaryControl({
      phase: tableState?.phase,
      isCreator,
      eligiblePlayerCount,
      nextHandStartsAt: tableState?.nextHandStartsAt ?? null,
      publicShowdownRevealComplete,
    }),
    [
      eligiblePlayerCount,
      isCreator,
      publicShowdownRevealComplete,
      tableState?.nextHandStartsAt,
      tableState?.phase,
    ],
  );
  const showActiveTurnTreatment = canAct && !isWaiting && !isShowdown;
  const leaveQueued = !!myPlayerId && queuedLeavePlayerIds.includes(myPlayerId);
  const viewerPendingBoundaryUpdate =
    myPlayerId ? (tableState?.pendingBoundaryUpdates?.[myPlayerId] ?? null) : null;
  const tablePot = (tableState?.pot ?? 0) + players.reduce((sum, p) => sum + p.currentBet, 0);
  const showRunItVotingPanel = useTimedPanelVisibility({
    visible: tableState?.phase === "voting",
    startedAt: tableState?.runItVotingStartedAt,
    durationMs: RUN_IT_VOTING_TIMEOUT_MS,
  });
  const showBombPotVotingPanel = useTimedPanelVisibility({
    visible: tableState?.bombPotVote != null,
    startedAt: tableState?.bombPotVotingStartedAt,
    durationMs: BOMB_POT_VOTING_TIMEOUT_MS,
  });
  const animatedRunItShowdown =
    tableState?.phase === "showdown" &&
    !!tableState?.isRunItBoard &&
    !tableState?.isBombPot &&
    (tableState.runResults?.length ?? 0) > 0;
  const hasPriorityPotMode =
    (tableState?.bombPotVote != null && showBombPotVotingPanel) ||
    (tableState?.phase === "voting" && showRunItVotingPanel) ||
    tableState?.runAnnouncement != null ||
    bombPotDecision != null ||
    Boolean(
      tableState?.phase === "showdown" &&
        !animatedRunItShowdown &&
        tableState.winners &&
        tableState.winners.length > 0,
    );

  const communityCards = tableState?.communityCards ?? [];

  const isBombPot = tableState?.isBombPot ?? false;
  const { spotlightHoleCardEmphasis, spotlightBoardCardEmphasis, spotlightBombPotCardEmphasis, spotlightRunCardEmphasisByRun } =
    useMemo(() => {
      const boards = tableState?.communityCards ?? [];
      const boards2 = tableState?.communityCards2 ?? [];
      const runResults = tableState?.runResults ?? [];
      const isRunIt = runResults.length > 1;

      const singleSpotlight = buildShowdownSpotlight({ holeCards, boardCards: boards });
      const bombPotSpotlights = [
        buildShowdownSpotlight({ holeCards, boardCards: boards }),
        buildShowdownSpotlight({ holeCards, boardCards: boards2 }),
      ];
      const runSpotlights = runResults.map((r) => buildShowdownSpotlight({ holeCards, boardCards: r.board }));

      const holeEmphasis: Emphasis[] = isBombPot
        ? mergeEmphasisArrays(bombPotSpotlights.map((s) => s?.holeCards.map((e) => e.emphasis) ?? null), 2)
        : isRunIt
          ? mergeEmphasisArrays(runSpotlights.map((s) => s?.holeCards.map((e) => e.emphasis) ?? null), 2)
          : (singleSpotlight?.holeCards.map((e) => e.emphasis) ?? ["neutral", "neutral"]);

      return {
        spotlightHoleCardEmphasis: holeEmphasis,
        spotlightBoardCardEmphasis: singleSpotlight?.boardCards.map((e) => e.emphasis) ?? null,
        spotlightBombPotCardEmphasis: [
          bombPotSpotlights[0]?.boardCards.map((e) => e.emphasis) ?? null,
          bombPotSpotlights[1]?.boardCards.map((e) => e.emphasis) ?? null,
        ] as [Emphasis[] | null, Emphasis[] | null],
        spotlightRunCardEmphasisByRun: runSpotlights.map((s) => s?.boardCards.map((e) => e.emphasis) ?? null),
      };
    }, [holeCards, tableState?.communityCards, tableState?.communityCards2, tableState?.isBombPot, tableState?.runResults, isBombPot]);

  const myRevealedCardIndices = useMemo(() => {
    const publicCards = myPlayerId ? revealedHoleCards[myPlayerId] : null;
    const indices = new Set<0 | 1>();
    if (publicCards?.[0]) indices.add(0);
    if (publicCards?.[1]) indices.add(1);
    return indices;
  }, [myPlayerId, revealedHoleCards]);
  const myPeekedCardIndices = useMemo(() => {
    const indices = new Set<0 | 1>();
    if (peekedCardMask & 1) indices.add(0);
    if (peekedCardMask & 2) indices.add(1);
    return indices;
  }, [peekedCardMask]);

  const ledgerRows = useMemo(() => deriveLedgerRows(ledgerEntries), [ledgerEntries]);
  const payoutInstructions = useMemo(() => derivePayoutInstructions(ledgerRows), [ledgerRows]);
  const viewerLedgerSummary = useMemo<LedgerSummaryInfo>(() => {
    const row = myPlayerId ? ledgerRows.find((ledgerRow) => ledgerRow.playerId === myPlayerId) : null;
    return {
      totalBuyIn: row?.totalBuyIn ?? 0,
      totalCashOut: row?.totalCashOut ?? 0,
      net: row?.net ?? 0,
      hasLedger: !!row,
    };
  }, [ledgerRows, myPlayerId]);

  useEffect(() => {
    if (hasPriorityPotMode) setLedgerOverlayVisible(false);
  }, [hasPriorityPotMode]);

  // Footer status: show "Waiting for X..." when it's not our turn and someone needs to act
  const footerStatusMessage = useMemo(() => {
    if (showActiveTurnTreatment) return "Your turn";
    if (!actorId || actorId === myPlayerId) return null;
    const actorName = tablePlayers.find((p) => p.id === actorId)?.name;
    if (!actorName) return null;
    return `Waiting for ${actorName}…`;
  }, [actorId, myPlayerId, showActiveTurnTreatment, tablePlayers]);
  const nextHandStartsAt = tableState?.nextHandStartsAt ?? null;
  const [nextHandSecondsLeft, setNextHandSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!nextHandStartsAt) { setNextHandSecondsLeft(null); return; }
    const tick = () => setNextHandSecondsLeft(Math.max(0, Math.ceil((nextHandStartsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [nextHandStartsAt]);

  const nextHandMessage = nextHandSecondsLeft !== null ? `Next hand in ${nextHandSecondsLeft}s` : null;
  const terminalCode = terminalError?.message ?? null;
  const showTableNotFound = terminalCode === "TABLE_NOT_FOUND" || terminalCode === "TABLE_NOT_ACTIVE";
  const showReconnectIndicator = connectionStatus !== "connected" && firstStateReceived && !terminalError;
  const showBlockingConnectionOverlay = !firstStateReceived && !showTableNotFound;
  const isReconnecting = showReconnectIndicator || showBlockingConnectionOverlay;
  const reconnectMessage = isReconnecting ? "Reconnecting…" : null;
  const footerDisplayMessage = actionError ?? reconnectMessage ?? footerStatusMessage ?? nextHandMessage;
  const footerDisplayTone = (actionError || isReconnecting) ? "active" : showActiveTurnTreatment ? "active" : "neutral";
  const blockingConnectionTitle = connectionStatus === "disconnected" ? "Reconnecting table" : "Loading table";
  const blockingConnectionMessage = connectionStatus === "disconnected"
    ? "Your connection dropped before the table finished syncing. Restoring the latest hand now."
    : `Joining ${roomId} and syncing the current table state.`;

  const sendEvent = useCallback((event: GameEvent, strength: "light" | "medium" | "heavy" = "light") => {
    connection?.sendAction(event);
    playNativeFeedbackHaptic(
      { kind: "local_press", key: `${event.type}:${Date.now()}`, strength },
      { myPlayerId: myPlayerIdRef.current },
    );
  }, [connection]);

  const sendViewerEvent = useCallback((buildEvent: (playerId: string) => GameEvent, strength: "light" | "medium" | "heavy" = "light") => {
    if (!myPlayerId) return;
    sendEvent(buildEvent(myPlayerId), strength);
  }, [myPlayerId, sendEvent]);

  const openSeat = (seatIndex: number) => {
    const player = seatPlayers[seatIndex];
    playNativeFeedbackHaptic({ kind: "local_press", key: `seat:${seatIndex}` }, { myPlayerId });
    if (player) return;
    if (viewer) {
      if (!isWaiting) return;
      sendViewerEvent((playerId) => ({
        type: "REQUEST_BOUNDARY_UPDATE",
        playerId,
        leaveSeat: false,
        moveToSeatIndex: seatIndex,
        chipDelta: 0,
      }), "medium");
      return;
    }
    setSelectedSeatIndex(seatIndex);
    setSheet("seat");
  };

  const confirmSit = () => {
    const seatIndex = selectedSeatIndex;
    if (seatIndex == null || !myPlayerId) return;
    const buyInCents = Math.max(0, Math.round(Number(buyIn.replace(/,/g, "") || DEFAULT_BUY_IN_CENTS / 100) * 100));
    sendEvent(
      { type: "TAKE_SEAT", playerId: myPlayerId, name: sitName.trim() || "Player", seatIndex, buyIn: buyInCents },
      "medium",
    );
    setSheet(null);
  };

  const voteRun = (count: 1 | 2 | 3) => {
    sendViewerEvent((playerId) => ({ type: "VOTE_RUN", playerId, count }), "medium");
  };

  const voteBombPot = (approve: boolean) => {
    sendViewerEvent((playerId) => ({ type: "VOTE_BOMB_POT", playerId, approve }), approve ? "medium" : "light");
  };

  const proposeBombPot = (anteBB: BombPotAnteBB) => {
    sendViewerEvent((playerId) => ({ type: "PROPOSE_BOMB_POT", playerId, anteBB }), "medium");
    setActivePotTool(null);
    setSheet(null);
  };

  const potPanelMode = useMemo<DynamicPotMode>(() => {
    if (tableState?.bombPotVote && showBombPotVotingPanel) {
      return {
        kind: "bombVote",
        vote: tableState.bombPotVote,
        players,
        viewerId: myPlayerId,
        bigBlind: tableState.blinds.big,
        votingStartedAt: tableState.bombPotVotingStartedAt,
        onApprove: () => voteBombPot(true),
        onReject: () => voteBombPot(false),
      };
    }
    if (tableState?.phase === "voting" && showRunItVotingPanel) {
      return {
        kind: "runVote",
        votes: tableState.runItVotes ?? {},
        players,
        viewerId: myPlayerId,
        canVote: !!viewer && !viewer.isFolded,
        votingStartedAt: tableState.runItVotingStartedAt,
        onVote: voteRun,
      };
    }
    if (tableState?.runAnnouncement != null) {
      return { kind: "runAnnouncement", runCount: tableState.runAnnouncement };
    }
    if (bombPotDecision) {
      return { kind: "bombDecision", announcement: bombPotDecision };
    }
    if (
      tableState?.phase === "showdown" &&
      !animatedRunItShowdown &&
      tableState.winners &&
      tableState.winners.length > 0
    ) {
      return { kind: "winner", winners: tableState.winners, players, viewerId: myPlayerId };
    }
    if (activePotTool === "bomb" && tableState && viewer) {
      return {
        kind: "bombProposal",
        bigBlind: tableState.blinds.big,
        onSelectAnte: (anteBB) => {
          playNativeFeedbackHaptic({ kind: "local_press", key: `bomb_ante:${anteBB}` }, { myPlayerId });
        },
        onPropose: proposeBombPot,
        onCancel: () => {
          playNativeFeedbackHaptic({ kind: "local_press", key: "bomb_proposal_cancel" }, { myPlayerId });
        },
        disabled: !viewer,
      };
    }
    if (activePotTool === "ledger") {
      return {
        kind: "ledgerSummary",
        summary: viewerLedgerSummary,
        onOpenLedger: () => {
          setLedgerOverlayVisible(true);
          playNativeFeedbackHaptic({ kind: "local_press", key: "ledger_expand" }, { myPlayerId });
        },
      };
    }
    return { kind: "compact" };
  }, [
    activePotTool,
    animatedRunItShowdown,
    bombPotDecision,
    myPlayerId,
    players,
    showBombPotVotingPanel,
    showRunItVotingPanel,
    tableState,
    viewer,
    viewerLedgerSummary,
  ]);
  const activePotToolDismissible = potPanelMode.kind === "bombProposal" || potPanelMode.kind === "ledgerSummary";

  const dismissActivePotTool = useCallback(() => {
    if (activePotTool != null) {
      playNativeFeedbackHaptic({ kind: "local_press", key: `pot_panel_exit:${activePotTool}` }, { myPlayerId });
    }
    setActivePotTool(null);
    setLedgerOverlayVisible(false);
  }, [activePotTool, myPlayerId]);

  const dismissLedgerOverlay = useCallback(() => {
    setLedgerOverlayVisible(false);
  }, []);

  const revealCard = (cardIndex: 0 | 1) => {
    connection?.revealCard(cardIndex);
    playNativeFeedbackHaptic({ kind: "local_press", key: `reveal:${cardIndex}`, strength: "medium" }, { myPlayerId });
  };

  const peekCard = (cardIndex: 0 | 1) => {
    connection?.peekCard(cardIndex, tableState?.handNumber ?? 0);
    playNativeFeedbackHaptic({ kind: "local_press", key: `peek:${cardIndex}` }, { myPlayerId });
  };

  const handleActiveBoardChange = useCallback((boardIndex: number) => {
    setActiveBombPotBoard(boardIndex);
    playNativeFeedbackHaptic({ kind: "local_press", key: `board:${boardIndex}` }, { myPlayerId });
  }, [myPlayerId]);

  const handleViewingRunChange = useCallback((runIndex: number) => {
    setViewingRun(runIndex);
    playNativeFeedbackHaptic({ kind: "local_press", key: `run:${runIndex}` }, { myPlayerId });
  }, [myPlayerId]);

  const toggleLeave = () => {
    if (!viewer) return;
    if (leaveQueued) {
      sendViewerEvent((playerId) => ({ type: "CANCEL_BOUNDARY_UPDATE", playerId }), "light");
      return;
    }
    sendViewerEvent((playerId) => ({
      type: "REQUEST_BOUNDARY_UPDATE",
      playerId,
      leaveSeat: true,
      moveToSeatIndex: null,
      chipDelta: 0,
    }), "medium");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Stack.Screen 
        options={{ 
          gestureEnabled: false,
          headerShown: false
        }} 
      />
      <ScreenPulseLayer active={showActiveTurnTreatment} />
      {showTableNotFound ? (
        <View style={styles.blockingOverlay}>
          <View style={styles.blockingCard}>
            <Text style={styles.blockingTitle}>Table not found</Text>
            <Text style={styles.blockingMessage}>
              {roomId} doesn’t exist or is no longer active.
            </Text>
            <NativeButton label="Go Back" onPress={() => router.back()} />
          </View>
        </View>
      ) : null}
      {/* ── Header ── */}
      <TableHeader
        tableName={tableState?.tableName ?? `Table ${roomId}`}
        blinds={tableState?.blinds ?? null}
        sevenTwoBountyBB={tableState?.sevenTwoBountyBB}
        onBack={() => router.back()}
        onMenu={() => setSheet("menu")}
      />

      {/* ── Felt zone (opponent strip → utility rail) ── */}
      <View style={styles.feltZone}>

      {/* ── Opponent Strip ── */}
      <View style={styles.stripWrap}>
        <OpponentStrip
          players={seatPlayers}
          dealerIndex={tableState?.dealerSeatIndex ?? null}
          smallBlindIndex={tableState?.smallBlindSeatIndex ?? null}
          bigBlindIndex={tableState?.bigBlindSeatIndex ?? null}
          seatSelectionLocked={!isWaiting && !isShowdown}
          onEmptySeatTap={openSeat}
          onPlayerTap={(seatIndex) => setDetailSeatIndex(seatIndex)}
          selectedDetailSeatIndex={detailSeatIndex}
          runItOddsPercentagesByPlayerId={runItOddsPercentagesByPlayerId}
        />
        {/* Brand watermark on felt */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.feltWatermark]}>
          <Text style={styles.feltWatermarkText}>Pokington</Text>
        </View>
      </View>

      {/* ── Middle: community cards centered between strip and pot ── */}
      <View style={styles.tableMiddle}>
        <CommunityCards
          phase={tableState?.phase}
          communityCards={tableState?.communityCards}
          communityCards2={tableState?.communityCards2}
          isBombPot={tableState?.isBombPot}
          isRunItBoard={tableState?.isRunItBoard}
          runResults={tableState?.runResults}
          knownCardCount={tableState?.knownCardCountAtRunIt ?? tableState?.knownCardCount}
          runDealStartedAt={tableState?.runDealStartedAt}
          runAnnouncement={tableState?.runAnnouncement}
          handNumber={tableState?.handNumber}
          activeBombPotBoardIndex={activeBombPotBoard}
          onActiveBoardChange={handleActiveBoardChange}
          viewingRunIndex={viewingRun}
          onViewingRunChange={handleViewingRunChange}
          cardEmphasis={!isBombPot ? spotlightBoardCardEmphasis : null}
          bombPotCardEmphasis={isBombPot ? spotlightBombPotCardEmphasis : undefined}
          runCardEmphasisByRun={spotlightRunCardEmphasisByRun}
        />
      </View>

      {/* ── Dynamic pot island (sits just above chip rail) ── */}
      {activePotToolDismissible ? (
        <Pressable
          accessibilityLabel="Close pot panel"
          accessibilityRole="button"
          onPress={dismissActivePotTool}
          style={styles.potToolDismissLayer}
        />
      ) : null}
      {tableState != null && (
        <View
          onStartShouldSetResponder={() => activePotToolDismissible}
          style={activePotToolDismissible ? styles.potPanelLayer : undefined}
        >
          <DynamicPotPanel
            pot={tableState.pot ?? 0}
            total={tablePot}
            hasContributions={players.some((p) => p.currentBet > 0)}
            mode={potPanelMode}
            onRootMeasure={setPotIslandRect}
          />
        </View>
      )}

      <LedgerOverlay
        visible={ledgerOverlayVisible}
        ledgerRows={ledgerRows}
        payoutInstructions={payoutInstructions}
        sourceRect={potIslandRect}
        onDismiss={dismissLedgerOverlay}
      />

      {/* ── Utility rail: bomb · chip · ledger ── */}
      <View
        pointerEvents="box-none"
        style={styles.utilityRail}
        onLayout={(e: LayoutChangeEvent) => setUtilityRailLayout(e.nativeEvent.layout)}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!viewer || !!tableState?.bombPotVote}
          onPress={() => {
            setActivePotTool((tool) => (tool === "bomb" ? null : "bomb"));
            setLedgerOverlayVisible(false);
            playNativeFeedbackHaptic({ kind: "local_press", key: "bomb_tool" }, { myPlayerId });
          }}
          style={[styles.floatingUtility, (!viewer || !!tableState?.bombPotVote) && styles.utilityDisabled]}
        >
          <Text style={styles.utilityIcon}>💣</Text>
        </Pressable>

        <View
          style={styles.utilityChipSlot}
          onLayout={(e: LayoutChangeEvent) => setUtilityChipLayout(e.nativeEvent.layout)}
        >
          <NativePokerChip size={48} glowAngle={chipGlowAngle} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setActivePotTool((tool) => (tool === "ledger" ? null : "ledger"));
            setLedgerOverlayVisible(false);
            playNativeFeedbackHaptic({ kind: "local_press", key: "ledger" }, { myPlayerId });
          }}
          style={styles.floatingUtility}
        >
          <Text style={styles.utilityIcon}>💰</Text>
        </Pressable>
      </View>

      <FeltReconnectDim visible={showReconnectIndicator || showBlockingConnectionOverlay} />
      </View>{/* end feltZone */}

      {/* ── Bottom dock (HandPanel + action dock, banner anchored here) ── */}
      <View style={styles.bottomDock}>
        <HandPanel
          viewer={viewer}
          holeCards={holeCards}
          communityCards={communityCards}
          autoPeelEnabled={autoPeelEnabled}
          revealedToOthersIndices={myRevealedCardIndices}
          peekedCardIndices={myPeekedCardIndices}
          emphasisByIndex={spotlightHoleCardEmphasis}
          onStatsPress={() => {
            if (!viewer) return;
            setSelectedSeatIndex(viewer.seatIndex);
            setRebuyAmount("");
            setSheet("seatManager");
          }}
          onPeekCard={(index) => peekCard(index)}
          onRevealCard={(index) => revealCard(index)}
          onToggleAutoPeel={handleToggleAutoPeel}
        />

        {/* ── Action dock ── */}
        <View style={[styles.actionDock, showActiveTurnTreatment && styles.actionDockActive]}>
          {boundaryControl ? (
            <View style={styles.actionRowOuter}>
              <NativeButton
                label={boundaryControl.label}
                disabled={boundaryControl.disabled}
                onPress={boundaryControl.disabled ? undefined : () => sendEvent({ type: "START_HAND" }, "medium")}
                style={styles.fullActionButton}
              />
            </View>
          ) : isWaiting || isShowdown ? null : (
            <ActionRow
              canAct={canAct}
              focusActive={Boolean(showActiveTurnTreatment && canAct)}
              fold={
                <NativeButton
                  label="Fold"
                  tone="danger"
                  disabled={!canAct}
                  onPress={() => {
                    if (canCheck) {
                      setSheet("foldConfirm");
                      return;
                    }
                    sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "fold" }));
                  }}
                  style={[styles.actionButton, styles.foldAction]}
                />
              }
              primary={
                <NativeButton
                  label={canCheck ? "Check" : `Call ${cents(callAmount)}`}
                  disabled={!canAct}
                  onPress={() =>
                    sendViewerEvent((playerId) => ({
                      type: "PLAYER_ACTION",
                      playerId,
                      action: canCheck ? "check" : "call",
                    }))
                  }
                  style={[styles.actionButton, styles.primaryAction]}
                />
              }
              trailing={
                canRaise ? (
                  <NativeButton
                    label="Raise"
                    disabled={!canRaise}
                    onPress={() => setSheet("raise")}
                    style={[styles.actionButton, styles.raiseAction]}
                  />
                ) : (
                  <NativeButton
                    label="All-in"
                    disabled={!canAllIn}
                    onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "all-in" }), "heavy")}
                    style={[styles.actionButton, styles.raiseAction]}
                  />
                )
              }
            />
          )}
        </View>

        {/* ── Footer status banner — bottom is relative to bottomDock, not SafeAreaView ── */}
        {footerDisplayMessage ? (
          <View pointerEvents="none" style={styles.statusBannerAnchor}>
            <FooterStatusBanner
              message={footerDisplayMessage}
              tone={footerDisplayTone}
              isFloating
            />
          </View>
        ) : null}
      </View>

      {/* ── Opponent detail sheet ── */}
      {(() => {
        const detailPlayer = detailSeatIndex !== null ? (seatPlayers[detailSeatIndex] ?? null) : null;
        return (
          <OpponentDetailSheet
            player={detailPlayer}
            isDealer={tableState?.dealerSeatIndex === detailSeatIndex}
            isSmallBlind={tableState?.smallBlindSeatIndex === detailSeatIndex}
            isBigBlind={tableState?.bigBlindSeatIndex === detailSeatIndex}
            onDismiss={() => setDetailSeatIndex(null)}
          />
        );
      })()}

      {/* ── Bottom sheets ── */}
      <NativeBottomSheet visible={sheet != null} onDismiss={() => setSheet(null)}>
        {sheet === "menu" ? (
          <>
            <Text style={styles.sheetTitle}>Table</Text>
            <NativePanel variant="grouped">
              <NativeListRow
                title="Share Table Code"
                trailing={<Text style={styles.codeChip}>{roomId}</Text>}
                showsChevron
                isLast={!viewer}
                onPress={() => {
                  Share.share({ message: roomId });
                  playNativeFeedbackHaptic({ kind: "local_press", key: "share_code" }, { myPlayerId });
                }}
              />
              {viewer ? (
                <NativeListRow
                  title={leaveQueued ? "Cancel Leave" : "Leave Next Hand"}
                  destructive={leaveQueued}
                  showsChevron
                  isLast
                  onPress={() => { toggleLeave(); setSheet(null); }}
                />
              ) : null}
            </NativePanel>
          </>
        ) : null}

        {sheet === "seat" ? (
          <>
            <Text style={styles.sheetTitle}>Seat {(selectedSeatIndex ?? 0) + 1}</Text>

            <NativeTextField
              label="Your name"
              value={sitName}
              onChangeText={setSitName}
              placeholder="Player"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.buyInSectionLabel}>BUY-IN</Text>
            <View style={styles.buyInAmountRow}>
              <Text style={styles.buyInDollarSign}>$</Text>
              <NativeTextField
                ref={buyInRef}
                value={buyIn}
                onChangeText={(text) => {
                  const m = text.replace(/,/g, "").match(/^\d*\.?\d{0,2}/);
                  const valid = m ? m[0] : "";
                  if (valid !== text) buyInRef.current?.setNativeProps({ text: valid });
                  setBuyIn(valid);
                }}
                onBlur={() => {
                  const n = parseFloat(buyIn.replace(/,/g, "") || String(DEFAULT_BUY_IN_CENTS / 100));
                  if (!isNaN(n) && n > 0) setBuyIn(n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }}
                placeholder={(DEFAULT_BUY_IN_CENTS / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                keyboardType="decimal-pad"
                containerStyle={styles.buyInFieldFlex}
              />
            </View>

            <View style={styles.rebuyPresetRow}>
              {getBuyInPresets(tableState?.blinds?.big ?? DEFAULT_BUY_IN_CENTS).map((preset) => {
                const label = preset.dollars % 1 === 0
                  ? `$${preset.dollars.toFixed(0)}`
                  : `$${preset.dollars.toFixed(2)}`;
                const selected = parseFloat(buyIn.replace(/,/g, "")) === preset.dollars;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => setBuyIn(preset.dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                    style={[styles.rebuyPreset, selected && styles.rebuyPresetSelected]}
                  >
                    <Text style={[styles.rebuyPresetLabel, selected && styles.rebuyPresetLabelSelected]}>
                      {label}
                    </Text>
                    <Text style={[styles.rebuyPresetSub, selected && styles.rebuyPresetSubSelected]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <NativeButton label="Sit Down" onPress={confirmSit} />
          </>
        ) : null}

        {sheet === "raise" ? (
          <NativeRaiseSheetContent
            pot={tablePot}
            stack={viewer?.stack ?? 0}
            currentBet={viewer?.currentBet ?? 0}
            minRaise={minRaiseTotal}
            bigBlind={tableState?.blinds.big ?? 25}
            isFirstBet={(tableState?.roundBet ?? 0) === 0}
            onConfirm={(amount) => {
              sendViewerEvent((playerId) => ({
                type: "PLAYER_ACTION",
                playerId,
                action: "raise",
                amount,
              }), "medium");
              setSheet(null);
            }}
          />
        ) : null}

        {sheet === "foldConfirm" ? (
          <View style={styles.confirmSheetContent}>
            <Text style={styles.sheetTitle}>Fold hand?</Text>
            <Text style={[styles.sheetText, styles.confirmSheetText]}>
              You can check for free. Folding will give up this hand.
            </Text>
            <View style={styles.confirmSheetActions}>
              <NativeButton
                label="Cancel"
                tone="secondary"
                onPress={() => setSheet(null)}
                style={styles.confirmSheetButton}
              />
              <NativeButton
                label="Fold"
                tone="danger"
                onPress={() => {
                  sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "fold" }));
                  setSheet(null);
                }}
                style={styles.confirmSheetButton}
              />
            </View>
          </View>
        ) : null}

        {sheet === "seatManager" && viewer ? (
          <NativeSeatManager
            viewer={viewer}
            bigBlind={tableState?.blinds.big ?? 25}
            pendingUpdate={viewerPendingBoundaryUpdate}
            applyImmediately={isWaiting || isShowdown}
            amount={rebuyAmount}
            onAmountChange={setRebuyAmount}
            onCancelPending={() => {
              sendViewerEvent((playerId) => ({ type: "CANCEL_BOUNDARY_UPDATE", playerId }), "light");
            }}
            onDismiss={() => setSheet(null)}
            onSubmit={(update) => {
              sendViewerEvent((playerId) => ({
                type: "REQUEST_BOUNDARY_UPDATE",
                playerId,
                leaveSeat: update.leaveSeat ?? false,
                moveToSeatIndex: update.moveToSeatIndex ?? null,
                chipDelta: update.chipDelta ?? 0,
              }), "medium");
              setSheet(null);
            }}
          />
        ) : null}
      </NativeBottomSheet>
    </SafeAreaView>
  );
}

function createStyles(t: NativeTheme) { return StyleSheet.create({
  screen: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: t.colors.background,
  },
  feltZone: {
    flex: 1,
  },
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.28)",
    paddingHorizontal: 24,
  },
  blockingCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    padding: 22,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  blockingTitle: {
    color: t.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  blockingMessage: {
    color: t.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  bottomDock: {
    // Wrapper for HandPanel + actionDock so statusBannerAnchor is relative to this, not SafeAreaView
  },
  statusBannerAnchor: {
    position: "absolute",
    bottom: 74,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "center",
  },
  stripWrap: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },

  tableMiddle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 14,
  },
  feltWatermark: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    opacity: 0.07,
  },
  feltWatermarkText: {
    color: "#ffffff",
    fontSize: 45,
    fontWeight: "900",
  },
  potToolDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  potPanelLayer: {
    position: "relative",
    zIndex: 31,
  },

  utilityRail: {
    position: "relative",
    zIndex: 32,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  utilityChipSlot: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingUtility: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.72)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  utilityDisabled: {
    opacity: 0.35,
  },
  utilityIcon: {
    fontSize: 20,
  },

  actionDock: {
    minHeight: 84,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.background,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  actionDockActive: {
    borderTopWidth: 0,
  },
  actionRowOuter: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primarySlot: {
    flex: 1,
    position: "relative",
  },
  actionFocusRing: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -4,
    right: -4,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.10)",
    zIndex: 0,
  },
  disabledActions: {
    opacity: 0.55,
  },
  actionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 20,
  },
  foldAction: {},
  primaryAction: {
    zIndex: 1,
  },
  raiseAction: {},
  fullActionButton: {
    minHeight: 56,
    borderRadius: 20,
  },

  sheetTitle: {
    color: t.colors.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  sheetText: {
    color: t.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  confirmSheetContent: {
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 16,
  },
  confirmSheetText: {
    maxWidth: 320,
  },
  confirmSheetActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignSelf: "center",
    gap: 12,
    width: "100%",
    maxWidth: 320,
  },
  confirmSheetButton: {
    width: 140,
    minHeight: 48,
    borderRadius: 18,
  },

  // ── Rebuy / add-chips sheet ─────────────────────────────────────────────
  rebuyHeader: {
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  rebuyEyebrow: {
    color: t.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 4,
  },
  rebuyTitle: {
    color: t.colors.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  rebuySubtitle: {
    color: t.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  buyInSectionLabel: {
    color: t.colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  buyInAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buyInDollarSign: {
    color: t.colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  buyInFieldFlex: {
    flex: 1,
  },
  rebuyPresetRow: {
    flexDirection: "row",
    gap: 10,
  },
  rebuyPreset: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    backgroundColor: "rgba(15,23,42,0.04)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  rebuyPresetSelected: {
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  rebuyPresetLabel: {
    color: t.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  rebuyPresetLabelSelected: {
    color: t.colors.accent,
  },
  rebuyPresetSub: {
    color: t.colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  rebuyPresetSubSelected: {
    color: t.colors.accent,
  },
  seatManagerContent: {
    gap: 16,
  },
  pendingUpdateBox: {
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.32)",
    backgroundColor: "rgba(245,158,11,0.10)",
    padding: 14,
  },
  pendingUpdateLabel: {
    color: "#b45309",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  pendingUpdateText: {
    color: t.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  pendingCancelButton: {
    minHeight: 44,
    borderRadius: 16,
  },
  seatChoiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  seatChoice: {
    width: 44,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.04)",
  },
  seatChoiceSelected: {
    borderColor: "rgba(239,68,68,0.48)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  seatChoiceText: {
    color: t.colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  seatChoiceTextSelected: {
    color: t.colors.accent,
  },
  seatManagerSegment: {
    marginTop: 2,
  },
  seatManagerWarning: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  seatManagerActions: {
    flexDirection: "row",
    gap: 12,
  },
  seatManagerButton: {
    minHeight: 56,
    borderRadius: 18,
  },

  ledgerTable: { gap: 6 },
  ledgerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  ledgerHeaderText: {
    width: 60,
    color: t.colors.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "right",
    textTransform: "uppercase",
  },
  ledgerHeaderPlayerText: {
    flex: 1,
    minWidth: 0,
    color: t.colors.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "left",
    textTransform: "uppercase",
  },
  ledgerRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ledgerPlayerCell: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  ledgerName: {
    maxWidth: "100%",
    color: t.colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  ledgerSeated: {
    marginTop: 2,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.12)",
    color: "#16a34a",
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  ledgerAmount: {
    width: 60,
    color: t.colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  ledgerNet: {
    width: 60,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  ledgerPayouts: {
    marginTop: 12,
    gap: 6,
  },
  ledgerPayoutsTitle: {
    color: t.colors.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  ledgerPayoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ledgerPayoutFrom: {
    flex: 1,
    minWidth: 0,
    color: t.colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  ledgerPayoutArrow: {
    color: t.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  ledgerPayoutTo: {
    flex: 1,
    minWidth: 0,
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  ledgerPayoutAmount: {
    color: t.colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 4,
  },

  codeChip: {
    color: t.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },

  // ── Bomb pot sheet ───────────────────────────────────────────────────────
  bombHeader: {
    gap: 4,
    paddingBottom: 4,
  },
  bombLabel: {
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  bombSubtitle: {
    color: "#312e81",
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  bombHelper: {
    color: "rgba(79,70,229,0.55)",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  bombOptions: {
    flexDirection: "row",
    gap: 10,
  },
  bombOption: {
    flex: 1,
    minHeight: 100,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "rgba(99,102,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.20)",
  },
  bombOptionSelected: {
    backgroundColor: "rgba(99,102,241,0.16)",
    borderColor: "rgba(99,102,241,0.44)",
  },
  bombOptionPressed: {
    opacity: 0.78,
  },
  bombOptionMultiplier: {
    color: "#4338ca",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  bombOptionTextSelected: {
    color: "#312e81",
  },
  bombOptionBBLabel: {
    color: "#6366f1",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  bombOptionAmount: {
    color: "#6366f1",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  bombOptionAmountSelected: {
    color: "#4338ca",
  },

  // ── Raise panel ──────────────────────────────────────────────────────────
  raiseSheetContent: {
    gap: 16,
  },
  raiseAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  raiseStepSide: {
    alignItems: "center",
    gap: 6,
    width: 64,
  },
  raiseStepBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  raiseStepBtnPressed: {
    backgroundColor: "#e5e7eb",
  },
  raiseStepBtnDisabled: {
    opacity: 0.3,
  },
  raiseStepBtnText: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
  },
  raiseStepIncrement: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  raiseAmountCenter: {
    flex: 1,
    alignItems: "center",
  },
  raiseAmountText: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  raiseAllInLabel: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  sliderOuter: {
    height: 40,
    justifyContent: "center",
    position: "relative",
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  sliderFill: {
    height: 6,
    backgroundColor: "#ef4444",
    borderRadius: 3,
  },
  sliderThumb: {
    position: "absolute",
    width: RAISE_THUMB_SIZE,
    height: RAISE_THUMB_SIZE,
    borderRadius: RAISE_THUMB_SIZE / 2,
    backgroundColor: "#ef4444",
    top: (40 - RAISE_THUMB_SIZE) / 2,
    shadowColor: "#ef4444",
    shadowRadius: 8,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  raiseAllInFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ef4444",
  },
  raisePresetRow: {
    flexDirection: "row",
    gap: 8,
  },
  raisePreset: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  raisePresetPressed: {
    backgroundColor: "#e5e7eb",
  },
  raisePresetText: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  raiseConfirmBtn: {
    minHeight: 56,
    borderRadius: 20,
  },
}); }
