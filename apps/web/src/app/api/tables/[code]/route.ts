import { NextResponse } from "next/server";
import { getServerPartyKitHost } from "lib/party";

async function forwardToPartyKit(path: string, requestHost?: string | null, init?: RequestInit) {
  try {
    const response = await fetch(`http://${getServerPartyKitHost(requestHost)}/parties/main/${path}`, {
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

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return forwardToPartyKit(`__control__/tables/${code.toUpperCase()}`, req.headers.get("host"), {
    method: "GET",
  });
}
