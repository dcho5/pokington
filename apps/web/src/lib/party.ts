import type {
  CreateTableRequest,
  CreateTableResponse,
  GetTableResponse,
  JoinTableRequest,
  JoinTableResponse,
} from "party/types";

const LOCAL_PARTYKIT_HOST = "127.0.0.1:1999";

declare global {
  interface Window {
    __POKINGTON_RUNTIME_CONFIG__?: {
      partykitHost?: string | null;
    };
  }
}

export function normalizePartyKitHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^(https?|wss?):\/\//i, "")
    .replace(/\/+$/, "");
}

function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.trim().replace(/^(https?|wss?):\/\//i, "").split("/")[0]?.split(":")[0] ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getServerPartyKitHost(requestHost?: string | null): string {
  if (isLocalHost(requestHost)) {
    return LOCAL_PARTYKIT_HOST;
  }
  const hostname = requestHost?.split(":")[0]?.split("/")[0];
  return normalizePartyKitHost(process.env.PARTYKIT_HOST)
    || normalizePartyKitHost(process.env.NEXT_PUBLIC_PARTYKIT_HOST)
    || (hostname ? `${hostname}:1999` : LOCAL_PARTYKIT_HOST);
}

export function getPartyKitHost(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return LOCAL_PARTYKIT_HOST;
    }
    return normalizePartyKitHost(window.__POKINGTON_RUNTIME_CONFIG__?.partykitHost)
      || normalizePartyKitHost(process.env.NEXT_PUBLIC_PARTYKIT_HOST)
      || `${hostname}:1999`;
  }
  if (process.env.NODE_ENV !== "production") {
    return LOCAL_PARTYKIT_HOST;
  }
  return getServerPartyKitHost();
}

async function requestControlPlane<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path.replace(/^\//, "")}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorCode =
      typeof payload === "object" &&
      payload !== null &&
      "code" in payload &&
      typeof (payload as { code?: unknown }).code === "string"
        ? (payload as { code: string }).code
        : "REQUEST_FAILED";
    throw new Error(errorCode);
  }

  return payload as T;
}

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("pokington_client_id");
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem("pokington_client_id", id);
  }
  return id;
}

export async function createTable(request: CreateTableRequest): Promise<CreateTableResponse> {
  return requestControlPlane<CreateTableResponse>("tables", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getTable(code: string): Promise<GetTableResponse> {
  return requestControlPlane<GetTableResponse>(`tables/${code.toUpperCase()}`, {
    method: "GET",
  });
}

export async function createJoinToken(code: string, request: JoinTableRequest): Promise<JoinTableResponse> {
  return requestControlPlane<JoinTableResponse>(`tables/${code.toUpperCase()}/join-token`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}
