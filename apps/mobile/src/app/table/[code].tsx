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
  NativeCard,
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
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { playNativeFeedbackHaptic } from "../../lib/haptics";
import { getExpoRequestHostname } from "../../lib/nativePartyHost";

const PROTOCOL_VERSION = 4;
const MAX_SEATS = 10;
const DEFAULT_BUY_IN_CENTS = 10_000;
const DEG_PER_RAD = 180 / Math.PI;
const CHIP_HIGHLIGHT_BASE_ANGLE = Math.atan2(35 - 50, 62 - 50) * DEG_PER_RAD;
const DEFAULT_CHIP_ANGLE = -90 - CHIP_HIGHLIGHT_BASE_ANGLE;
const MOBILE_CHIP_POINT = { x: 0.5, y: 0.66 };
const MOBILE_SELF_POINT = { x: 0.5, y: 0.88 };
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

function cardKey(card: Card | null | undefined, index: number) {
  return `${card?.rank ?? "empty"}-${card?.suit ?? "slot"}-${index}`;
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
  if (seatIndex == null || seatIndex < 0 || seatIndex >= totalSeats) {
    return null;
  }

  if (viewerSeatIndex != null && seatIndex === viewerSeatIndex) {
    return MOBILE_SELF_POINT;
  }

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
  const actorPoint = getMobileSeatPoint({
    seatIndex: actorSeatIndex,
    viewerSeatIndex,
    totalSeats,
  });

  if (!actorPoint) {
    return DEFAULT_CHIP_ANGLE;
  }

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.trim().slice(0, 2) || "?").toUpperCase();
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

function BoardCards({ cards }: { cards: Card[] }) {
  const paddedCards = [...cards, ...Array.from<Card | null>({ length: Math.max(0, 5 - cards.length) }).fill(null)].slice(0, 5);
  return (
    <View style={styles.boardRow}>
      {paddedCards.map((card, index) => (
        card ? (
          <NativeCard key={cardKey(card, index)} card={card} compact style={styles.boardCard} />
        ) : (
          <View key={cardKey(card, index)} style={[styles.boardCard, styles.boardCardPlaceholder]} />
        )
      ))}
    </View>
  );
}

