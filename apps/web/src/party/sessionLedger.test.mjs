import test from "node:test";
import assert from "node:assert/strict";

import { deriveLedgerRows } from "../lib/ledgerMath.mjs";
import {
  createSessionLedger,
  recordSessionBuyIn,
  recordSessionCashOut,
  snapshotSessionLedger,
  syncSessionLedgerStacks,
} from "./sessionLedger.mjs";

test("rebuys append exactly one new buy-in and keep previous cash-outs intact", () => {
  const sessionLedger = createSessionLedger();

  recordSessionBuyIn(sessionLedger, { playerId: "p1", name: "Alice", buyIn: 10000 });
  syncSessionLedgerStacks(sessionLedger, {
    p1: { stack: 0 },
  });
  recordSessionCashOut(sessionLedger, { playerId: "p1", stack: 0 });
  recordSessionBuyIn(sessionLedger, { playerId: "p1", name: "Alice", buyIn: 8000 });
  syncSessionLedgerStacks(sessionLedger, {
    p1: { stack: 11250 },
  });

  assert.deepEqual(snapshotSessionLedger(sessionLedger), [
    {
      playerId: "p1",
      name: "Alice",
      buyIns: [10000, 8000],
      cashOuts: [0],
      isSeated: true,
      currentStack: 11250,
    },
  ]);

  const [row] = deriveLedgerRows(snapshotSessionLedger(sessionLedger));
  assert.equal(row.totalBuyIn, 18000);
  assert.equal(row.totalCashOut, 11250);
  assert.equal(row.net, -6750);
});

test("seat changes do not create synthetic buy-ins or cash-outs", () => {
  const sessionLedger = createSessionLedger();

  recordSessionBuyIn(sessionLedger, { playerId: "p1", name: "Alice", buyIn: 15000 });
  syncSessionLedgerStacks(sessionLedger, {
    p1: { stack: 18750 },
  });

  const beforeSeatMove = snapshotSessionLedger(sessionLedger);

  syncSessionLedgerStacks(sessionLedger, {
    p1: { stack: 18750, seatIndex: 5 },
  });

  assert.deepEqual(snapshotSessionLedger(sessionLedger), beforeSeatMove);
});

test("restored ledgers clone persisted state before future mutations", () => {
  const persisted = [
    {
      playerId: "p1",
      name: "Alice",
      buyIns: [10000],
      cashOuts: [12500],
      isSeated: false,
      currentStack: 0,
    },
    {
      playerId: "p2",
      name: "Bob",
      buyIns: [10000],
      cashOuts: [],
      isSeated: true,
      currentStack: 7500,
    },
  ];

  const sessionLedger = createSessionLedger(persisted);
  recordSessionBuyIn(sessionLedger, { playerId: "p2", name: "Bob", buyIn: 6000 });

  assert.deepEqual(persisted, [
    {
      playerId: "p1",
      name: "Alice",
      buyIns: [10000],
      cashOuts: [12500],
      isSeated: false,
      currentStack: 0,
    },
    {
      playerId: "p2",
      name: "Bob",
      buyIns: [10000],
      cashOuts: [],
      isSeated: true,
      currentStack: 7500,
    },
  ]);

  assert.deepEqual(snapshotSessionLedger(sessionLedger), [
    {
      playerId: "p1",
      name: "Alice",
      buyIns: [10000],
      cashOuts: [12500],
      isSeated: false,
      currentStack: 0,
    },
    {
      playerId: "p2",
      name: "Bob",
      buyIns: [10000, 6000],
      cashOuts: [],
      isSeated: true,
      currentStack: 6000,
    },
  ]);
});
