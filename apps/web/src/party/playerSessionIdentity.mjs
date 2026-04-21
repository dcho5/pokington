function normalizeName(name) {
  return typeof name === "string" ? name.trim() : "";
}

export function shouldRotatePlayerSession({
  currentPlayerId,
  gameStatePlayers,
  sessionLedger,
  requestedName,
}) {
  const nextName = normalizeName(requestedName);
  if (!currentPlayerId || !nextName) return false;
  if (gameStatePlayers[currentPlayerId]) return false;

  const ledgerEntry = sessionLedger.get(currentPlayerId);
  if (!ledgerEntry) return false;

  return normalizeName(ledgerEntry.name) !== nextName;
}
