"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TableFeedbackProvider } from "components/Table/FeedbackCoordinator";
import TableLayout from "components/Table/TableLayout";
import SitDownForm from "components/Table/SitDownForm";
import SeatManager from "components/Table/SeatManager";
import { useGameStore } from "store/useGameStore";
import { useIsMobileLayout } from "hooks/useIsMobileLayout";
import { useTableActions } from "hooks/useTableActions";
import { useTableSceneModel } from "hooks/useTableSceneModel";

export default function TablePageClient({ code }: { code: string }) {
  // This component owns connection lifecycle only. No scene derivation belongs here.

  const isMobileLayout = useIsMobileLayout();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const scene = useTableSceneModel(code);
  const actions = useTableActions(code);

  useEffect(() => {
    useGameStore.getState().connect(code);
    return () => useGameStore.getState().disconnect();
  }, [code]);

  const handleLayoutSitDown = useCallback(
    (seatIndex: number, name?: string, buyInCents?: number) => {
      if (name != null && buyInCents != null) {
        actions.onSitDown(seatIndex, name, buyInCents);
        return;
      }

      if (scene.viewingPlayer) {
        scene.openSeatManager?.(seatIndex);
        return;
      }

      setSelectedSeat(seatIndex);
    },
    [actions, scene.openSeatManager, scene.viewingPlayer],
  );

  const handleConfirmSitDown = useCallback(
    (name: string, buyInCents: number) => {
      if (selectedSeat === null) return;
      actions.onSitDown(selectedSeat, name, buyInCents);
      setSelectedSeat(null);
    },
    [actions, selectedSeat],
  );

  const handleSeatManagerSubmit = useCallback(
    (update: { leaveSeat?: boolean; moveToSeatIndex?: number | null; chipDelta?: number }) => {
      actions.onRequestBoundaryUpdate?.(update);
      scene.dismissSeatManager?.();
    },
    [actions, scene.dismissSeatManager],
  );

  const emptySeatIndices = useMemo(
    () => scene.layout.players.map((player, seatIndex) => player == null ? seatIndex : -1).filter((seatIndex) => seatIndex >= 0),
    [scene.layout.players],
  );

  const tableActions = useMemo(
    () => ({
      ...actions,
      onSitDown: handleLayoutSitDown,
      onOpenSeatManager: (seatIndex?: number | null) => scene.openSeatManager?.(seatIndex ?? scene.viewingPlayer?.seatIndex ?? null),
      onStandUp: scene.viewingPlayer ? actions.onStandUp : undefined,
      onQueueLeave: scene.viewingPlayer ? actions.onQueueLeave : undefined,
      onCancelBoundaryUpdate: scene.viewingPlayer ? actions.onCancelBoundaryUpdate : undefined,
    }),
    [actions, handleLayoutSitDown, scene.openSeatManager, scene.viewingPlayer],
  );

  if (scene.tableNotFound) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-6 px-6 text-center">
        <div className="text-6xl">🃏</div>
        <h1 className="text-2xl font-black">Table not found</h1>
        <p className="text-gray-400 text-sm">
          <code className="font-mono text-gray-200">{code.toUpperCase()}</code> doesn&apos;t exist or hasn&apos;t been created yet.
        </p>
        <a
          href="/"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-700 text-white font-black text-sm shadow-[0_0_16px_rgba(239,68,68,0.4)] hover:shadow-[0_0_22px_rgba(239,68,68,0.6)] transition-shadow"
        >
          Go Home
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-gray-950">
      <TableFeedbackProvider>
        {scene.showReconnectIndicator && (
          <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
            <div className="flex items-center gap-2 rounded-full border border-red-200/15 bg-red-500/10 px-4 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300/65" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-200" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-50/95">
                Reconnecting
              </span>
            </div>
          </div>
        )}

        {scene.viewingPlayer && (
          <div className="fixed right-4 top-4 z-[55]">
            <button
              type="button"
              onClick={() => scene.openSeatManager?.(scene.viewingPlayer?.seatIndex ?? null)}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] backdrop-blur-xl ${
                scene.layout.viewerHasPendingBoundaryUpdate
                  ? "border-amber-400/35 bg-amber-500/15 text-amber-200"
                  : "border-white/15 bg-black/30 text-white"
              }`}
            >
              {scene.layout.viewerHasPendingBoundaryUpdate ? "Seat Update Queued" : "Manage Seat"}
            </button>
          </div>
        )}

        <TableLayout scene={scene.layout} actions={tableActions} />

        {scene.showBlockingConnectionOverlay && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center overflow-hidden bg-slate-950/20 backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.18),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.12),_transparent_42%)]" />
            <div className="relative mx-6 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-6 text-white shadow-[0_25px_90px_rgba(0,0,0,0.48)]">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              <div className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300/60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-200 shadow-[0_0_20px_rgba(254,202,202,0.6)]" />
                </span>
                Live Table Sync
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    {scene.blockingConnectionTitle}
                  </h1>
                  <div className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {code.toUpperCase()}
                  </div>
                </div>
                <p className="max-w-sm text-sm leading-6 text-white/72">
                  {scene.blockingConnectionMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedSeat !== null && (
            <SitDownForm
              seatIndex={selectedSeat}
              bigBlindCents={scene.layout.blinds.big}
              onConfirm={handleConfirmSitDown}
              onDismiss={() => setSelectedSeat(null)}
              variant="dialog"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {scene.showSeatManager && scene.viewingPlayer && (
            <SeatManager
              playerName={scene.viewingPlayer.name}
              currentSeatIndex={scene.viewingPlayer.seatIndex ?? 0}
              currentStackCents={scene.layout.viewerStack}
              bigBlindCents={scene.layout.blinds.big}
              emptySeatIndices={emptySeatIndices}
              applyImmediately={scene.layout.phase === "waiting" || scene.layout.phase === "showdown"}
              pendingUpdate={scene.layout.viewerPendingBoundaryUpdate}
              prefillSeatIndex={scene.seatManagerPrefillSeat ?? scene.viewingPlayer.seatIndex ?? null}
              onSubmit={handleSeatManagerSubmit}
              onCancelPending={actions.onCancelBoundaryUpdate}
              onDismiss={scene.dismissSeatManager ?? (() => {})}
              variant={isMobileLayout ? "sheet" : "dialog"}
            />
          )}
        </AnimatePresence>
      </TableFeedbackProvider>
    </div>
  );
}
