"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PokerChip from "components/poker/PokerChip";
import CreateTableCard from "components/home/CreateTableCard";
import JoinTableCard from "components/home/JoinTableCard";
import { BLIND_OPTIONS, BOUNTY_OPTIONS, BLIND_CENTS } from "constants/game";

export default function HomePage() {
  const router = useRouter();
  const [blindIdx, setBlindIdx] = useState(0);
  const [bountyIdx, setBountyIdx] = useState(0);
  const [tableName, setTableName] = useState("");
  const [tableCode, setTableCode] = useState("");

  const handleCreate = useCallback(() => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const blinds = BLIND_CENTS[blindIdx] ?? BLIND_CENTS[0];
    const sevenTwoBountyBB = Math.min(bountyIdx, 3) as 0 | 1 | 2 | 3;
    sessionStorage.setItem(`table_config_${code}`, JSON.stringify({
      tableName: tableName.trim() || `Table ${code}`,
      blinds,
      sevenTwoBountyBB,
    }));
    router.push(`/t/${code}`);
  }, [blindIdx, bountyIdx, tableName, router]);

  const handleJoin = useCallback(() => {
    const code = tableCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(`/t/${code}`);
  }, [tableCode, router]);

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden
      bg-gradient-to-b from-gray-100 to-gray-200
      dark:from-gray-950 dark:to-black"
    >
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2
          w-[140vw] max-w-[800px] aspect-square
          bg-red-500/10 blur-[140px] rounded-full
          dark:bg-red-600/20"
        />
      </div>

      <div className="relative z-10 px-4 pt-14 pb-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <span className="text-base tracking-widest text-gray-500 mb-2 select-none">
            ♠ ♥ ♦ ♣
          </span>

          <div className="flex items-center gap-1.5 mb-2">
            <h1 className="font-bold text-3xl sm:text-4xl text-gray-900 dark:text-white">
              Pokington
            </h1>
            <PokerChip size={34} />
          </div>

          <div className="text-sm sm:text-lg text-gray-700 dark:text-gray-300">
            Real-time multiplayer Texas Hold&#39;em
          </div>
        </div>

        {/* Cards */}
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
              bountyOptions={BOUNTY_OPTIONS}
              blindIdx={blindIdx}
              setBlindIdx={setBlindIdx}
              bountyIdx={bountyIdx}
              setBountyIdx={setBountyIdx}
              tableName={tableName}
              setTableName={setTableName}
              onCreate={handleCreate}
            />
          </div>

          <div className="w-full max-w-md mx-auto">
            <JoinTableCard
              tableCode={tableCode}
              setTableCode={setTableCode}
              onJoin={handleJoin}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 mb-3 text-xs text-center text-gray-500 opacity-80">
          Pokington © 2026. Texas Hold&#39;em for web and mobile.
        </footer>
      </div>
    </div>
  );
}