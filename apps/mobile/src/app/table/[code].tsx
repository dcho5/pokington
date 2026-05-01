import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@pokington/config";
import {
  requestNativeJoinToken,
  useGameConnection,
  type JoinTokenResponse,
  type PartyKitServerMessage,
} from "@pokington/network";
import {
  CommunityBoard,
  NativeBottomSheet,
  NativeButton,
  NativePokerChip,
  nativeLightTheme,
  type PlayerSummary,
} from "@pokington/ui/native";
import { formatCents } from "@pokington/shared";
import type {
  BombPotAnteBB,
  GameEvent,
  GameFeedbackCueEnvelope,
  RunResult,
  WinnerInfo,
} from "@pokington/engine";
import type { Card } from "@pokington/shared";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { playNativeFeedbackHaptic } from "../../lib/haptics";
import { getExpoRequestHostname } from "../../lib/nativePartyHost";

import TableHeader from "../../components/Table/TableHeader";
import OpponentStrip from "../../components/Table/OpponentStrip";
import type { TablePlayer } from "../../components/Table/PlayerBubble";
import HandPanel from "../../components/Table/HandPanel";
import FooterStatusBanner from "../../components/Table/FooterStatusBanner";

const PROTOCOL_VERSION = 4;
const MAX_SEATS = 10;
const DEFAULT_BUY_IN_CENTS = 10_000;
const DEG_PER_RAD = 180 / Math.PI;
const CHIP_HIGHLIGHT_BASE_ANGLE = Math.atan2(35 - 50, 62 - 50) * DEG_PER_RAD;
const DEFAULT_CHIP_ANGLE = -90 - CHIP_HIGHLIGHT_BASE_ANGLE;
const MOBILE_CHIP_POINT = { x: 0.5, y: 0.66 };

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
  isBombPot?: boolean;
  bombPotVote?: {
    anteBB: BombPotAnteBB;
    proposedBy: string;
    votes: Record<string, boolean>;
  } | null;
  bombPotNextHand?: { anteBB: BombPotAnteBB } | null;
  bombPotCooldown?: string[];
  pendingBoundaryUpdates?: Record<string, unknown>;
}

interface LedgerEntry {
  playerId: string;
  name: string;
  buyIns: number[];
  cashOuts: number[];
  isSeated: boolean;
  currentStack: number;
}

interface LedgerRow {
  playerId: string;
  name: string;
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
  isSeated: boolean;
}

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MobileServerMessage =
  | PartyKitServerMessage<PublicTableState>
  | { type: "PRIVATE_STATE"; holeCards: [Card, Card] | null; revealedHoleCards: Record<string, [Card | null, Card | null]> }
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
  const actorPoint = getMobileSeatPoint({ seatIndex: actorSeatIndex, viewerSeatIndex, totalSeats });
  if (!actorPoint) return DEFAULT_CHIP_ANGLE;
  return computeChipFacingAngle(MOBILE_CHIP_POINT, actorPoint);
}

