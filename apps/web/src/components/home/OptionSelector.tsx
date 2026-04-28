"use client";

type SelectorVariant = "tabs" | "pills";

interface OptionSelectorProps {
  options: readonly string[];
  value: number;
  onChange: (idx: number) => void;
  variant: SelectorVariant;
}

export default function OptionSelector({
  options,
  value,
  onChange,
  variant,
}: OptionSelectorProps) {
  const isPillStyle = variant === "pills";

  return (
    <div
      className="
        -mx-2 flex gap-2 overflow-x-auto scrollbar-none
        px-2 py-2.5 sm:gap-2.5
      "
    >
      {options.map((opt, i) => {
        const active = i === value;

        return (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`
              group relative flex-shrink-0 overflow-hidden whitespace-nowrap
              rounded-full border
              font-black tracking-[0.01em]
              transition-all duration-200 ease-out
              focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/75
              focus-visible:ring-offset-2 focus-visible:ring-offset-white
              dark:focus-visible:ring-offset-gray-950
              active:scale-[0.97]
              ${isPillStyle
                ? "min-h-[34px] px-4 py-2 text-xs sm:min-h-[38px] sm:px-5 sm:text-sm"
                : "min-h-[36px] px-4 py-2 text-xs sm:min-h-[40px] sm:px-5 sm:text-sm"
              }

              ${active
                ? "border-red-400/80 bg-gradient-to-b from-red-400 to-red-600 text-white shadow-[0_10px_22px_rgba(239,68,68,0.28),inset_0_1px_0_rgba(255,255,255,0.34)]"
                : "border-gray-200/75 bg-gray-100/85 text-gray-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:text-gray-800 hover:shadow-[0_8px_18px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-gray-400 dark:shadow-none dark:hover:border-white/[0.14] dark:hover:bg-white/[0.1] dark:hover:text-gray-200"
              }
            `}
          >
            {active ? (
              <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/55" />
            ) : null}
            <span className="relative z-10">{String(opt)}</span>
          </button>
        );
      })}
    </div>
  );
}
