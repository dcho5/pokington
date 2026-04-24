"use client";
import { useState, useCallback } from "react";
import PokerChip from "components/poker/PokerChip";
import CreateTableCard from "components/home/CreateTableCard";
import JoinTableCard from "components/home/JoinTableCard";
import { BLIND_OPTIONS, BLIND_CENTS, BOUNTY_OPTIONS, BOUNTY_VALUES } from "constants/game";
import { createTable, getOrCreateClientId, getTable } from "lib/party";

export default function HomePage() {
  const [blindIdx, setBlindIdx] = useState(0);
  const [bountyIdx, setBountyIdx] = useState(0);
  const [tableName, setTableName] = useState("");
  const [tableCode, setTableCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const navigateToTable = useCallback((code: string) => {
    window.location.assign(`/t/${code.toUpperCase()}`);
  }, []);

  const handleCreate = useCallback(async () => {
    setCreateError(null);
    setIsCreating(true);
    try {
      const blinds = BLIND_CENTS[blindIdx] ?? BLIND_CENTS[0];
      const response = await createTable({
        tableName: tableName.trim(),
        blinds,
        creatorClientId: getOrCreateClientId(),
        sevenTwoBountyBB: BOUNTY_VALUES[bountyIdx],
      });
      navigateToTable(response.code);
    } catch (error) {
      const message = error instanceof Error
        ? error.message === "CODE_ALLOCATION_FAILED"
          ? "Couldn’t reserve a unique code. Try again."
          : error.message === "PARTYKIT_UNAVAILABLE"
            ? "Realtime server unavailable. Restart `pnpm dev`."
            : "Couldn’t create a table right now. Try again."
        : "Couldn’t create a table right now. Try again.";
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  }, [blindIdx, bountyIdx, navigateToTable, tableName]);

  const handleJoin = useCallback(async () => {
    const code = tableCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError("Table codes are exactly 6 characters.");
      return;
    }
    setJoinError(null);
    setIsJoining(true);
    try {
      const table = await getTable(code);
      if (!table.exists || table.status !== "active") {
        setJoinError("Table not found. Check the code and try again.");
        return;
      }
      navigateToTable(code);
    } catch (error) {
      setJoinError(
        error instanceof Error && error.message === "PARTYKIT_UNAVAILABLE"
          ? "Realtime server unavailable. Restart `pnpm dev`."
          : "Couldn’t verify that table. Try again.",
      );
    } finally {
      setIsJoining(false);
    }
  }, [navigateToTable, tableCode]);

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden
      bg-gradient-to-b from-gray-100 to-gray-200
      dark:from-gray-950 dark:to-black"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2
          w-[140vw] max-w-[800px] aspect-square
          bg-red-500/10 blur-[140px] rounded-full
          dark:bg-red-600/20"
        />
      </div>

      <div className="relative z-10 px-4 pt-14 pb-6">
        <div className="flex flex-col items-center text-center mb-8">
          <span className="text-base tracking-widest text-gray-500 mb-2 select-none">
            ♠ ♥ ♦ ♣
          </span>

          <div className="flex items-center gap-1.5 mb-2">
            <h1 className="font-bold text-3xl sm:text-4xl text-gray-900 dark:text-white">
              Pokington
            </h1>
            <PokerChip size={34} glowAngle={0}/>
          </div>

          <div className="text-sm sm:text-lg text-gray-700 dark:text-gray-300">
            Real-time multiplayer Texas Hold&#39;em
          </div>
        </div>

        <div className="
          flex flex-col md:flex-row
          gap-4 sm:gap-6 md:gap-8
          max-w-5xl mx-auto
          items-center md:items-start
          justify-center
        ">
          <div className="w-full max-w-md mx-auto">
            <CreateTableCard
              blindOptions={BLIND_OPTIONS}
              blindIdx={blindIdx}
              setBlindIdx={setBlindIdx}
              bountyOptions={BOUNTY_OPTIONS}
              bountyIdx={bountyIdx}
              setBountyIdx={setBountyIdx}
              tableName={tableName}
              setTableName={setTableName}
              onCreate={handleCreate}
              status={createError}
              isCreating={isCreating}
            />
          </div>

          <div className="w-full max-w-md mx-auto">
            <JoinTableCard
              tableCode={tableCode}
              setTableCode={(code) => {
                setTableCode(code);
                if (joinError) setJoinError(null);
              }}
              onJoin={handleJoin}
              error={joinError}
              isJoining={isJoining}
            />
          </div>
        </div>

        <footer className="mt-10 mb-3 text-xs text-center text-gray-500 opacity-80">
          Pokington © 2026. Texas Hold&#39;em for web and mobile.
        </footer>
      </div>
    </div>
  );
}
