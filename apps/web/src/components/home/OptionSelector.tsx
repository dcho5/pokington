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
}: OptionSelectorProps) {
  return (
    <div
      className="
        flex gap-1.5 sm:gap-2
        overflow-x-auto no-scrollbar
        pb-1
      "
    >
      {options.map((opt, i) => {
        const active = i === value;

        return (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`
              relative whitespace-nowrap
              text-[11px] sm:text-xs font-semibold
              px-2.5 sm:px-3
              py-1.5 sm:py-2
              min-h-[32px] sm:min-h-[36px]
              rounded-full
              transition-all duration-200
              flex-shrink-0

              ${active
                ? "text-white"
                : "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.06]"
              }

              active:scale-[0.96]
            `}
          >
            {/* Animated background */}
            <span
              className={`
                absolute inset-0 rounded-full
                transition-all duration-200
                ${active
                  ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                  : "bg-transparent"
                }
              `}
            />

            <span className="relative z-10">{String(opt)}</span>
          </button>
        );
      })}
    </div>
  );
}
