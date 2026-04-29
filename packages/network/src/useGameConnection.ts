import { useEffect, useMemo, useState } from "react";
import { createNativeGameConnection, type CreateNativeGameConnectionOptions } from "./partykit-native";
import { createWebGameConnection, type CreateWebGameConnectionOptions } from "./partykit-web";
import type {
  ConnectionStatus,
  GameConnection,
  PartyKitServerMessage,
} from "./types";

export type UseGameConnectionOptions<TServerMessage, TGameAction> =
  | (CreateWebGameConnectionOptions<TServerMessage, TGameAction> & {
      adapter?: "web";
      enabled?: boolean;
    })
  | (CreateNativeGameConnectionOptions<TServerMessage, TGameAction> & {
      adapter: "native";
      enabled?: boolean;
    });

export interface UseGameConnectionResult<TServerMessage, TGameAction> {
  connection: GameConnection<TServerMessage, TGameAction> | null;
  status: ConnectionStatus;
}

export function useGameConnection<
  TServerMessage extends PartyKitServerMessage = PartyKitServerMessage,
  TGameAction = unknown,
>(
  options: UseGameConnectionOptions<TServerMessage, TGameAction>,
): UseGameConnectionResult<TServerMessage, TGameAction> {
  const [connection, setConnection] = useState<GameConnection<TServerMessage, TGameAction> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const enabled = options.enabled ?? true;

  const stableOptions = useMemo(() => options, [
    options.adapter,
    enabled,
    options.roomId,
    options.protocolVersion,
    options.join,
    options.createSocket,
    options.onStatusChange,
    options.onJoin,
    options.onMessage,
    options.onJoinError,
    options.onSocketError,
    "host" in options ? options.host : undefined,
    "clientId" in options ? options.clientId : undefined,
    "getInitialAway" in options ? options.getInitialAway : undefined,
    "storage" in options ? options.storage : undefined,
    "explicitHost" in options ? options.explicitHost : undefined,
    "requestHostname" in options ? options.requestHostname : undefined,
    "appState" in options ? options.appState : undefined,
    "createClientId" in options ? options.createClientId : undefined,
  ]);

  useEffect(() => {
    let cancelled = false;
    let nextConnection: GameConnection<TServerMessage, TGameAction> | null = null;

    if (!enabled) {
      setConnection(null);
      setStatus("idle");
      return () => {
        cancelled = true;
      };
    }

    setStatus("connecting");
    const onStatusChange = (nextStatus: ConnectionStatus) => {
      if (cancelled) return;
      setStatus(nextStatus);
      stableOptions.onStatusChange?.(nextStatus);
    };

    if (stableOptions.adapter === "native") {
      void createNativeGameConnection<TServerMessage, TGameAction>({
        ...stableOptions,
        onStatusChange,
      }).then((connection) => {
        if (cancelled) {
          connection.disconnect();
          return;
        }
        nextConnection = connection;
        setConnection(connection);
      });
    } else {
      nextConnection = createWebGameConnection<TServerMessage, TGameAction>({
        ...stableOptions,
        onStatusChange,
      });
      setConnection(nextConnection);
    }

    return () => {
      cancelled = true;
      nextConnection?.disconnect();
      setConnection(null);
    };
  }, [enabled, stableOptions]);

  return { connection, status };
}