function SeatBubble({
  player,
  seatIndex,
  isDealer,
  isSmallBlind,
  isBigBlind,
  locked,
  onPress,
}: {
  player: PlayerSummary | null;
  seatIndex: number;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const badges = [
    isDealer ? "D" : null,
    isSmallBlind ? "SB" : null,
    isBigBlind ? "BB" : null,
  ].filter(Boolean);
  const initials = player ? (player.isViewer ? "YOU" : getInitials(player.name)) : String(seatIndex + 1);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={player ? `Seat ${seatIndex + 1}, ${player.name}` : `Empty seat ${seatIndex + 1}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.seatBubble,
        player?.isViewer && styles.viewerSeat,
        player?.isActor && styles.actorSeat,
        !player && styles.emptySeat,
        locked && !player && styles.lockedSeat,
        pressed && styles.pressed,
      ]}
    >
      {player ? (
        <>
          <View style={styles.seatAvatar}>
            <Text style={styles.seatAvatarText}>{initials}</Text>
          </View>
          {player.currentBet ? <Text style={styles.seatBet}>{cents(player.currentBet)}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.emptySeatLabel}>Seat</Text>
          <Text style={styles.emptySeatNumber}>{seatIndex + 1}</Text>
        </>
      )}
      {badges.length > 0 ? (
        <View style={styles.seatBadge}>
          <Text style={styles.seatBadgeText}>{badges[0]}</Text>
        </View>
      ) : null}
    </Pressable>
  );
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
  const [seatRailLayout, setSeatRailLayout] = useState<LayoutRect | null>(null);
  const [seatRailOuterLayout, setSeatRailOuterLayout] = useState<LayoutRect | null>(null);
  const [seatRailInnerLayout, setSeatRailInnerLayout] = useState<LayoutRect | null>(null);
  const [seatSlotLayouts, setSeatSlotLayouts] = useState<Array<LayoutRect | null>>(() =>
    Array.from<LayoutRect | null>({ length: MAX_SEATS }).fill(null),
  );
  const [utilityRailLayout, setUtilityRailLayout] = useState<LayoutRect | null>(null);
  const [utilityChipLayout, setUtilityChipLayout] = useState<LayoutRect | null>(null);
  const seenFeedbackKeysRef = useRef(new Set<string>());
  const myPlayerIdRef = useRef<string | null>(null);
  const requestHostname = useMemo(() => getExpoRequestHostname(), []);

  const handleSeatSlotLayout = useCallback((seatIndex: number, event: LayoutChangeEvent) => {
    const nextLayout = event.nativeEvent.layout;
    setSeatSlotLayouts((current) => {
      if (rectsMatch(current[seatIndex], nextLayout)) return current;
      const next = [...current];
      next[seatIndex] = nextLayout;
      return next;
    });
  }, []);

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

  const { connection, status } = useGameConnection<MobileServerMessage, GameEvent>({
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

  const players = useMemo<PlayerSummary[]>(() => {
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
      }));
  }, [awayPlayerIds, myPlayerId, tableState]);

  const seatPlayers = useMemo(() => {
    const seats = Array.from<PlayerSummary | null>({ length: MAX_SEATS }).fill(null);
    for (const player of players) seats[player.seatIndex] = player;
    return seats;
  }, [players]);

  const viewer = players.find((player) => player.id === myPlayerId) ?? null;
  const actorId = tableState?.needsToAct[0] ?? null;
  const activeSeatIndex = players.find((player) => player.id === actorId)?.seatIndex ?? null;
  const fallbackChipGlowAngle = computeMobileChipAngle({
    actorSeatIndex: activeSeatIndex,
    viewerSeatIndex: viewer?.seatIndex ?? null,
    totalSeats: MAX_SEATS,
  });
  const chipGlowAngle = useMemo(() => {
    const activeSeatLayout = activeSeatIndex == null ? null : seatSlotLayouts[activeSeatIndex];
    if (
      !seatRailLayout ||
      !seatRailOuterLayout ||
      !seatRailInnerLayout ||
      !utilityRailLayout ||
      !utilityChipLayout ||
      !activeSeatLayout
    ) {
      return fallbackChipGlowAngle;
    }

    const seatRailOrigin = {
      x: seatRailLayout.x + seatRailOuterLayout.x + seatRailInnerLayout.x,
      y: seatRailLayout.y + seatRailOuterLayout.y + seatRailInnerLayout.y,
    };
    const chipOrigin = {
      x: utilityRailLayout.x,
      y: utilityRailLayout.y,
    };

    return computeChipFacingAngle(
      centerOf(utilityChipLayout, chipOrigin),
      centerOf(activeSeatLayout, seatRailOrigin),
    );
  }, [
    activeSeatIndex,
    fallbackChipGlowAngle,
    seatRailInnerLayout,
    seatRailLayout,
    seatRailOuterLayout,
    seatSlotLayouts,
    utilityChipLayout,
    utilityRailLayout,
  ]);
  const canAct = !!viewer && actorId === myPlayerId;
  const callAmount = viewer && tableState ? Math.max(0, tableState.roundBet - viewer.currentBet) : 0;
  const lastRaise = tableState?.lastLegalRaiseIncrement ?? tableState?.blinds.big ?? 0;
  const minRaiseTotal = tableState
    ? (tableState.isBlindIncomplete ? tableState.blinds.big : tableState.roundBet + Math.max(lastRaise, tableState.blinds.big))
    : 0;
  const canCheck = canAct && callAmount <= 0;
  const canRaise = canAct && !!viewer && !(tableState?.closedActors ?? []).includes(viewer.id) && viewer.stack > callAmount;
  const canAllIn = canAct && !!viewer && viewer.stack > 0;
  const isWaiting = tableState?.phase === "waiting";
  const isShowdown = tableState?.phase === "showdown";
  const leaveQueued = !!myPlayerId && queuedLeavePlayerIds.includes(myPlayerId);
  const tablePot = (tableState?.pot ?? 0) + players.reduce((sum, player) => sum + player.currentBet, 0);
  const boardSets = tableState?.isBombPot
    ? [tableState.communityCards, tableState.communityCards2 ?? []]
    : tableState?.runResults?.length
      ? tableState.runResults.map((run) => run.board)
      : [tableState?.communityCards ?? []];
  const ledgerRows = useMemo(() => deriveLedgerRows(ledgerEntries), [ledgerEntries]);

  const sendEvent = useCallback((event: GameEvent, strength: "light" | "medium" | "heavy" = "light") => {
    connection?.sendAction(event);
    playNativeFeedbackHaptic({ kind: "local_press", key: `${event.type}:${Date.now()}`, strength }, { myPlayerId: myPlayerIdRef.current });
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
    sendEvent({
      type: "TAKE_SEAT",
      playerId: myPlayerId,
      name: sitName.trim() || "Player",
      seatIndex,
      buyIn: buyInCents,
    }, "medium");
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
      <View style={styles.headerBar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.tableName} numberOfLines={1}>{tableState?.tableName || `Table ${roomId}`}</Text>
        <View style={styles.headerRight}>
          {(tableState?.sevenTwoBountyBB ?? 0) > 0 ? (
            <Text style={styles.bountyPill}>7-2 {tableState?.sevenTwoBountyBB}×</Text>
          ) : null}
          {tableState?.blinds ? (
            <Text style={styles.blindsPill}>{cents(tableState.blinds.small)} / {cents(tableState.blinds.big)}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Table menu"
            onPress={() => setSheet("menu")}
            style={styles.menuButton}
          >
            <Text style={styles.menuDots}>⋮</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Connection issue</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.seatRail} onLayout={(event) => setSeatRailLayout(event.nativeEvent.layout)}>
        <View style={styles.seatRailOuter} onLayout={(event) => setSeatRailOuterLayout(event.nativeEvent.layout)}>
          <View style={styles.seatRailInner} onLayout={(event) => setSeatRailInnerLayout(event.nativeEvent.layout)}>
            {seatPlayers.map((player, seatIndex) => (
              <View
                key={`seat-slot-${seatIndex}`}
                onLayout={(event) => handleSeatSlotLayout(seatIndex, event)}
                style={[styles.seatSlot, seatSlotPositionStyles[seatIndex]]}
              >
                <SeatBubble
                  player={player}
                  seatIndex={seatIndex}
                  isDealer={tableState?.dealerSeatIndex === seatIndex}
                  isSmallBlind={tableState?.smallBlindSeatIndex === seatIndex}
                  isBigBlind={tableState?.bigBlindSeatIndex === seatIndex}
                  locked={!isWaiting && !isShowdown}
                  onPress={() => openSeat(seatIndex)}
                />
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.tableStage}>
        <View style={styles.boardArea}>
          {boardSets.slice(0, 3).map((cards, index) => (
            <View key={`board-${index}`} style={styles.boardStack}>
              {boardSets.length > 1 ? <Text style={styles.boardLabel}>{tableState?.isBombPot ? `Board ${index + 1}` : `Run ${index + 1}`}</Text> : null}
              <BoardCards cards={cards} />
            </View>
          ))}
        </View>
        <View style={styles.potPill}>
          <Text style={styles.potValue}>{cents(tableState?.pot ?? 0)}</Text>
          {players.some((player) => player.currentBet > 0) ? (
            <>
              <View style={styles.potDivider} />
              <Text style={styles.potLabel}>Total {cents(tablePot)}</Text>
            </>
          ) : (
            <Text style={styles.potLabel}>Pot</Text>
          )}
        </View>

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
              <NativeButton label="1x" tone="secondary" onPress={() => voteRun(1)} style={styles.inlineButton} />
              <NativeButton label="2x" onPress={() => voteRun(2)} style={styles.inlineButton} />
              <NativeButton label="3x" tone="secondary" onPress={() => voteRun(3)} style={styles.inlineButton} />
            </View>
          </View>
        ) : null}

        {tableState?.winners?.length ? (
          <View style={styles.winnerBanner}>
            <Text style={styles.winnerTitle}>Winner</Text>
            <Text style={styles.winnerText}>
              {tableState.winners.map((winner) => `${players.find((player) => player.id === winner.playerId)?.name ?? "Player"} ${cents(winner.amount)}`).join(" · ")}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.utilityRail} onLayout={(event) => setUtilityRailLayout(event.nativeEvent.layout)}>
        <Pressable
          accessibilityRole="button"
          disabled={!viewer || !!tableState?.bombPotVote}
          onPress={() => setSheet("bomb")}
          style={[styles.floatingUtility, (!viewer || !!tableState?.bombPotVote) && styles.utilityDisabled]}
        >
          <Text style={styles.utilityIcon}>💣</Text>
        </Pressable>
        <View style={styles.utilityChipSlot} onLayout={(event) => setUtilityChipLayout(event.nativeEvent.layout)}>
          <NativePokerChip size={44} glowAngle={chipGlowAngle} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => { setSheet("ledger"); playNativeFeedbackHaptic({ kind: "local_press", key: "ledger" }, { myPlayerId }); }}
          style={styles.floatingUtility}
        >
          <Text style={styles.utilityIcon}>💰</Text>
        </Pressable>
      </View>

      <View style={styles.handPanel}>
        <Pressable
          accessibilityRole={viewer ? "button" : undefined}
          onPress={toggleLeave}
          style={styles.handIdentity}
        >
          {viewer ? <Text style={styles.youBadge}>You</Text> : null}
          <View style={styles.viewerAvatar}>
            <Text style={styles.viewerAvatarText}>{viewer ? viewer.name.slice(0, 2).toUpperCase() : "IN"}</Text>
          </View>
          <Text style={styles.handName} numberOfLines={1}>{viewer?.name ?? "Not seated"}</Text>
          <Text style={styles.handMeta} numberOfLines={1}>{viewer ? (leaveQueued ? "leaving next hand" : "tap to leave") : "tap an open seat"}</Text>
        </Pressable>
        <View style={styles.handCards}>
          {[0, 1].map((index) => {
            const card = holeCards?.[index] ?? revealedHoleCards[myPlayerId ?? ""]?.[index] ?? null;
            return (
              <Pressable
                key={`hole-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Hole card ${index + 1}`}
                onPress={() => peekCard(index as 0 | 1)}
                onLongPress={() => revealCard(index as 0 | 1)}
                style={styles.holeCardWrap}
              >
                <NativeCard card={card} hidden={!card} style={styles.holeCard} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.handStats}>
          <Text style={styles.handStatsLabel}>Hand</Text>
          <Text style={styles.handStatsValue}>--</Text>
          {viewer?.currentBet ? (
            <>
              <Text style={styles.handStatsLabel}>Bet</Text>
              <Text style={styles.handBet}>{cents(viewer.currentBet)}</Text>
            </>
          ) : null}
          <Text style={styles.handStatsLabel}>Stack</Text>
          <Text style={styles.stackValue}>{viewer ? cents(viewer.stack) : "--"}</Text>
        </View>
      </View>

      <View style={styles.actionDock}>
        {isWaiting || (isShowdown && tableState?.winners?.length) ? (
          <NativeButton label="Start Game" disabled={!viewer} onPress={() => sendEvent({ type: "START_HAND" }, "medium")} style={styles.fullActionButton} />
        ) : (
          <View style={[styles.actionRow, !canAct && styles.disabledActions]}>
            <NativeButton label="Fold" tone="danger" disabled={!canAct} onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "fold" }))} style={styles.actionButton} />
            <NativeButton
              label={canCheck ? "Check" : `Call ${cents(callAmount)}`}
              disabled={!canAct}
              onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: canCheck ? "check" : "call" }))}
              style={styles.actionButton}
            />
            {canRaise ? (
              <NativeButton label="Raise" disabled={!canRaise} onPress={() => { setRaiseTotal(String(minRaiseTotal / 100)); setSheet("raise"); }} style={styles.actionButton} />
            ) : (
              <NativeButton label="All-in" disabled={!canAllIn} onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "all-in" }), "heavy")} style={styles.actionButton} />
            )}
          </View>
        )}
      </View>

      <NativeBottomSheet visible={sheet != null} onDismiss={() => setSheet(null)}>
          {sheet === "menu" ? (
            <>
              <Text style={styles.sheetTitle}>Table Menu</Text>
              <NativeButton
                label="Session Ledger"
                tone="secondary"
                onPress={() => setSheet("ledger")}
              />
              {viewer ? (
                <NativeButton
                  label={leaveQueued ? "Cancel Leave" : "Leave Table"}
                  tone="secondary"
                  onPress={() => {
                    toggleLeave();
                    setSheet(null);
                  }}
                />
              ) : null}
            </>
          ) : null}
          {sheet === "seat" ? (
            <>
              <Text style={styles.sheetTitle}>Seat {(selectedSeatIndex ?? 0) + 1}</Text>
              <TextInput value={sitName} onChangeText={setSitName} placeholder="Your name" placeholderTextColor={nativeLightTheme.colors.muted} style={styles.input} />
              <TextInput value={buyIn} onChangeText={setBuyIn} placeholder="Buy-in dollars" keyboardType="number-pad" placeholderTextColor={nativeLightTheme.colors.muted} style={styles.input} />
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
                    const netColor = row.net > 0 ? "#16a34a" : row.net < 0 ? nativeLightTheme.colors.accent : nativeLightTheme.colors.muted;
                    return (
                      <View key={row.playerId} style={styles.ledgerRow}>
                        <View style={styles.ledgerPlayerCell}>
                          <Text style={styles.ledgerName} numberOfLines={1}>{row.name}</Text>
                          {row.isSeated ? <Text style={styles.ledgerSeated}>seated</Text> : null}
                        </View>
                        <Text style={styles.ledgerAmount}>{cents(row.totalBuyIn)}</Text>
                        <Text style={styles.ledgerAmount}>{cents(row.totalCashOut)}</Text>
                        <Text style={[styles.ledgerNet, { color: netColor }]}>{netPrefix}{cents(Math.abs(row.net))}</Text>
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
                  <NativeButton key={ante} label={`${ante} BB`} onPress={() => proposeBombPot(ante as BombPotAnteBB)} style={styles.inlineButton} />
                ))}
              </View>
            </>
          ) : null}
          {sheet === "raise" ? (
            <>
              <Text style={styles.sheetTitle}>Raise Total</Text>
              <Text style={styles.sheetText}>Minimum {cents(minRaiseTotal)}</Text>
              <TextInput value={raiseTotal} onChangeText={setRaiseTotal} placeholder="Total bet dollars" keyboardType="number-pad" placeholderTextColor={nativeLightTheme.colors.muted} style={styles.input} />
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
    backgroundColor: nativeLightTheme.colors.background,
  },
  headerBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(209,213,219,0.58)",
    backgroundColor: nativeLightTheme.colors.header,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  backArrow: {
    color: nativeLightTheme.colors.text,
    fontSize: 42,
    lineHeight: 42,
    fontWeight: "500",
  },
  tableName: {
    flex: 1,
    color: nativeLightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "58%",
  },
  bountyPill: {
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.24)",
    backgroundColor: "rgba(239,68,68,0.1)",
    color: nativeLightTheme.colors.accent,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  blindsPill: {
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.78)",
    color: "#5b6070",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.82)",
    ...nativeLightTheme.shadow.soft,
  },
  menuDots: {
    color: nativeLightTheme.colors.text,
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "900",
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
  seatRail: {
    height: 148,
    paddingTop: 14,
    paddingHorizontal: 5,
  },
  seatRailOuter: {
    height: 128,
    borderRadius: 34,
    backgroundColor: "#2b3a4e",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 16,
    ...nativeLightTheme.shadow.surface,
  },
  seatRailInner: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: "#111a26",
    overflow: "visible",
  },
  seatSlot: {
    position: "absolute",
    width: 56,
    height: 54,
    marginLeft: -28,
    marginTop: -27,
  },
  seatBubble: {
    width: 56,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  viewerSeat: {
    borderWidth: 2,
    borderColor: "rgba(239,68,68,0.42)",
  },
  actorSeat: {
    transform: [{ scale: 1.06 }],
  },
  emptySeat: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(156,163,175,0.44)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  lockedSeat: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.78,
  },
  seatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: nativeLightTheme.colors.accentStrong,
  },
  seatAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  emptySeatLabel: {
    position: "absolute",
    top: 12,
    color: "rgba(156,163,175,0.72)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  emptySeatNumber: {
    position: "absolute",
    top: 24,
    color: "rgba(156,163,175,0.72)",
    fontSize: 16,
    fontWeight: "900",
  },
  seatBet: {
    position: "absolute",
    bottom: -9,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: nativeLightTheme.colors.yellow,
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  seatBadge: {
    position: "absolute",
    right: -3,
    top: -4,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: nativeLightTheme.colors.yellow,
    backgroundColor: nativeLightTheme.colors.tableInner,
  },
  seatBadgeText: {
    color: nativeLightTheme.colors.yellow,
    fontSize: 8,
    fontWeight: "900",
  },
  tableStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 6,
  },
  boardArea: {
    minHeight: 88,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  boardStack: {
    alignItems: "center",
    gap: 6,
  },
  boardLabel: {
    color: nativeLightTheme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  boardRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  boardCard: {
    width: 44,
  },
  boardCardPlaceholder: {
    aspectRatio: 0.72,
    opacity: 0,
  },
  potPill: {
    minWidth: 142,
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: nativeLightTheme.colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...nativeLightTheme.shadow.red,
  },
  potDivider: {
    width: "100%",
    height: 1,
    marginVertical: 8,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  potLabel: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  potValue: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
  },
  overlayCard: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 16,
    gap: 10,
    ...nativeLightTheme.shadow.soft,
  },
  overlayTitle: {
    color: nativeLightTheme.colors.text,
    fontSize: 16,
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
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 16,
    alignItems: "center",
    ...nativeLightTheme.shadow.soft,
  },
  winnerTitle: {
    color: nativeLightTheme.colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  winnerText: {
    color: nativeLightTheme.colors.text,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  utilityRail: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  utilityChipSlot: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingUtility: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.62)",
    ...nativeLightTheme.shadow.soft,
  },
  utilityDisabled: {
    opacity: 0.36,
  },
  utilityIcon: {
    fontSize: 21,
  },
  handPanel: {
    height: 134,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  handIdentity: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 10,
    ...nativeLightTheme.shadow.soft,
  },
  youBadge: {
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: "#fee2e2",
    color: nativeLightTheme.colors.accent,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  viewerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e2c5c",
  },
  viewerAvatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  handName: {
    maxWidth: "100%",
    color: nativeLightTheme.colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  handMeta: {
    color: nativeLightTheme.colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  handCards: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  holeCardWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  holeCard: {
    width: 84,
  },
  handStats: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: nativeLightTheme.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 10,
    gap: 4,
    ...nativeLightTheme.shadow.soft,
  },
  handStatsLabel: {
    color: nativeLightTheme.colors.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  handStatsValue: {
    color: nativeLightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  handBet: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: nativeLightTheme.colors.yellow,
    color: "#000000",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stackValue: {
    color: nativeLightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  actionDock: {
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: "rgba(209,213,219,0.7)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
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
  },
  fullActionButton: {
    minHeight: 56,
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
  ledgerTable: {
    gap: 6,
  },
  ledgerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  ledgerHeaderText: {
    width: 62,
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
    minHeight: 48,
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
    textAlign: "left",
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
    width: 62,
    color: nativeLightTheme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  ledgerNet: {
    width: 62,
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

const seatSlotPositionStyles: ViewStyle[] = [
  { left: "50%", top: "24%" },
  { left: "70%", top: "24%" },
  { left: "90%", top: "24%" },
  { left: "90%", top: "68%" },
  { left: "70%", top: "68%" },
  { left: "50%", top: "68%" },
  { left: "30%", top: "68%" },
  { left: "10%", top: "68%" },
  { left: "10%", top: "24%" },
  { left: "30%", top: "24%" },
];
