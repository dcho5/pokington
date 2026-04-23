"use client";

import React, { useEffect, useMemo } from "react";
import { TableFeedbackProvider } from "components/Table/FeedbackCoordinator";
import TableLayout from "components/Table/TableLayout";
import { useGameStore } from "store/useGameStore";
import { useTableActions } from "hooks/useTableActions";
import { useTableSceneModel } from "hooks/useTableSceneModel";

export default function TablePageClient({ code }: { code: string }) {
  // This component owns connection lifecycle only. No scene derivation belongs here.

  const scene = useTableSceneModel(code);
  const actions = useTableActions(code);

  useEffect(() => {
    useGameStore.getState().connect(code);
    return () => useGameStore.getState().disconnect();
  }, [code]);

  const tableActions = useMemo(
    () => ({
      ...actions,
      onOpenSeatManager: () => scene.openSeatManager?.(),
      onStandUp: scene.viewingPlayer ? actions.onStandUp : undefined,
      onQueueLeave: scene.viewingPlayer ? actions.onQueueLeave : undefined,
      onCancelBoundaryUpdate: scene.viewingPlayer ? actions.onCancelBoundaryUpdate : undefined,
    }),
    [actions, scene.openSeatManager, scene.viewingPlayer],
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

        <TableLayout
          scene={scene.layout}
          actions={tableActions}
          showSeatManager={scene.showSeatManager}
          onDismissSeatManager={scene.dismissSeatManager}
        />

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
      </TableFeedbackProvider>
    </div>
  );
}
