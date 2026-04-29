import { useEffect, useMemo, useState } from "react";
import { createWebGameConnection, type CreateWebGameConnectionOptions } from "./partykit-web";
import type {
  ConnectionStatus,
  GameConnection,
  PartyKitServerMessage,
} from "./types";

export interface UseGameConnectionResult<TServerMessage, TGameAction> {
  connection: GameConnection<TServerMessage, TGameAction> | null;
  status: ConnectionStatus;
}

export function useGameConnection<
  TServerMessage extends PartyKitServerMessage = PartyKitServerMessage,
  TGameAction = unknown,
>(
  options: CreateWebGameConnectionOptions<TServerMessage, TGameAction> & { enabled?: boolean },
): UseGameConnectionResult<TServerMessage, TGameAction> {
  const [connection, setConnection] = useState<GameConnection<TServerMessage, TGameAction> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const enabled = options.enabled ?? true;

  const stableOptions = useMemo(() => options, [
    enabled,
    options.host,
    options.roomId,
    options.clientId,
    options.protocolVersion,
    options.join,
    options.getInitialAway,
    options.createSocket,
    options.onStatusChange,
    options.onJoin,
    options.onMessage,
    options.onJoinError,
    options.onSocketError,
  ]);

  useEffect(() => {
    if (!enabled) {
      setConnection(null);
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const nextConnection = createWebGameConnection<TServerMessage, TGameAction>({
      ...stableOptions,
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus);
        stableOptions.onStatusChange?.(nextStatus);
      },
    });
    setConnection(nextConnection);
    return () => {
      nextConnection.disconnect();
      setConnection(null);
    };
  }, [enabled, stableOptions]);

  return { connection, status };
}
