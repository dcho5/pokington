"use client";

import DesktopLedgerPanel from "components/Table/desktop/DesktopLedgerPanel";

const rows = [
  {
    playerId: "p1",
    name: "Alex",
    totalBuyIn: 500000,
    totalCashOut: 610000,
    net: 110000,
    isSeated: true,
  },
  {
    playerId: "p2",
    name: "Blake",
    totalBuyIn: 500000,
    totalCashOut: 390000,
    net: -110000,
    isSeated: false,
  },
];

const payouts = [
  {
    fromName: "Blake",
    toName: "Alex",
    amount: 110000,
  },
];

export default function LedgerFixturePage() {
  return (
    <div className="relative flex min-h-screen items-end bg-slate-950 p-12">
      <div className="relative">
        <DesktopLedgerPanel rows={rows} payouts={payouts} onClose={() => {}} />
      </div>
    </div>
  );
}
