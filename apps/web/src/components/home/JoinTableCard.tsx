"use client";

interface JoinTableCardProps {
  tableCode: string;
  setTableCode: (code: string) => void;
  onJoin: () => void;
  error?: string | null;
  isJoining?: boolean;
}

const JoinTableCard = ({
  tableCode,
  setTableCode,
  onJoin,
  error,
  isJoining = false,
}: JoinTableCardProps) => (
  <section className="flex min-w-0 flex-col gap-3.5 rounded-2xl border border-gray-200/70 bg-white/45 p-3.5 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-base font-black tracking-tight text-gray-900 dark:text-white">
          Join
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
          Enter a 6-character code.
        </p>
      </div>
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        Code
      </span>
    </div>

    <div className="flex gap-2">
      <input
        className="
          flex-1 min-h-[48px] min-w-0
          px-3.5 py-3
          rounded-2xl border transition
          border-gray-200/80 bg-white/72 font-mono text-sm font-black uppercase tracking-[0.18em] text-gray-900 shadow-sm
          placeholder:font-sans placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400
          dark:border-white/[0.08] dark:bg-gray-950/60 dark:text-gray-100
        "
        placeholder="Table code"
        value={tableCode}
        onChange={(e) => setTableCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isJoining) onJoin();
        }}
      />

      <button
        onClick={onJoin}
        disabled={isJoining}
        className="
          group relative
          min-h-[48px]
          px-4 sm:px-6
          rounded-2xl font-black text-white
          bg-gray-900 shadow-sm
          active:scale-[0.98]
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-red-400
          overflow-hidden
          disabled:cursor-not-allowed disabled:opacity-70
          dark:bg-white/[0.08] dark:text-white dark:ring-1 dark:ring-white/[0.08]
          sm:hover:bg-red-600 dark:sm:hover:bg-red-600
        "
      >
        <span className="relative z-10">{isJoining ? "Checking..." : "Join"}</span>
        <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity duration-300 sm:group-hover:opacity-100" />
      </button>
    </div>
    {error ? (
      <p className="text-xs font-semibold text-red-500 dark:text-red-400">
        {error}
      </p>
    ) : null}
  </section>
);

export default JoinTableCard;
