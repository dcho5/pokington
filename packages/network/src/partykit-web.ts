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

export function shouldUseInsecureLocalProtocol(host: string): boolean {
  const normalizedHost = normalizePartyKitHost(host);
  const hostname = normalizedHost?.split("/")[0]?.split(":")[0] ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
  if (match) {
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

export function buildPartyKitWebSocketUrl(host: string, roomId: string): string {
  const normalizedHost = normalizePartyKitHost(host);
  if (!normalizedHost) {
    throw new Error("PARTYKIT_HOST_REQUIRED");
  }
  const protocol = shouldUseInsecureLocalProtocol(normalizedHost) ? "ws" : "wss";
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