function rectsMatch(a: LayoutRect | null, b: LayoutRect) {
  return !!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
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

export default function TableScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const roomId = String(params.code ?? "").toUpperCase();
  const [tableState, setTableState] = useState<PublicTableState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [holeCards, setHoleCards] = useState<[Card, Card] | null>(null);
  const [revealedHoleCards, setRevealedHoleCards] = useState<Record<string, [Card | null, Card | null]>>({});
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>([]);
  const [peekedCounts, setPeekedCounts] = useState<Record<string, number>>({});
  const [queuedLeavePlayerIds, setQueuedLeavePlayerIds] = useState<string[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"seat" | "ledger" | "bomb" | "raise" | "menu" | null>(null);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [sitName, setSitName] = useState("");
  const [buyIn, setBuyIn] = useState(String(DEFAULT_BUY_IN_CENTS / 100));
  const [raiseTotal, setRaiseTotal] = useState("");
  const [autoPeelEnabled, setAutoPeelEnabled] = useState(false);
  const [utilityRailLayout, setUtilityRailLayout] = useState<LayoutRect | null>(null);
  const [utilityChipLayout, setUtilityChipLayout] = useState<LayoutRect | null>(null);
  const seenFeedbackKeysRef = useRef(new Set<string>());
  const myPlayerIdRef = useRef<string | null>(null);
  const requestHostname = useMemo(() => getExpoRequestHostname(), []);

  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  const join = useCallback(
    ({ clientId }: { clientId: string; roomId: string }) => requestJoinToken(roomId, clientId, requestHostname),
    [requestHostname, roomId],
  );

  const handleMessage = useCallback((message: MobileServerMessage) => {
    switch (message.type) {
      case "TABLE_STATE": {
        setTableState(message.state);
        setError(null);
        const feedback = Array.isArray(message.feedback) ? message.feedback.filter(isFeedbackCue) : [];
        for (const cue of feedback) {
          if (seenFeedbackKeysRef.current.has(cue.key)) continue;
          seenFeedbackKeysRef.current.add(cue.key);
          playNativeFeedbackHaptic(cue, { myPlayerId: myPlayerIdRef.current });
        }
        break;
      }
      case "PRIVATE_STATE":
        setHoleCards(message.holeCards as [Card, Card] | null);
        setRevealedHoleCards((message.revealedHoleCards ?? {}) as Record<string, [Card | null, Card | null]>);
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
        setError(message.message || message.code);
        playNativeFeedbackHaptic({ kind: "action_error", key: `${Date.now()}:${message.code}` }, { myPlayerId: myPlayerIdRef.current });
        break;
    }
  }, []);

  const { connection } = useGameConnection<MobileServerMessage, GameEvent>({
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
      setError(null);
    },
    onJoinError: (nextError) => {
      setError(nextError.message);
      playNativeFeedbackHaptic({ kind: "action_error", key: `join:${nextError.message}` }, { myPlayerId: myPlayerIdRef.current });
    },
    onMessage: handleMessage,
  });

  useEffect(() => {
    return () => connection?.disconnect();
  }, [connection]);

  // Build rich TablePlayer array (superset of PlayerSummary, includes lastAction + hasCards)
  const tablePlayers = useMemo<TablePlayer[]>(() => {
    if (!tableState) return [];
    const actorId = tableState.needsToAct[0] ?? null;
    return Object.values(tableState.players)
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((player) => ({
        id: player.id,
        name: player.name,
        seatIndex: player.seatIndex,
        stack: player.stack,
        currentBet: player.currentBet,
        isFolded: player.isFolded,
        isAllIn: player.isAllIn,
        isAway: awayPlayerIds.includes(player.id),
        isActor: actorId === player.id,
        isViewer: myPlayerId === player.id,
        hasCards: player.hasCards,
        lastAction: player.lastAction ?? null,
      }));
  }, [awayPlayerIds, myPlayerId, tableState]);

  // Seat-indexed player slots for OpponentStrip (null = empty seat)
  const seatPlayers = useMemo(() => {
    const seats = Array.from<TablePlayer | null>({ length: MAX_SEATS }).fill(null);
    for (const player of tablePlayers) seats[player.seatIndex] = player;
    return seats;
  }, [tablePlayers]);

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
  const leaveQueued = !!myPlayerId && queuedLeavePlayerIds.includes(myPlayerId);
  const tablePot = (tableState?.pot ?? 0) + players.reduce((sum, p) => sum + p.currentBet, 0);

  const communityCards = tableState?.communityCards ?? [];
  const boardSets = tableState?.isBombPot
    ? [tableState.communityCards, tableState.communityCards2 ?? []]
    : tableState?.runResults?.length
      ? tableState.runResults.map((run) => run.board)
      : [communityCards];

  const ledgerRows = useMemo(() => deriveLedgerRows(ledgerEntries), [ledgerEntries]);

  // Footer status: show "Waiting for X..." when it's not our turn and someone needs to act
  const footerStatusMessage = useMemo(() => {
    if (!actorId || actorId === myPlayerId) return null;
    const actorName = tablePlayers.find((p) => p.id === actorId)?.name;
    if (!actorName) return null;
    return `Waiting for ${actorName}…`;
  }, [actorId, myPlayerId, tablePlayers]);

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
    const buyInCents = Math.max(0, Math.round(Number(buyIn || DEFAULT_BUY_IN_CENTS / 100) * 100));
    sendEvent(
      { type: "TAKE_SEAT", playerId: myPlayerId, name: sitName.trim() || "Player", seatIndex, buyIn: buyInCents },
      "medium",
    );
    setSheet(null);
  };

  const confirmRaise = () => {
    const total = Math.round(Number(raiseTotal || minRaiseTotal / 100) * 100);
    sendViewerEvent((playerId) => ({
      type: "PLAYER_ACTION",
      playerId,
      action: "raise",
      amount: Math.max(minRaiseTotal, total),
    }), "medium");
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
    setSheet(null);
  };

  const revealCard = (cardIndex: 0 | 1) => {
    connection?.revealCard(cardIndex);
    playNativeFeedbackHaptic({ kind: "local_press", key: `reveal:${cardIndex}`, strength: "medium" }, { myPlayerId });
  };

  const peekCard = (cardIndex: 0 | 1) => {
    connection?.peekCard(cardIndex, tableState?.handNumber ?? 0);
    playNativeFeedbackHaptic({ kind: "local_press", key: `peek:${cardIndex}` }, { myPlayerId });
  };

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
      {/* ── Header ── */}
      <TableHeader
        tableName={tableState?.tableName ?? `Table ${roomId}`}
        blinds={tableState?.blinds ?? null}
        sevenTwoBountyBB={tableState?.sevenTwoBountyBB}
        onBack={() => router.back()}
        onMenu={() => setSheet("menu")}
      />

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Connection issue</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Opponent Strip ── */}
      <View style={styles.stripWrap}>
        <OpponentStrip
          players={seatPlayers}
          dealerIndex={tableState?.dealerSeatIndex ?? null}
          smallBlindIndex={tableState?.smallBlindSeatIndex ?? null}
          bigBlindIndex={tableState?.bigBlindSeatIndex ?? null}
          seatSelectionLocked={!isWaiting && !isShowdown}
          onEmptySeatTap={openSeat}
          onPlayerTap={() => { /* opponent detail — out of scope */ }}
        />
      </View>

      {/* ── Table stage: boards + pot + overlays ── */}
      <View style={styles.tableStage}>
        <View style={styles.boardArea}>
          {boardSets.slice(0, 3).map((cards, index) => (
            <View key={`board-${index}`} style={styles.boardStack}>
              {boardSets.length > 1 ? (
                <Text style={styles.boardLabel}>
                  {tableState?.isBombPot ? `Board ${index + 1}` : `Run ${index + 1}`}
                </Text>
              ) : null}
              <CommunityBoard cards={cards} />
            </View>
          ))}
        </View>

        {(tableState?.pot ?? 0) > 0 && (
          <View style={styles.potPill}>
            {players.some((p) => p.currentBet > 0) ? (
              <>
                <Text style={styles.potValue}>{cents(tableState?.pot ?? 0)}</Text>
                <View style={styles.potDivider} />
                <Text style={styles.potLabel}>Total {cents(tablePot)}</Text>
              </>
            ) : (
              <>
                <Text style={styles.potLabel}>POT</Text>
                <Text style={styles.potValue}>{cents(tableState?.pot ?? 0)}</Text>
              </>
            )}
          </View>
        )}

        {tableState?.bombPotVote ? (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Bomb pot vote</Text>
            <Text style={styles.overlayText}>{tableState.bombPotVote.anteBB} BB ante proposed</Text>
            <View style={styles.inlineActions}>
              <NativeButton label="Approve" onPress={() => voteBombPot(true)} style={styles.inlineButton} />
              <NativeButton label="Reject" tone="secondary" onPress={() => voteBombPot(false)} style={styles.inlineButton} />
            </View>
          </View>
        ) : null}

        {tableState?.phase === "voting" ? (
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Run it?</Text>
            <View style={styles.inlineActions}>
              <NativeButton label="1×" tone="secondary" onPress={() => voteRun(1)} style={styles.inlineButton} />
              <NativeButton label="2×" onPress={() => voteRun(2)} style={styles.inlineButton} />
              <NativeButton label="3×" tone="secondary" onPress={() => voteRun(3)} style={styles.inlineButton} />
            </View>
          </View>
        ) : null}

        {tableState?.winners?.length ? (
          <View style={styles.winnerBanner}>
            <Text style={styles.winnerTitle}>Winner</Text>
            <Text style={styles.winnerText}>
              {tableState.winners
                .map((w) => `${players.find((p) => p.id === w.playerId)?.name ?? "Player"} ${cents(w.amount)}`)
                .join(" · ")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Utility rail: bomb · chip · ledger ── */}
      <View
        style={styles.utilityRail}
        onLayout={(e: LayoutChangeEvent) => setUtilityRailLayout(e.nativeEvent.layout)}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!viewer || !!tableState?.bombPotVote}
          onPress={() => setSheet("bomb")}
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
            setSheet("ledger");
            playNativeFeedbackHaptic({ kind: "local_press", key: "ledger" }, { myPlayerId });
          }}
          style={styles.floatingUtility}
        >
          <Text style={styles.utilityIcon}>💰</Text>
        </Pressable>
      </View>

      {/* ── Hand Panel ── */}
      <HandPanel
        viewer={viewer}
        holeCards={holeCards ?? (myPlayerId && revealedHoleCards[myPlayerId] ? revealedHoleCards[myPlayerId] as [Card, Card] : null)}
        communityCards={communityCards}
        leaveQueued={leaveQueued}
        autoPeelEnabled={autoPeelEnabled}
        onIdentityPress={toggleLeave}
        onPeekCard={(index) => peekCard(index)}
        onRevealCard={(index) => revealCard(index)}
        onToggleAutoPeel={() => setAutoPeelEnabled((v) => !v)}
      />

      {/* ── Footer status banner ── */}
      <FooterStatusBanner message={footerStatusMessage} />

      {/* ── Action dock ── */}
      <View style={styles.actionDock}>
        {isWaiting || (isShowdown && tableState?.winners?.length) ? (
          <NativeButton
            label="Start Game"
            disabled={!viewer}
            onPress={() => sendEvent({ type: "START_HAND" }, "medium")}
            style={styles.fullActionButton}
          />
        ) : (
          <View style={[styles.actionRow, !canAct && styles.disabledActions]}>
            <NativeButton
              label="Fold"
              tone="danger"
              disabled={!canAct}
              onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "fold" }))}
              style={[styles.actionButton, styles.foldAction]}
            />
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
              style={styles.actionButton}
            />
            {canRaise ? (
              <NativeButton
                label="Raise"
                disabled={!canRaise}
                onPress={() => {
                  setRaiseTotal(String(minRaiseTotal / 100));
                  setSheet("raise");
                }}
                style={[styles.actionButton, styles.raiseAction]}
              />
            ) : (
              <NativeButton
                label="All-in"
                disabled={!canAllIn}
                onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "all-in" }), "heavy")}
                style={[styles.actionButton, styles.raiseAction]}
              />
            )}
          </View>
        )}
      </View>

      {/* ── Bottom sheets ── */}
      <NativeBottomSheet visible={sheet != null} onDismiss={() => setSheet(null)}>
        {sheet === "menu" ? (
          <>
            <Text style={styles.sheetTitle}>Table Menu</Text>
            <NativeButton label="Session Ledger" tone="secondary" onPress={() => setSheet("ledger")} />
            {viewer ? (
              <NativeButton
                label={leaveQueued ? "Cancel Leave" : "Leave Table"}
                tone="secondary"
                onPress={() => { toggleLeave(); setSheet(null); }}
              />
            ) : null}
          </>
        ) : null}

        {sheet === "seat" ? (
          <>
            <Text style={styles.sheetTitle}>Seat {(selectedSeatIndex ?? 0) + 1}</Text>
            <TextInput
              value={sitName}
              onChangeText={setSitName}
              placeholder="Your name"
              placeholderTextColor={nativeLightTheme.colors.muted}
              style={styles.input}
            />
            <TextInput
              value={buyIn}
              onChangeText={setBuyIn}
              placeholder="Buy-in dollars"
              keyboardType="number-pad"
              placeholderTextColor={nativeLightTheme.colors.muted}
              style={styles.input}
            />
            <NativeButton label="Sit Down" onPress={confirmSit} />
          </>
        ) : null}

        {sheet === "ledger" ? (
          <>
            <Text style={styles.sheetTitle}>Session Ledger</Text>
            {ledgerRows.length > 0 ? (
              <View style={styles.ledgerTable}>
                <View style={styles.ledgerHeader}>
                  <Text style={styles.ledgerHeaderPlayerText}>Player</Text>
                  <Text style={styles.ledgerHeaderText}>Buy-in</Text>
                  <Text style={styles.ledgerHeaderText}>Out</Text>
                  <Text style={styles.ledgerHeaderText}>Net</Text>
                </View>
                {ledgerRows.map((row) => {
                  const netPrefix = row.net > 0 ? "+" : row.net < 0 ? "-" : "";
                  const netColor =
                    row.net > 0 ? "#16a34a" : row.net < 0 ? nativeLightTheme.colors.accent : nativeLightTheme.colors.muted;
                  return (
                    <View key={row.playerId} style={styles.ledgerRow}>
                      <View style={styles.ledgerPlayerCell}>
                        <Text style={styles.ledgerName} numberOfLines={1}>{row.name}</Text>
                        {row.isSeated ? <Text style={styles.ledgerSeated}>seated</Text> : null}
                      </View>
                      <Text style={styles.ledgerAmount}>{cents(row.totalBuyIn)}</Text>
                      <Text style={styles.ledgerAmount}>{cents(row.totalCashOut)}</Text>
                      <Text style={[styles.ledgerNet, { color: netColor }]}>
                        {netPrefix}{cents(Math.abs(row.net))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.sheetText}>No players have sat down yet.</Text>
            )}
          </>
        ) : null}

        {sheet === "bomb" ? (
          <>
            <Text style={styles.sheetTitle}>Bomb Pot</Text>
            <View style={styles.inlineActions}>
              {[2, 4, 8].map((ante) => (
                <NativeButton
                  key={ante}
                  label={`${ante} BB`}
                  onPress={() => proposeBombPot(ante as BombPotAnteBB)}
                  style={styles.inlineButton}
                />
              ))}
            </View>
          </>
        ) : null}

        {sheet === "raise" ? (
          <>
            <Text style={styles.sheetTitle}>Raise Total</Text>
            <Text style={styles.sheetText}>Minimum {cents(minRaiseTotal)}</Text>
            <TextInput
              value={raiseTotal}
              onChangeText={setRaiseTotal}
              placeholder="Total bet dollars"
              keyboardType="number-pad"
              placeholderTextColor={nativeLightTheme.colors.muted}
              style={styles.input}
            />
            <NativeButton label="Raise" onPress={confirmRaise} />
          </>
        ) : null}

        <NativeButton label="Close" tone="secondary" onPress={() => setSheet(null)} />
      </NativeBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f5f7",
  },

  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.accent,
    backgroundColor: "#fff7f7",
    padding: 12,
  },
  errorTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  errorText: {
    color: nativeLightTheme.colors.muted,
    fontSize: 13,
  },

  stripWrap: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },

  tableStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  boardArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  boardStack: {
    alignItems: "center",
    gap: 4,
  },
  boardLabel: {
    color: "rgba(100,116,139,0.8)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  potPill: {
    minWidth: 140,
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#ef4444",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 10,
    shadowColor: "#ef4444",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  potValue: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  potDivider: {
    width: "100%",
    height: 1,
    marginVertical: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  potLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
  },

  overlayCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 14,
    gap: 10,
    marginTop: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  overlayTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  overlayText: {
    color: nativeLightTheme.colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  winnerBanner: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 14,
    alignItems: "center",
    marginTop: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  winnerTitle: {
    color: nativeLightTheme.colors.accent,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  winnerText: {
    color: nativeLightTheme.colors.text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  utilityRail: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginTop: 4,
    marginBottom: 4,
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
    borderTopColor: "rgba(148,163,184,0.14)",
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
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
  raiseAction: {},
  fullActionButton: {
    minHeight: 56,
    borderRadius: 20,
  },

  inlineActions: {
    flexDirection: "row",
    gap: 10,
  },
  inlineButton: {
    flex: 1,
  },

  sheetTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  sheetText: {
    color: nativeLightTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
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
    color: nativeLightTheme.colors.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "right",
    textTransform: "uppercase",
  },
  ledgerHeaderPlayerText: {
    flex: 1,
    minWidth: 0,
    color: nativeLightTheme.colors.faint,
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
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: nativeLightTheme.colors.surfaceMuted,
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
    color: nativeLightTheme.colors.text,
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
    color: nativeLightTheme.colors.muted,
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

  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: nativeLightTheme.colors.surfaceMuted,
    color: nativeLightTheme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: 16,
  },
});
