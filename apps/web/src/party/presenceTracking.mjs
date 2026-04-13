function collectUniquePlayerIds(clientIds, clientIdToPlayerSessionId) {
  const playerIds = [];
  const seen = new Set();

  for (const clientId of clientIds) {
    const playerId = clientIdToPlayerSessionId.get(clientId);
    if (!playerId || seen.has(playerId)) continue;
    seen.add(playerId);
    playerIds.push(playerId);
  }

  return playerIds;
}

export function authenticatePresence(
  { clientIdToConnId, connIdToClientId, awayClientIds },
  clientId,
  connId,
) {
  const oldConnId = clientIdToConnId.get(clientId) ?? null;
  if (oldConnId && oldConnId !== connId) {
    connIdToClientId.delete(oldConnId);
  }

  connIdToClientId.set(connId, clientId);
  clientIdToConnId.set(clientId, connId);
  awayClientIds.delete(clientId);
}

export function disconnectPresence(
  { clientIdToConnId, connIdToClientId, awayClientIds },
  connId,
) {
  const clientId = connIdToClientId.get(connId) ?? null;
  if (!clientId) return null;

  connIdToClientId.delete(connId);
  if (clientIdToConnId.get(clientId) === connId) {
    clientIdToConnId.delete(clientId);
  }
  awayClientIds.delete(clientId);

  return clientId;
}

export function setAwayPresence(awayClientIds, clientId, away) {
  if (away) {
    awayClientIds.add(clientId);
    return;
  }
  awayClientIds.delete(clientId);
}

export function buildRoomPresenceSnapshot(
  clientIdToConnId,
  clientIdToPlayerSessionId,
  awayClientIds,
) {
  return {
    connectedPlayerIds: collectUniquePlayerIds(
      clientIdToConnId.keys(),
      clientIdToPlayerSessionId,
    ),
    awayPlayerIds: collectUniquePlayerIds(awayClientIds, clientIdToPlayerSessionId),
  };
}
