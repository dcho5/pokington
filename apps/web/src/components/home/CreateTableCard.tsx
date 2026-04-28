"use client";
import OptionSelector from "./OptionSelector";
import type { BLIND_OPTIONS } from "constants/game";

interface CreateTableCardProps {
  blindOptions: typeof BLIND_OPTIONS;
  blindIdx: number;
  setBlindIdx: (idx: number) => void;
  bountyOptions: readonly string[];
  bountyIdx: number;
  setBountyIdx: (idx: number) => void;
  tableName: string;
  setTableName: (name: string) => void;
  onCreate: () => void;
  status?: string | null;
  isCreating?: boolean;
}

const CreateTableCard = ({
  blindOptions,
  blindIdx,
  setBlindIdx,
  bountyOptions,
  bountyIdx,
  setBountyIdx,
  tableName,
  setTableName,
  onCreate,
  status,
  isCreating = false,
}: CreateTableCardProps) => (
  <section className="flex min-w-0 flex-col gap-4">
    <div className="min-w-0">
      <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
        Create
      </h2>
      <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
        Set stakes, create, share link.
      </p>
    </div>

    <input
      className="
        w-full min-h-[48px]
        px-3.5 py-3
        rounded-2xl border transition
        border-gray-200/80 bg-white/72 text-gray-900 shadow-sm
        placeholder:text-gray-400
        focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400
        dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100
      "
      placeholder="Table name"
      value={tableName}
      onChange={(e) => setTableName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isCreating) onCreate();
      }}
    />

    <div className="space-y-1.5">
      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
        Blinds
      </label>
      <OptionSelector
        options={blindOptions}
        value={blindIdx}
        onChange={setBlindIdx}
        variant="tabs"
      />
    </div>

    <div className="space-y-1.5">
      <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
        Bounty
      </label>
      <OptionSelector
        options={bountyOptions}
        value={bountyIdx}
        onChange={setBountyIdx}
        variant="tabs"
      />
    </div>

    <button
      onClick={onCreate}
      disabled={isCreating}
      className="
        group relative w-full
        min-h-[52px]
        py-3.5
        rounded-2xl font-black text-white
        bg-gradient-to-r from-red-500 to-red-700
        shadow-[0_16px_32px_rgba(239,68,68,0.26)]
        active:scale-[0.98]
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-red-400
        overflow-hidden
        disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none
        sm:hover:shadow-[0_0_24px_rgba(239,68,68,0.45)]
      "
    >
      <span className="relative z-10">{isCreating ? "Creating..." : "Create Table"}</span>
      <div className="absolute inset-0 bg-white/15 opacity-0 transition-opacity duration-300 sm:group-hover:opacity-100" />
    </button>

    {status ? (
      <p className="text-xs font-semibold text-red-500 dark:text-red-400">
        {status}
      </p>
    ) : null}
  </section>
);

export default CreateTableCard;
