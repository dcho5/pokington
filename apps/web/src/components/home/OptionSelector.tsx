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
  const isCompact = variant === "pills";

  return (
    <div
      className="
        flex flex-wrap gap-2 overflow-visible py-1
      "
    >
      {options.map((opt, i) => {
        const active = i === value;

        return (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`
              min-w-0 flex-1 basis-[calc(50%-0.25rem)] whitespace-nowrap rounded-full border
              text-center font-bold transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400
              focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950
              active:scale-[0.97]
              sm:flex-none sm:basis-auto
              ${isCompact
                ? "min-h-[34px] px-4 py-2 text-xs"
                : "min-h-[36px] px-4 py-2 text-xs sm:px-5 sm:text-sm"
              }

              ${active
                ? "border-red-500 bg-red-500 text-white"
                : "border-gray-200 bg-gray-100 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.1] dark:hover:text-gray-200"
              }
            `}
          >
            {String(opt)}
          </button>
        );
      })}
    </div>
  );
}
