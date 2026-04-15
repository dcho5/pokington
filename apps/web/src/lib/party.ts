import type {
  CreateTableRequest,
  CreateTableResponse,
  GetTableResponse,
  JoinTableRequest,
  JoinTableResponse,
} from "party/types";

const LOCAL_PARTYKIT_HOST = "127.0.0.1:1999";

export function getPartyKitHost(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return LOCAL_PARTYKIT_HOST;
    }
    return process.env.NEXT_PUBLIC_PARTYKIT_HOST || LOCAL_PARTYKIT_HOST;
  }
  if (process.env.NODE_ENV !== "production") {
    return LOCAL_PARTYKIT_HOST;
  }
  return process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST || LOCAL_PARTYKIT_HOST;
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
