"use client";

interface JoinTableCardProps {
  tableCode: string;
  setTableCode: (code: string) => void;
  onJoin: () => void;
}

const JoinTableCard = ({
  tableCode,
  setTableCode,
  onJoin,
}: JoinTableCardProps) => (
  <div
    className="
      animate-slide-up [animation-delay:150ms]
      rounded-2xl
      p-5 sm:p-7
      flex flex-col gap-5 sm:gap-6
      w-full min-w-0 max-w-md
      border bg-white/90 border-gray-200 backdrop-blur
      shadow-lg sm:shadow-xl
      dark:bg-gray-900 dark:border-gray-800
    "
  >
    <h2 className="font-semibold text-lg sm:text-xl text-gray-900 dark:text-gray-100">
      Join Table
    </h2>

    <div className="flex gap-2">
      <input
        className="
          flex-1 min-h-[44px]
          px-3 py-2.5 sm:p-3
          rounded-lg border transition
          border-gray-300 bg-gray-50 text-gray-900
          focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400
          dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100
        "
        placeholder="Enter table code"
        value={tableCode}
        onChange={(e) => setTableCode(e.target.value)}
      />

      <button
        onClick={onJoin}
        className="
          group relative
          min-h-[44px]
          px-4 sm:px-6
          py-2.5 sm:py-3
          rounded-lg font-semibold text-white
          bg-gradient-to-r from-red-500 to-red-700
          shadow-md hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]
          active:scale-[0.97]
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-red-400
          overflow-hidden
        "
      >
        <span className="relative z-10">Join</span>
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </button>
    </div>
  </div>
);

export default JoinTableCard;