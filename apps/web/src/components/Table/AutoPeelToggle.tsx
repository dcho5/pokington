import React from "react";

interface AutoPeelToggleProps {
  enabled: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  size?: "compact" | "default";
  className?: string;
}

const AutoPeelToggle: React.FC<AutoPeelToggleProps> = ({
  enabled,
  onClick,
  size = "default",
  className = "",
}) => {
  const sizeClassName =
    size === "compact"
      ? "rounded-lg px-2.5 py-1.5 text-[9px]"
      : "rounded-full px-3.5 py-[5px] text-[12px]";

  const dotClassName = size === "compact" ? "h-1.5 w-1.5" : "h-2 w-2";
  const textClassName = size === "compact" ? "leading-[1.15]" : "leading-none";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center font-black uppercase tracking-wide transition-colors",
        sizeClassName,
        enabled
          ? "bg-red-500 text-white"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/[0.07] dark:text-gray-300 dark:hover:bg-white/[0.12]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="inline-grid max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 px-0.5">
        <span
          className={`${dotClassName} rounded-full flex-shrink-0 ${
            enabled ? "bg-white" : "bg-gray-300 dark:bg-gray-600"
          }`}
        />
        <span className={`min-w-0 whitespace-normal text-center ${textClassName}`}>
          auto peel
        </span>
      </span>
    </button>
  );
};

export default AutoPeelToggle;
