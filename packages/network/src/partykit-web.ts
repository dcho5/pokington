export function normalizePartyKitHost(host: string): string {
  return host.replace(/^(https?:\/\/|wss?:\/\/)/, "").replace(/\/+$/, "");
}

export function buildPartyKitWebSocketUrl(host: string, roomId: string): string {
  const normalizedHost = normalizePartyKitHost(host);
  const protocol = normalizedHost.startsWith("127.0.0.1") || normalizedHost.startsWith("localhost")
    ? "ws"
    : "wss";
  return `${protocol}://${normalizedHost}/party/${encodeURIComponent(roomId)}`;
}
