import test from "node:test";
import assert from "node:assert/strict";

import { deriveLedgerRows, derivePayoutInstructions } from "./ledgerMath.mjs";

function createRng(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function splitAmount(total, parts, rng) {
  if (parts === 1) return [total];
  const cuts = [];
  for (let index = 0; index < parts - 1; index += 1) {
    cuts.push(randomInt(rng, 0, total));
  }
  cuts.sort((a, b) => a - b);

  const chunks = [];
  let previous = 0;
  for (const cut of cuts) {
    chunks.push(cut - previous);
    previous = cut;
  }
  chunks.push(total - previous);
  return chunks;
}

function buildBalancedLedgerEntries(rng, playerCount) {
  const nets = [];
  let netSum = 0;
  for (let index = 0; index < playerCount - 1; index += 1) {
    const net = randomInt(rng, -30000, 30000);
    nets.push(net);
    netSum += net;
  }
  nets.push(-netSum);

  return nets.map((net, index) => {
    const minimumBuyIn = Math.max(100, -net);
    const totalBuyIn = minimumBuyIn + randomInt(rng, 0, 30000);
    const totalCashOut = totalBuyIn + net;
    const buyInParts = randomInt(rng, 1, 4);
    const buyIns = splitAmount(totalBuyIn, buyInParts, rng);
    const isSeated = totalCashOut > 0 ? rng() > 0.5 : false;
    const currentStack = isSeated ? randomInt(rng, 0, totalCashOut) : 0;
    const cashOuts = splitAmount(totalCashOut - currentStack, randomInt(rng, 1, 4), rng);

    return {
      playerId: `p${index + 1}`,
      name: `Player ${index + 1}`,
      buyIns,
      cashOuts,
      isSeated,
      currentStack,
    };
  });
}

test("ledger rows preserve zero-sum money accounting under randomized stress", () => {
  const rng = createRng(42);

  for (let iteration = 0; iteration < 250; iteration += 1) {
    const rows = deriveLedgerRows(buildBalancedLedgerEntries(rng, randomInt(rng, 2, 8)));
    const totalNet = rows.reduce((sum, row) => sum + row.net, 0);

    assert.equal(totalNet, 0, `iteration ${iteration} drifted away from zero-sum accounting`);
  }
});

test("payout instructions settle every creditor and debtor exactly", () => {
  const rng = createRng(777);

  for (let iteration = 0; iteration < 250; iteration += 1) {
    const rows = deriveLedgerRows(buildBalancedLedgerEntries(rng, randomInt(rng, 2, 8)));
    const payouts = derivePayoutInstructions(rows);
    const settlements = new Map(rows.map((row) => [row.playerId, row.net]));

    for (const payout of payouts) {
      settlements.set(payout.fromPlayerId, (settlements.get(payout.fromPlayerId) ?? 0) + payout.amount);
      settlements.set(payout.toPlayerId, (settlements.get(payout.toPlayerId) ?? 0) - payout.amount);
    }

    assert.equal(
      Array.from(settlements.values()).every((value) => value === 0),
      true,
      `iteration ${iteration} left unsettled balances`,
    );
  }
});

test("payout instructions ignore neutral players and keep exact cents", () => {
  const rows = deriveLedgerRows([
    {
      playerId: "a",
      name: "Alice",
      buyIns: [10000],
      cashOuts: [],
      isSeated: true,
      currentStack: 13000,
    },
    {
      playerId: "b",
      name: "Bob",
      buyIns: [8000],
      cashOuts: [],
      isSeated: true,
      currentStack: 7000,
    },
    {
      playerId: "c",
      name: "Casey",
      buyIns: [5000],
      cashOuts: [],
      isSeated: true,
      currentStack: 3000,
    },
    {
      playerId: "d",
      name: "Drew",
      buyIns: [4000],
      cashOuts: [],
      isSeated: true,
      currentStack: 4000,
    },
  ]);

  assert.deepEqual(derivePayoutInstructions(rows), [
    {
      fromPlayerId: "c",
      fromName: "Casey",
      toPlayerId: "a",
      toName: "Alice",
      amount: 2000,
    },
    {
      fromPlayerId: "b",
      fromName: "Bob",
      toPlayerId: "a",
      toName: "Alice",
      amount: 1000,
    },
  ]);
});
