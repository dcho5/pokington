"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createNativeGameConnection, type CreateNativeGameConnectionOptions } from "./partykit-native";
import { createWebGameConnection, type CreateWebGameConnectionOptions } from "./partykit-web";
import type {
  ConnectionStatus,
  GameConnection,
  JoinTokenResponse,
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
  terminalError: Error | null;
  firstStateReceived: boolean;
}

export function useGameConnection<
  TServerMessage extends PartyKitServerMessage = PartyKitServerMessage,
  TGameAction = unknown,
>(
  options: UseGameConnectionOptions<TServerMessage, TGameAction>,
): UseGameConnectionResult<TServerMessage, TGameAction> {
  const [connection, setConnection] = useState<GameConnection<TServerMessage, TGameAction> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [terminalError, setTerminalError] = useState<Error | null>(null);
  const [firstStateReceived, setFirstStateReceived] = useState(false);
  const enabled = options.enabled ?? true;
  const optionsRef = useRef(options);
  const lifecycleRef = useRef({
    onStatusChange: options.onStatusChange,
    onJoin: options.onJoin,
    onMessage: options.onMessage,
    onJoinError: options.onJoinError,
    onSocketError: options.onSocketError,
    onTerminalError: options.onTerminalError,
  });

  useEffect(() => {
    optionsRef.current = options;
    lifecycleRef.current = {
      onStatusChange: options.onStatusChange,
      onJoin: options.onJoin,
      onMessage: options.onMessage,
      onJoinError: options.onJoinError,
      onSocketError: options.onSocketError,
      onTerminalError: options.onTerminalError,
    };
  });

  const connectionKey = useMemo(() => JSON.stringify({
    adapter: options.adapter ?? "web",
    enabled,
    roomId: options.roomId,
    protocolVersion: options.protocolVersion,
    host: "host" in options ? options.host : null,
    clientId: "clientId" in options ? options.clientId : null,
    explicitHost: "explicitHost" in options ? options.explicitHost : null,
    requestHostname: "requestHostname" in options ? options.requestHostname : null,
  }), [
    options.adapter,
    enabled,
    options.roomId,
    options.protocolVersion,
    "host" in options ? options.host : undefined,
    "clientId" in options ? options.clientId : undefined,
    "explicitHost" in options ? options.explicitHost : undefined,
    "requestHostname" in options ? options.requestHostname : undefined,
  ]);

  useEffect(() => {
    let cancelled = false;
    let nextConnection: GameConnection<TServerMessage, TGameAction> | null = null;
    const connectionOptions = optionsRef.current;

    if (!enabled) {
      setConnection(null);
      setStatus("idle");
      setTerminalError(null);
      setFirstStateReceived(false);
      return () => {
        cancelled = true;
      };
    }

    setStatus("connecting");
    setTerminalError(null);
    setFirstStateReceived(false);
    const onStatusChange = (nextStatus: ConnectionStatus) => {
      if (cancelled) return;
      setStatus(nextStatus);
      lifecycleRef.current.onStatusChange?.(nextStatus);
    };
    const lifecycle = {
      onStatusChange,
      onJoin: (join: JoinTokenResponse) => {
        lifecycleRef.current.onJoin?.(join);
      },
      onMessage: (message: TServerMessage) => {
        if (message.type === "TABLE_STATE") setFirstStateReceived(true);
        lifecycleRef.current.onMessage?.(message);
      },
      onJoinError: (error: Error) => {
        lifecycleRef.current.onJoinError?.(error);
      },
      onSocketError: (error: unknown) => {
        lifecycleRef.current.onSocketError?.(error);
      },
      onTerminalError: (error: Error) => {
        if (cancelled) return;
        setTerminalError(error);
        lifecycleRef.current.onTerminalError?.(error);
      },
    };

    if (connectionOptions.adapter === "native") {
      void createNativeGameConnection<TServerMessage, TGameAction>({
        ...connectionOptions,
        join: (request) => {
          const latestOptions = optionsRef.current;
          if (latestOptions.adapter !== "native") return connectionOptions.join(request);
          return latestOptions.join(request);
        },
        createSocket: connectionOptions.createSocket
          ? (url) => {
              const latestOptions = optionsRef.current;
              if (latestOptions.adapter !== "native" || !latestOptions.createSocket) {
                return connectionOptions.createSocket!(url);
              }
              return latestOptions.createSocket(url);
            }
          : undefined,
        ...lifecycle,
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
        ...connectionOptions,
        join: () => {
          const latestOptions = optionsRef.current;
          if (latestOptions.adapter === "native") return connectionOptions.join();
          return latestOptions.join();
        },
        createSocket: connectionOptions.createSocket
          ? (url) => {
              const latestOptions = optionsRef.current;
              if (latestOptions.adapter === "native" || !latestOptions.createSocket) {
                return connectionOptions.createSocket!(url);
              }
              return latestOptions.createSocket(url);
            }
          : undefined,
        ...lifecycle,
      });
      setConnection(nextConnection);
    }

    return () => {
      cancelled = true;
      nextConnection?.disconnect();
      setConnection(null);
    };
  }, [connectionKey, enabled]);

  return { connection, status, terminalError, firstStateReceived };
}
