"use client";
import OptionSelector from "./OptionSelector";
import type { BLIND_OPTIONS, BOUNTY_OPTIONS } from "constants/game";

interface CreateTableCardProps {
  blindOptions: typeof BLIND_OPTIONS;
  bountyOptions: typeof BOUNTY_OPTIONS;
  blindIdx: number;
  setBlindIdx: (idx: number) => void;
  bountyIdx: number;
  setBountyIdx: (idx: number) => void;
  tableName: string;
  setTableName: (name: string) => void;
  onCreate: () => void;
}

const CreateTableCard = ({
  blindOptions,
  bountyOptions,
  blindIdx,
  setBlindIdx,
  bountyIdx,
  setBountyIdx,
  tableName,
  setTableName,
  onCreate,
}: CreateTableCardProps) => (
  <div
    className="
      animate-slide-up rounded-2xl
      p-5 sm:p-7
      flex flex-col gap-5 sm:gap-6
      w-full min-w-0 max-w-lg
      border bg-white/90 border-gray-200 backdrop-blur
      shadow-lg sm:shadow-xl
      dark:bg-gray-900 dark:border-gray-800
    "
  >
    <h2 className="font-semibold text-lg sm:text-xl text-gray-900 dark:text-gray-100">
      Create Table
    </h2>

    <input
      className="
        w-full min-h-[44px]
        px-3 py-2.5 sm:p-3
        rounded-lg border transition
        border-gray-300 bg-gray-50 text-gray-900
        focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400
        dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100
      "
      placeholder="Table name (optional)"
      value={tableName}
      onChange={(e) => setTableName(e.target.value)}
    />

    <div className="space-y-1">
      <label className="block text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
        Blinds
      </label>
      <OptionSelector
        options={blindOptions}
        value={blindIdx}
        onChange={setBlindIdx}
        variant="tabs"
      />
    </div>

    <div className="space-y-1">
      <label className="block text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
        7-2 Offsuit Bounty
      </label>
      <OptionSelector
        options={bountyOptions}
        value={bountyIdx}
        onChange={setBountyIdx}
        variant="pills"
      />
    </div>

    <button
      onClick={onCreate}
      className="
        group relative w-full
        min-h-[48px]
        py-3.5 sm:py-3
        rounded-lg font-semibold text-white
        bg-gradient-to-r from-red-500 to-red-700
        shadow-md hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]
        active:scale-[0.97]
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-red-400
        overflow-hidden
      "
    >
      <span className="relative z-10">Create Table</span>
      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </button>
  </div>
);

export default CreateTableCard;