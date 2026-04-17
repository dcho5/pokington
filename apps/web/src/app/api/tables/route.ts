import { NextResponse } from "next/server";
import { getServerPartyKitHost } from "lib/party";
import type { CreateTableRequest } from "party/types";

export async function POST(req: Request) {
  let body: CreateTableRequest;
  try {
    body = (await req.json()) as CreateTableRequest;
  } catch {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Invalid create-table payload" },
      { status: 400 },
    );
  }

  const normalizedBody = JSON.stringify({
    ...body,
    tableName: body.tableName.trim(),
  } satisfies CreateTableRequest);

  try {
    const response = await fetch(`http://${getServerPartyKitHost(req.headers.get("host"))}/parties/main/__control__/tables`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: normalizedBody,
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
