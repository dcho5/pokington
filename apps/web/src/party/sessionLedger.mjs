/** @typedef {import("@pokington/engine").GameState["players"]} GameStatePlayers */
/** @typedef {import("./types").LedgerEntry} LedgerEntry */

/**
 * @param {LedgerEntry} entry
 * @returns {LedgerEntry}
 */
function cloneLedgerEntry(entry) {
  return {
    playerId: entry.playerId,
    name: entry.name,
    buyIns: [...entry.buyIns],
    cashOuts: [...entry.cashOuts],
    isSeated: entry.isSeated,
    currentStack: entry.currentStack,
  };
}

/**
 * @param {LedgerEntry[]} [entries]
 * @returns {Map<string, LedgerEntry>}
 */
export function createSessionLedger(entries = []) {
  return new Map(entries.map((entry) => [entry.playerId, cloneLedgerEntry(entry)]));
}

/**
 * @param {Map<string, LedgerEntry>} sessionLedger
 * @returns {LedgerEntry[]}
 */
export function snapshotSessionLedger(sessionLedger) {
  return Array.from(sessionLedger.values(), (entry) => cloneLedgerEntry(entry));
}

/**
 * @param {Map<string, LedgerEntry>} sessionLedger
 * @param {{ playerId: string; name: string; buyIn: number; currentStack?: number; isSeated?: boolean }} seat
 */
export function recordSessionBuyIn(sessionLedger, { playerId, name, buyIn, currentStack = buyIn, isSeated = true }) {
  const entry = sessionLedger.get(playerId);
  if (entry) {
    entry.buyIns.push(buyIn);
    entry.isSeated = isSeated;
    entry.currentStack = currentStack;
    entry.name = name;
    return;
  }

  sessionLedger.set(playerId, {
    playerId,
    name,
    buyIns: [buyIn],
    cashOuts: [],
    isSeated,
    currentStack,
  });
}

/**
 * @param {Map<string, LedgerEntry>} sessionLedger
 * @param {{ playerId: string; stack: number; remainingStack?: number; isSeated?: boolean }} standUp
 */
export function recordSessionCashOut(sessionLedger, { playerId, stack, remainingStack = 0, isSeated = false }) {
  const entry = sessionLedger.get(playerId);
  if (!entry) return;
  entry.cashOuts.push(stack);
  entry.isSeated = isSeated;
  entry.currentStack = remainingStack;
}

/**
 * @param {Map<string, LedgerEntry>} sessionLedger
 * @param {GameStatePlayers} players
 * @returns {boolean}
 */
export function syncSessionLedgerStacks(sessionLedger, players) {
  let changed = false;
  for (const entry of sessionLedger.values()) {
    if (!entry.isSeated) continue;
    const player = players[entry.playerId];
    if (player && player.stack !== entry.currentStack) {
      entry.currentStack = player.stack;
      changed = true;
    }
  }
  return changed;
}
