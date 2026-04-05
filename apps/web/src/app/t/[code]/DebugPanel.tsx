"use client";
import React, { useState } from "react";
import { useGameStore } from "store/useGameStore";
import { formatCents } from "lib/formatCents";

export default function DebugPanel() {
  const store = useGameStore();
  const [collapsed, setCollapsed] = useState(false);

  const gs = store.gameState;
  const phase = gs.phase;
  const actorId = gs.needsToAct[0] ?? null;
  const actorName = actorId ? gs.players[actorId]?.name : "—";
  const viewingPlayer = store.getViewingPlayer();
  const playerList = Object.values(gs.players);
  const sevenTwoBountyBB = store.getSevenTwoBountyBB();
  const voluntaryShownPlayerIds = store.getVoluntaryShownPlayerIds();
  const canShowForDebug =
    phase === "showdown" &&
    viewingPlayer !== null &&
    !voluntaryShownPlayerIds.includes(viewingPlayer.id);

  // Find Alice for the 7-2 debug button
  const alicePlayer = playerList.find((p) => p.name.toLowerCase() === "alice");
  const canGiveAliceSevTwo = phase === "pre-flop" && !!alicePlayer;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-3 right-3 z-[100] w-10 h-10 rounded-full bg-gray-900/90 text-white text-xs font-bold shadow-lg flex items-center justify-center"
      >
        DBG
      </button>
    );
  }

  return (
    <div className="fixed top-3 right-3 z-[100] w-64 bg-gray-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/10 p-3 text-xs font-mono">
      <div className="flex justify-between items-center mb-2">
        <span className="font-black text-red-400 uppercase tracking-wider text-[10px]">Debug</span>
        <button onClick={() => setCollapsed(true)} className="text-gray-500 hover:text-white">×</button>
      </div>

      {/* Status */}
      <div className="space-y-1 mb-3">
        <div>Phase: <span className="text-green-400">{phase}</span></div>
        <div>Hand #: <span className="text-green-400">{gs.handNumber}</span></div>
        <div>Pot: <span className="text-yellow-400">{formatCents(store.getTotalPotWithBets())}</span></div>
        <div>Actor: <span className="text-red-400">{actorName}</span></div>
        <div>Viewing: <span className="text-blue-400">{viewingPlayer?.name ?? "—"} (seat {store.viewingSeat})</span></div>
      </div>

      {/* Switch viewing seat */}
      <div className="mb-3">
        <div className="text-gray-500 mb-1">Switch View:</div>
        <div className="flex flex-wrap gap-1">
          {playerList.map((p) => (
            <button
              key={p.id}
              onClick={() => store.setViewingSeat(p.seatIndex)}
              className={`px-2 py-1 rounded text-[10px] font-bold ${
                p.seatIndex === store.viewingSeat
                  ? "bg-red-500 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 7-2 Bounty config (only before first hand) */}
      {gs.handNumber === 0 && (
        <div className="mb-3 pt-2 border-t border-white/10">
          <div className="text-gray-500 mb-1 text-[10px]">7-2 Bounty:</div>
          <div className="flex gap-1">
            {([0, 1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => store.setSevenTwoBounty(n)}
                className={`flex-1 py-1.5 rounded text-[10px] ${
                  sevenTwoBountyBB === n
                    ? "bg-red-800 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {n === 0 ? "Off" : `${n}×`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Show Cards button (debug) */}
      {canShowForDebug && (
        <div className="mb-3 pt-2 border-t border-white/10">
          <button
            onClick={() => store.showCards()}
            className="w-full py-1.5 rounded bg-yellow-700 hover:bg-yellow-600 text-white text-[10px] font-bold"
          >
            Show Cards ({viewingPlayer?.name})
          </button>
        </div>
      )}

      {/* Bomb Pot — propose or approve all */}
      {(phase === "showdown" || phase === "waiting") && !gs.bombPotVote && (
        <div className="mb-3 pt-2 border-t border-white/10">
          <div className="text-gray-500 mb-1 text-[10px]">Bomb Pot:</div>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                onClick={() => store.proposeBombPot(n)}
                className="flex-1 py-1.5 rounded text-[10px] font-black"
                style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }}
              >
                {n}x
              </button>
            ))}
          </div>
        </div>
      )}

      {gs.bombPotVote && (
        <div className="mb-3 pt-2 border-t border-white/10">
          <div className="text-gray-500 mb-1 text-[10px]">Bomb Pot Vote (approve all):</div>
          <button
            onClick={() => {
              const s = useGameStore.getState();
              Object.keys(gs.players).forEach((id) => {
                if (gs.bombPotVote && gs.bombPotVote.votes[id] === undefined) {
                  s.sendEvent({ type: "VOTE_BOMB_POT", playerId: id, approve: true });
                }
              });
            }}
            className="w-full py-1.5 rounded text-[10px] font-black"
            style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }}
          >
            Approve All
          </button>
        </div>
      )}

      {/* Voting — clicking a count immediately resolves */}
      {phase === "voting" && (
        <div className="mb-3 pt-2 border-t border-white/10">
          <div className="text-gray-500 mb-1 text-[10px]">Run it (auto-resolves):</div>
          <div className="flex gap-1">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => {
                  const s = useGameStore.getState();
                  Object.values(s.gameState.players).forEach((p) => {
                    if (p.isAllIn) s.sendEvent({ type: "VOTE_RUN", playerId: p.id, count: n });
                  });
                  s.sendEvent({ type: "RESOLVE_VOTE" });
                }}
                className="flex-1 py-1.5 rounded bg-purple-800 hover:bg-purple-700 text-white text-[10px]"
              >
                {n}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Give Alice 7-2 offsuit (pre-flop only) */}
      {canGiveAliceSevTwo && (
        <div className="mb-3 pt-2 border-t border-white/10">
          <button
            onClick={() =>
              store.debugSetHoleCards(alicePlayer!.id, [
                { rank: "7", suit: "spades" },
                { rank: "2", suit: "hearts" },
              ])
            }
            className="w-full py-1.5 rounded bg-red-900 hover:bg-red-800 text-red-200 text-[10px] font-bold"
          >
            Give Alice 7♠ 2♥
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-1">
        {(phase === "waiting" || phase === "showdown") && (
          <button
            onClick={store.startHand}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-700 text-white font-bold text-[11px]"
          >
            {phase === "showdown" ? "Next Hand" : "Start Hand"}
          </button>
        )}

        {actorId && (
          <>
            <div className="text-gray-500 mt-2 mb-1">Actions for {actorName}:</div>
            <div className="flex gap-1">
              <button onClick={store.fold} className="flex-1 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">Fold</button>
              {store.canCheck() ? (
                <button onClick={store.check} className="flex-1 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">Check</button>
              ) : (
                <button onClick={store.call} className="flex-1 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">Call</button>
              )}
              <button onClick={() => store.raise(store.getMinRaise())} className="flex-1 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white">Raise</button>
            </div>
          </>
        )}
      </div>

      {/* Player stacks */}
      <div className="mt-3 pt-2 border-t border-white/10 space-y-0.5">
        {playerList.map((p) => (
          <div key={p.id} className={`flex justify-between ${p.isFolded ? "text-gray-600" : ""}`}>
            <span>{p.name} {p.id === actorId ? "◀" : ""}</span>
            <span className="text-yellow-400">{formatCents(p.stack)}{p.currentBet > 0 ? ` (${formatCents(p.currentBet)})` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
