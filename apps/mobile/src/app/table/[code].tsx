import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@pokington/config";
import {
  resolveNativePartyKitHost,
  useGameConnection,
  type JoinTokenResponse,
  type PartyKitServerMessage,
} from "@pokington/network";
import { tokens } from "@pokington/ui";
import {
  NativeButton,
  PokerCard,
  StatusPill,
  type PlayerSummary,
} from "@pokington/ui/native";
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
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { playNativeFeedbackHaptic } from "../../lib/haptics";

const PROTOCOL_VERSION = 4;
const MAX_SEATS = 10;
const DEFAULT_BUY_IN_CENTS = 10_000;

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
  | { type: "LEDGER_STATE"; entries: unknown[] }
  | { type: "ERROR"; code: string; message: string };

function cents(amount: number | null | undefined): string {
  return `$${((amount ?? 0) / 100).toFixed(2)}`;
}

function compactCents(amount: number | null | undefined): string {
  const dollars = (amount ?? 0) / 100;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function cardKey(card: Card | null | undefined, index: number) {
  return `${card?.rank ?? "empty"}-${card?.suit ?? "slot"}-${index}`;
}

function isFeedbackCue(value: unknown): value is GameFeedbackCueEnvelope {
  return !!value && typeof value === "object" && "kind" in value && "key" in value;
}

async function requestJoinToken(roomId: string, clientId: string): Promise<JoinTokenResponse> {
  const host = resolveNativePartyKitHost({ explicitHost: env.partyKitHost });
  const protocol = host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/parties/main/__control__/tables/${roomId}/join-token`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clientId }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
        ? payload.code
        : "JOIN_TOKEN_FAILED";
    throw new Error(code);
  }
  return payload as JoinTokenResponse;
}

function BoardCards({ cards }: { cards: Card[] }) {
  const paddedCards = [...cards, ...Array.from<Card | null>({ length: Math.max(0, 5 - cards.length) }).fill(null)].slice(0, 5);
  return (
    <View style={styles.boardRow}>
      {paddedCards.map((card, index) => (
        <PokerCard key={cardKey(card, index)} card={card} hidden={!card} />
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
      <View style={styles.seatAvatar}>
        <Text style={styles.seatAvatarText}>{player ? player.name.slice(0, 1).toUpperCase() : seatIndex + 1}</Text>
      </View>
      <Text style={styles.seatName} numberOfLines={1}>{player?.name ?? "Open"}</Text>
      <Text style={styles.seatMeta} numberOfLines={1}>
        {player ? compactCents(player.stack) : locked ? "Locked" : "Sit"}
      </Text>
      {player?.currentBet ? <Text style={styles.seatBet}>{compactCents(player.currentBet)}</Text> : null}
      {badges.length > 0 ? <Text style={styles.seatBadges}>{badges.join(" ")}</Text> : null}
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
  const [ledgerEntries, setLedgerEntries] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"seat" | "ledger" | "bomb" | "raise" | null>(null);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [sitName, setSitName] = useState("");
  const [buyIn, setBuyIn] = useState(String(DEFAULT_BUY_IN_CENTS / 100));
  const [raiseTotal, setRaiseTotal] = useState("");
  const seenFeedbackKeysRef = useRef(new Set<string>());
  const myPlayerIdRef = useRef<string | null>(null);

  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  const join = useCallback(
    ({ clientId }: { clientId: string; roomId: string }) => requestJoinToken(roomId, clientId),
    [roomId],
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
        setLedgerEntries(message.entries ?? []);
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerBar}>
        <NativeButton label="Back" tone="secondary" onPress={() => router.back()} style={styles.headerButton} />
        <View style={styles.headerCopy}>
          <Text style={styles.tableName} numberOfLines={1}>{tableState?.tableName || `Table ${roomId}`}</Text>
          <Text style={styles.tableMeta}>
            {tableState ? `${tableState.phase} · Hand ${tableState.handNumber} · ${cents(tableState.blinds.small)} / ${cents(tableState.blinds.big)}` : "connecting"}
          </Text>
        </View>
        <StatusPill label={status} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Connection issue</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.seatRail}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seatRailContent}>
          {seatPlayers.map((player, seatIndex) => (
            <SeatBubble
              key={`seat-${seatIndex}`}
              player={player}
              seatIndex={seatIndex}
              isDealer={tableState?.dealerSeatIndex === seatIndex}
              isSmallBlind={tableState?.smallBlindSeatIndex === seatIndex}
              isBigBlind={tableState?.bigBlindSeatIndex === seatIndex}
              locked={!isWaiting && !isShowdown}
              onPress={() => openSeat(seatIndex)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.tableStage}>
        <View style={styles.feltOval}>
          {boardSets.slice(0, 3).map((cards, index) => (
            <View key={`board-${index}`} style={styles.boardStack}>
              {boardSets.length > 1 ? <Text style={styles.boardLabel}>{tableState?.isBombPot ? `Board ${index + 1}` : `Run ${index + 1}`}</Text> : null}
              <BoardCards cards={cards} />
            </View>
          ))}
          <View style={styles.potPill}>
            <Text style={styles.potLabel}>Pot</Text>
            <Text style={styles.potValue}>{cents(tablePot)}</Text>
          </View>
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

      <View style={styles.utilityRail}>
        <NativeButton label="Ledger" tone="secondary" onPress={() => { setSheet("ledger"); playNativeFeedbackHaptic({ kind: "local_press", key: "ledger" }, { myPlayerId }); }} style={styles.utilityButton} />
        <NativeButton label="Bomb" tone="secondary" disabled={!viewer || !!tableState?.bombPotVote} onPress={() => setSheet("bomb")} style={styles.utilityButton} />
        {viewer ? (
          <NativeButton
            label={leaveQueued ? "Cancel Leave" : "Leave"}
            tone="secondary"
            onPress={() => {
              if (leaveQueued) {
                sendViewerEvent((playerId) => ({ type: "CANCEL_BOUNDARY_UPDATE", playerId }), "light");
              } else {
                sendViewerEvent((playerId) => ({
                  type: "REQUEST_BOUNDARY_UPDATE",
                  playerId,
                  leaveSeat: true,
                  moveToSeatIndex: null,
                  chipDelta: 0,
                }), "medium");
              }
            }}
            style={styles.utilityButton}
          />
        ) : null}
      </View>

      <View style={styles.handPanel}>
        <View style={styles.handIdentity}>
          <Text style={styles.handName}>{viewer?.name ?? "Not seated"}</Text>
          <Text style={styles.handMeta}>{viewer ? `${cents(viewer.stack)} stack${peekedCounts[viewer.id] ? ` · peeked ${peekedCounts[viewer.id]}` : ""}` : "Tap an open seat to sit"}</Text>
        </View>
        <View style={styles.handCards}>
          {[0, 1].map((index) => (
            <View key={`hole-${index}`} style={styles.holeCardWrap}>
              <PokerCard card={holeCards?.[index] ?? revealedHoleCards[myPlayerId ?? ""]?.[index] ?? null} hidden={!holeCards?.[index]} />
              <View style={styles.cardActions}>
                <Pressable onPress={() => peekCard(index as 0 | 1)} style={styles.cardActionButton}>
                  <Text style={styles.cardActionText}>Peek</Text>
                </Pressable>
                <Pressable onPress={() => revealCard(index as 0 | 1)} style={styles.cardActionButton}>
                  <Text style={styles.cardActionText}>Show</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actionDock}>
        {isWaiting || (isShowdown && tableState?.winners?.length) ? (
          <NativeButton label="Start Game" disabled={!viewer} onPress={() => sendEvent({ type: "START_HAND" }, "medium")} />
        ) : (
          <View style={styles.actionGrid}>
            <NativeButton label="Fold" tone="danger" disabled={!canAct} onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "fold" }))} style={styles.actionButton} />
            <NativeButton
              label={canCheck ? "Check" : `Call ${cents(callAmount)}`}
              disabled={!canAct}
              onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: canCheck ? "check" : "call" }))}
              style={styles.actionButton}
            />
            <NativeButton label={`Raise ${compactCents(minRaiseTotal)}`} tone="secondary" disabled={!canRaise} onPress={() => { setRaiseTotal(String(minRaiseTotal / 100)); setSheet("raise"); }} style={styles.actionButton} />
            <NativeButton label="All-in" tone="secondary" disabled={!canAllIn} onPress={() => sendViewerEvent((playerId) => ({ type: "PLAYER_ACTION", playerId, action: "all-in" }), "heavy")} style={styles.actionButton} />
          </View>
        )}
      </View>

      <Modal visible={sheet != null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.sheetScrim} onPress={() => setSheet(null)} />
        <View style={styles.sheet}>
          {sheet === "seat" ? (
            <>
              <Text style={styles.sheetTitle}>Seat {(selectedSeatIndex ?? 0) + 1}</Text>
              <TextInput value={sitName} onChangeText={setSitName} placeholder="Your name" placeholderTextColor={tokens.colors.muted} style={styles.input} />
              <TextInput value={buyIn} onChangeText={setBuyIn} placeholder="Buy-in dollars" keyboardType="number-pad" placeholderTextColor={tokens.colors.muted} style={styles.input} />
              <NativeButton label="Sit Down" onPress={confirmSit} />
            </>
          ) : null}
          {sheet === "ledger" ? (
            <>
              <Text style={styles.sheetTitle}>Session Ledger</Text>
              <Text style={styles.sheetText}>{ledgerEntries.length > 0 ? `${ledgerEntries.length} ledger entries synced.` : "No ledger entries yet."}</Text>
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
              <TextInput value={raiseTotal} onChangeText={setRaiseTotal} placeholder="Total bet dollars" keyboardType="number-pad" placeholderTextColor={tokens.colors.muted} style={styles.input} />
              <NativeButton label="Raise" onPress={confirmRaise} />
            </>
          ) : null}
          <NativeButton label="Close" tone="secondary" onPress={() => setSheet(null)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  headerBar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSubtle,
  },
  headerButton: {
    minHeight: 40,
    paddingHorizontal: tokens.spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  tableName: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  tableMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  errorBanner: {
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
  },
  errorTitle: {
    color: tokens.colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  errorText: {
    color: tokens.colors.muted,
    fontSize: 13,
  },
  seatRail: {
    minHeight: 118,
    paddingVertical: tokens.spacing.sm,
  },
  seatRailContent: {
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  seatBubble: {
    width: 82,
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.sm,
  },
  viewerSeat: {
    backgroundColor: tokens.colors.feltOverlay,
  },
  actorSeat: {
    borderColor: tokens.colors.accent,
  },
  emptySeat: {
    borderStyle: "dashed",
    backgroundColor: tokens.colors.surfaceSubtle,
  },
  lockedSeat: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.78,
  },
  seatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.accent,
  },
  seatAvatarText: {
    color: tokens.colors.text,
    fontWeight: "900",
  },
  seatName: {
    maxWidth: "100%",
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  seatMeta: {
    color: tokens.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  seatBet: {
    color: tokens.colors.accent,
    fontSize: 11,
    fontWeight: "900",
  },
  seatBadges: {
    color: tokens.colors.text,
    fontSize: 9,
    fontWeight: "900",
  },
  tableStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  feltOval: {
    width: "100%",
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.sm,
    borderRadius: 120,
    borderWidth: 10,
    borderColor: tokens.colors.web.wood.dark,
    backgroundColor: tokens.colors.felt,
    padding: tokens.spacing.lg,
  },
  boardStack: {
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  boardLabel: {
    color: tokens.colors.text,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  boardRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: tokens.spacing.sm,
  },
  potPill: {
    minWidth: 112,
    alignItems: "center",
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  potLabel: {
    color: tokens.colors.text,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  potValue: {
    color: tokens.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  overlayCard: {
    width: "100%",
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  overlayTitle: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  overlayText: {
    color: tokens.colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  winnerBanner: {
    width: "100%",
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    alignItems: "center",
  },
  winnerTitle: {
    color: tokens.colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  winnerText: {
    color: tokens.colors.text,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  utilityRail: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  utilityButton: {
    flex: 1,
    minHeight: 42,
  },
  handPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  handIdentity: {
    flex: 1,
    minWidth: 0,
  },
  handName: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  handMeta: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  handCards: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  holeCardWrap: {
    alignItems: "center",
    gap: 4,
  },
  cardActions: {
    flexDirection: "row",
    gap: 4,
  },
  cardActionButton: {
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  cardActionText: {
    color: tokens.colors.text,
    fontSize: 9,
    fontWeight: "900",
  },
  actionDock: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  actionButton: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  inlineActions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  inlineButton: {
    flex: 1,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    gap: tokens.spacing.md,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.lg,
  },
  sheetTitle: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  sheetText: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  input: {
    minHeight: 52,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: tokens.spacing.md,
  },
});
