import PartySocket from "partysocket";
import { createPartyKitGameConnection, type SocketLike } from "./connection";
import type {
  GameConnection,
  GameConnectionLifecycle,
  JoinTokenResponse,
  PartyKitServerMessage,
} from "./types";

export function normalizePartyKitHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^(https?:\/\/|wss?:\/\/)/i, "").replace(/\/+$/, "");
}

export function buildPartyKitWebSocketUrl(host: string, roomId: string): string {
  const normalizedHost = normalizePartyKitHost(host);
  if (!normalizedHost) {
    throw new Error("PARTYKIT_HOST_REQUIRED");
  }
  const protocol = normalizedHost.startsWith("127.0.0.1") || normalizedHost.startsWith("localhost")
    ? "ws"
    : "wss";
  return `${protocol}://${normalizedHost}/parties/main/${encodeURIComponent(roomId)}`;
}

export interface CreateWebGameConnectionOptions<TServerMessage, TGameAction>
  extends GameConnectionLifecycle<TServerMessage> {
  host: string;
  roomId: string;
  clientId: string;
  protocolVersion: number;
  join: () => Promise<JoinTokenResponse>;
  getInitialAway?: () => boolean;
  createSocket?: (host: string, roomId: string) => SocketLike;
}

export function createWebGameConnection<
  TServerMessage extends PartyKitServerMessage = PartyKitServerMessage,
  TGameAction = unknown,
>(options: CreateWebGameConnectionOptions<TServerMessage, TGameAction>): GameConnection<TServerMessage, TGameAction> {
  const normalizedHost = normalizePartyKitHost(options.host);
  if (!normalizedHost) {
    throw new Error("PARTYKIT_HOST_REQUIRED");
  }

  return createPartyKitGameConnection<TServerMessage, TGameAction>({
    ...options,
    createSocket: () => (
      options.createSocket
        ? options.createSocket(normalizedHost, options.roomId)
        : new PartySocket({ host: normalizedHost, room: options.roomId })
    ),
  });
}
