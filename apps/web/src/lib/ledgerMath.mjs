/** @typedef {import("party/types").LedgerEntry} LedgerEntry */
/** @typedef {import("party/types").LedgerRow} LedgerRow */
/** @typedef {import("party/types").PayoutInstruction} PayoutInstruction */

/**
 * @param {LedgerEntry[]} ledger
 * @returns {LedgerRow[]}
 */
export function deriveLedgerRows(ledger) {
  return ledger.map((entry) => {
    const totalBuyIn = entry.buyIns.reduce((sum, value) => sum + value, 0);
    const totalCashOut = entry.cashOuts.reduce((sum, value) => sum + value, 0) + entry.currentStack;
    return {
      playerId: entry.playerId,
      name: entry.name,
      totalBuyIn,
      totalCashOut,
      net: totalCashOut - totalBuyIn,
      isSeated: entry.isSeated,
    };
  });
}

/**
 * @param {LedgerRow[]} rows
 * @returns {PayoutInstruction[]}
 */
export function derivePayoutInstructions(rows) {
  const creditors = rows
    .filter((row) => row.net > 0)
    .map((row) => ({ ...row, rem: row.net }))
    .sort((a, b) => b.rem - a.rem);
  const debtors = rows
    .filter((row) => row.net < 0)
    .map((row) => ({ ...row, rem: -row.net }))
    .sort((a, b) => b.rem - a.rem);

  /** @type {PayoutInstruction[]} */
  const payouts = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const amount = Math.min(creditors[creditorIndex].rem, debtors[debtorIndex].rem);
    if (amount > 0) {
      payouts.push({
        fromPlayerId: debtors[debtorIndex].playerId,
        fromName: debtors[debtorIndex].name,
        toPlayerId: creditors[creditorIndex].playerId,
        toName: creditors[creditorIndex].name,
        amount,
      });
    }
    creditors[creditorIndex].rem -= amount;
    debtors[debtorIndex].rem -= amount;
    if (creditors[creditorIndex].rem === 0) creditorIndex += 1;
    if (debtors[debtorIndex].rem === 0) debtorIndex += 1;
  }

  return payouts;
}
