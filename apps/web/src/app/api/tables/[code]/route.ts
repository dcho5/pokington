import { NextResponse } from "next/server";
import { getPartyKitHost } from "lib/party";

async function forwardToPartyKit(path: string, init?: RequestInit) {
  try {
    const response = await fetch(`http://${getPartyKitHost()}/parties/main/${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { code: "PARTYKIT_UNAVAILABLE", message: "Realtime server is unavailable" },
      { status: 503 },
    );
  }
}

export async function GET(_: Request, { params }: { params: { code: string } }) {
  return forwardToPartyKit(`__control__/tables/${params.code.toUpperCase()}`, {
    method: "GET",
  });
}
