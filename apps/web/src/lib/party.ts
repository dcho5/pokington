import type {
  CreateTableRequest,
  CreateTableResponse,
  GetTableResponse,
  JoinTokenResponse,
} from "@pokington/network";
import {
  CLIENT_ID_STORAGE_KEY,
  createTable as createSharedTable,
  getTable as getSharedTable,
  normalizePartyKitHost,
  requestJoinToken,
} from "@pokington/network";

export { normalizePartyKitHost } from "@pokington/network";

const LOCAL_PARTYKIT_HOST = "127.0.0.1:1999";

declare global {
  interface Window {
    __POKINGTON_RUNTIME_CONFIG__?: {
      partykitHost?: string | null;
    };
  }
}

function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.trim().replace(/^(https?|wss?):\/\//i, "").split("/")[0]?.split(":")[0] ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getExplicitPartyKitHost(): string | null {
  return normalizePartyKitHost(process.env.PARTYKIT_HOST);
}

function getPublicPartyKitHost(): string | null {
  return normalizePartyKitHost(process.env.NEXT_PUBLIC_PARTYKIT_HOST);
}

export function getServerPartyKitHost(requestHost?: string | null): string {
  const explicitHost = getExplicitPartyKitHost();
  if (explicitHost) {
    return explicitHost;
  }
  if (isLocalHost(requestHost)) {
    return LOCAL_PARTYKIT_HOST;
  }
  const hostname = requestHost?.split(":")[0]?.split("/")[0];
  if (process.env.NODE_ENV !== "production") {
    return hostname ? `${hostname}:1999` : LOCAL_PARTYKIT_HOST;
  }
  return getPublicPartyKitHost() || (hostname ? `${hostname}:1999` : LOCAL_PARTYKIT_HOST);
}

export function getPartyKitHost(): string {
  if (typeof window !== "undefined") {
    const explicitHost = normalizePartyKitHost(window.__POKINGTON_RUNTIME_CONFIG__?.partykitHost);
    if (explicitHost) {
      return explicitHost;
    }
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return LOCAL_PARTYKIT_HOST;
    }
    if (process.env.NODE_ENV !== "production") {
      return `${hostname}:1999`;
    }
    return getPublicPartyKitHost() || `${hostname}:1999`;
  }
  return getServerPartyKitHost();
}

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
  }
  return id;
}

export async function createTable(request: CreateTableRequest): Promise<CreateTableResponse> {
  return createSharedTable(request, { explicitHost: getPartyKitHost() });
}

export async function getTable(code: string): Promise<GetTableResponse> {
  return getSharedTable(code, { explicitHost: getPartyKitHost() });
}

export async function createJoinToken(code: string, request: { clientId: string }): Promise<JoinTokenResponse> {
  return requestJoinToken(code, request.clientId, { explicitHost: getPartyKitHost() });
}
