"use client";
import { useState, useCallback, type CSSProperties } from "react";
import PokerChip from "components/poker/PokerChip";
import CreateTableCard from "components/home/CreateTableCard";
import JoinTableCard from "components/home/JoinTableCard";
import { BLIND_OPTIONS, BLIND_CENTS, BOUNTY_OPTIONS, BOUNTY_VALUES } from "constants/game";
import { createTable, getOrCreateClientId, getTable } from "lib/party";
import {
  getMobileHeaderHeight,
  getMobileSafeAreaBottom,
  getMobileSafeAreaTop,
  getMobileViewportMaxWidth,
} from "lib/mobileShell.mjs";

type HomeShellStyle = CSSProperties & {
  "--mobile-header-height": string;
  "--mobile-shell-max-width": string;
  "--mobile-safe-bottom": string;
};

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

  const homeShellStyle: HomeShellStyle = {
    "--mobile-header-height": getMobileHeaderHeight(),
    "--mobile-shell-max-width": getMobileViewportMaxWidth(),
    "--mobile-safe-bottom": getMobileSafeAreaBottom(24),
  };

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-x-hidden
        bg-gray-100
        transition-colors duration-500
        dark:bg-gray-950"
      style={homeShellStyle}
    >
      <div
        className="fixed left-0 right-0 top-0 z-30 flex items-end justify-center
          border-b border-gray-200/60 bg-white/85 backdrop-blur-md
          dark:border-white/[0.06] dark:bg-[rgba(3,7,18,0.85)]
          md:hidden"
        style={{
          height: getMobileHeaderHeight(),
          paddingTop: getMobileSafeAreaTop(),
        }}
      >
        <div className="flex h-[52px] w-full max-w-[var(--mobile-shell-max-width)] items-center justify-center px-4">
          <div className="flex min-w-0 items-center justify-center gap-2">
            <h1 className="truncate text-xl font-black tracking-tight text-gray-900 dark:text-white">
              Pokington
            </h1>
            <PokerChip size={28} glowAngle={0} />
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-1/2 top-[18%] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full
            bg-red-500/[0.07] blur-[130px] dark:bg-red-600/[0.12]"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/50 to-transparent
            dark:from-black/40"
        />
      </div>

      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[var(--mobile-shell-max-width)] flex-col justify-center
          px-4 pb-[var(--mobile-safe-bottom)] pt-[calc(var(--mobile-header-height)+18px)]
          md:max-w-[640px] md:px-6 md:py-12"
      >
        <div
          className="elevated-surface-light rounded-[28px] border p-4 sm:p-5 md:p-6"
        >
          <div className="surface-content">
            <div className="mb-5 hidden items-center justify-center md:flex">
              <div className="flex min-w-0 items-center justify-center gap-3">
                <h1 className="truncate text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                  Pokington
                </h1>
                <PokerChip size={36} glowAngle={0} />
              </div>
            </div>

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

            <div className="my-5 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-white/[0.08]" />

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
      </div>
    </div>
  );
}
