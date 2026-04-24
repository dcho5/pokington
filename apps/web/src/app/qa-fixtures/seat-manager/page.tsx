"use client";

import SeatManager from "components/Table/SeatManager";

export default function SeatManagerFixturePage() {
  return (
    <div className="relative min-h-screen bg-slate-950 p-12">
      <SeatManager
        playerName="Alex"
        currentSeatIndex={0}
        currentStackCents={500000}
        bigBlindCents={200}
        applyImmediately={false}
        pendingUpdate={{ leaveSeat: false, moveToSeatIndex: 4, chipDelta: 0 }}
        onSubmit={() => {}}
        onCancelPending={() => {}}
        onDismiss={() => {}}
        variant="dialog"
      />
    </div>
  );
}
