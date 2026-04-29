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
  CommunityBoard,
  NativeButton,
  NativePanel,
  PlayerRow,
  StatusPill,
  type PlayerSummary,
} from "@pokington/ui/native";
import type { GameEvent } from "@pokington/engine";
import type { Card } from "@pokington/shared";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PROTOCOL_VERSION = 4;

interface PublicPlayer {
  id: string;
  name: string;
  seatIndex: number;
  stack: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
}

interface PublicTableState {
  phase: string;
  tableName: string;
  players: Record<string, PublicPlayer>;
  communityCards: Card[];
  pot: number;
  roundBet: number;
  blinds: { small: number; big: number };
  handNumber: number;
  needsToAct: string[];
  winners: { playerId: string; amount: number; hand: string | null }[] | null;
}

type MobileServerMessage =
  | PartyKitServerMessage<PublicTableState>
  | {
      type: "ROOM_PRESENCE";
      connectedPlayerIds: string[];
      awayPlayerIds: string[];
      peekedCounts: Record<string, number>;
      queuedLeavePlayerIds: string[];
    }
  | { type: "ERROR"; code: string; message: string };

function cents(amount: number | null | undefined): string {
  return `$${((amount ?? 0) / 100).toFixed(2)}`;
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

export default function TableScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const roomId = String(params.code ?? "").toUpperCase();
  const [tableState, setTableState] = useState<PublicTableState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(
    ({ clientId }: { clientId: string; roomId: string }) => requestJoinToken(roomId, clientId),
    [roomId],
  );

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
    },
    onMessage: (message) => {
      switch (message.type) {
        case "TABLE_STATE":
          setTableState(message.state);
          setError(null);
          break;
        case "ROOM_PRESENCE":
          setAwayPlayerIds(message.awayPlayerIds ?? []);
          break;
        case "ERROR":
          setError(message.message || message.code);
          break;
      }
    },
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

  const sendAction = (event: GameEvent) => {
    connection?.sendAction(event);
  };

  const viewer = players.find((player) => player.id === myPlayerId) ?? null;
  const canAct = !!viewer && tableState?.needsToAct[0] === myPlayerId;
  const callAmount = viewer && tableState ? Math.max(0, tableState.roundBet - viewer.currentBet) : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <NativeButton label="Back" tone="secondary" onPress={() => router.back()} />
          <StatusPill label={status} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{tableState?.tableName || `Table ${roomId}`}</Text>
          <Text style={styles.subtitle}>
            Hand {tableState?.handNumber ?? 0} · {tableState?.phase ?? "connecting"}
          </Text>
        </View>

        {error ? (
          <NativePanel style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Connection issue</Text>
            <Text style={styles.errorText}>{error}</Text>
          </NativePanel>
        ) : null}

        <NativePanel style={styles.feltPanel}>
          <Text style={styles.panelTitle}>Board</Text>
          <CommunityBoard cards={tableState?.communityCards ?? []} />
          <View style={styles.potRow}>
            <Text style={styles.potLabel}>Pot</Text>
            <Text style={styles.potValue}>{cents(tableState?.pot)}</Text>
          </View>
          <Text style={styles.bodyText}>
            Blinds {cents(tableState?.blinds.small)} / {cents(tableState?.blinds.big)}
          </Text>
        </NativePanel>

        <NativePanel>
          <Text style={styles.panelTitle}>Players</Text>
          {players.length > 0 ? (
            players.map((player) => <PlayerRow key={player.id} player={player} />)
          ) : (
            <Text style={styles.bodyText}>Waiting for the first table state.</Text>
          )}
        </NativePanel>

        <NativePanel>
          <Text style={styles.panelTitle}>Actions</Text>
          <View style={styles.actionGrid}>
            <NativeButton label="Fold" tone="danger" disabled={!canAct} onPress={() => sendAction({ type: "PLAYER_ACTION", playerId: myPlayerId ?? "", action: "fold" })} />
            <NativeButton
              label={callAmount > 0 ? `Call ${cents(callAmount)}` : "Check"}
              disabled={!canAct}
              onPress={() => sendAction({ type: "PLAYER_ACTION", playerId: myPlayerId ?? "", action: callAmount > 0 ? "call" : "check" })}
            />
            <NativeButton label="All-in" tone="secondary" disabled={!canAct} onPress={() => sendAction({ type: "PLAYER_ACTION", playerId: myPlayerId ?? "", action: "all-in" })} />
          </View>
        </NativePanel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  header: {
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: tokens.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  panelTitle: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  bodyText: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  feltPanel: {
    backgroundColor: tokens.colors.felt,
  },
  potRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  potLabel: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  potValue: {
    color: tokens.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  actionGrid: {
    gap: tokens.spacing.sm,
  },
  errorPanel: {
    borderColor: tokens.colors.accent,
  },
  errorTitle: {
    color: tokens.colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  errorText: {
    color: tokens.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
