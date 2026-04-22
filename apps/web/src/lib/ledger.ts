import type { LedgerEntry, LedgerRow, PayoutInstruction } from "party/types";
import {
  deriveLedgerRows as deriveLedgerRowsBase,
  derivePayoutInstructions as derivePayoutInstructionsBase,
} from "./ledgerMath.mjs";

export function deriveLedgerRows(ledger: LedgerEntry[]): LedgerRow[] {
  return deriveLedgerRowsBase(ledger);
}

export function derivePayoutInstructions(rows: LedgerRow[]): PayoutInstruction[] {
  return derivePayoutInstructionsBase(rows);
}
