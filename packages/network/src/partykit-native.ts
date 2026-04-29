import { createPartyKitGameConnection, type SocketLike } from "./connection";
import { buildPartyKitWebSocketUrl, normalizePartyKitHost } from "./partykit-web";
import type {
  GameConnection,
  GameConnectionLifecycle,
  JoinTokenResponse,
  KeyValueStorage,
  NativeAppStateLike,
  PartyKitServerMessage,
} from "./types";
import { CLIENT_ID_STORAGE_KEY } from "./types";

const LOCAL_PARTYKIT_HOST = "127.0.0.1:1999";

export interface CreateNativeGameConnectionOptions<TServerMessage, TGameAction>
  extends GameConnectionLifecycle<TServerMessage> {
  roomId: string;
  protocolVersion: number;
  storage: KeyValueStorage;
  join: (request: { clientId: string; roomId: string }) => Promise<JoinTokenResponse>;
  explicitHost?: string | null;
  requestHostname?: string | null;
  appState?: NativeAppStateLike;
  createSocket?: (url: string) => SocketLike;
  createClientId?: () => string;
}

export function resolveNativePartyKitHost(options: {
  explicitHost?: string | null;
  requestHostname?: string | null;
}): string {
  const explicitHost = normalizePartyKitHost(options.explicitHost);
  if (explicitHost) return explicitHost;

  const normalizedRequestHost = normalizePartyKitHost(options.requestHostname);
  const hostname = normalizedRequestHost?.split(":")[0] ?? null;
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return LOCAL_PARTYKIT_HOST;
  }
  return `${hostname}:1999`;
}

export async function getOrCreateNativeClientId(
  storage: KeyValueStorage,
  createClientId = defaultCreateClientId,
): Promise<string> {
  const existing = await storage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;
  const clientId = createClientId();
  await storage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}

export async function createNativeGameConnection<
  TServerMessage extends PartyKitServerMessage = PartyKitServerMessage,
  TGameAction = unknown,
>(options: CreateNativeGameConnectionOptions<TServerMessage, TGameAction>): Promise<GameConnection<TServerMessage, TGameAction>> {
  const clientId = await getOrCreateNativeClientId(options.storage, options.createClientId);
  const host = resolveNativePartyKitHost({
    explicitHost: options.explicitHost,
    requestHostname: options.requestHostname,
  });

  const connection = createPartyKitGameConnection<TServerMessage, TGameAction>({
    ...options,
    clientId,
    join: () => options.join({ clientId, roomId: options.roomId }),
    getInitialAway: () => options.appState?.currentState !== "active",
    createSocket: () => {
      const url = buildPartyKitWebSocketUrl(host, options.roomId);
      if (options.createSocket) return options.createSocket(url);
      if (typeof WebSocket === "undefined") {
        throw new Error("WEBSOCKET_UNAVAILABLE");
      }
      return new WebSocket(url);
    },
  });

  const subscription = options.appState?.addEventListener("change", (state) => {
    connection.setAway(state !== "active");
  });
  if (subscription) {
    const disconnect = connection.disconnect;
    connection.disconnect = () => {
      subscription.remove();
      disconnect();
    };
  }

  return connection;
}

function defaultCreateClientId(): string {
  const cryptoLike = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return cryptoLike?.randomUUID?.()
    ?? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
