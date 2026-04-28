"use client";

import React from "react";
import { motion } from "framer-motion";

type AnnouncementTone = "gold" | "rose" | "violet" | "sky" | "amber";
type AnnouncementVariant = "desktop" | "mobile";

interface AnnouncementBannerProps {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  badge?: React.ReactNode;
  tone?: AnnouncementTone;
  variant?: AnnouncementVariant;
  children?: React.ReactNode;
}

const TONE_STYLES: Record<
  AnnouncementTone,
  {
    aura: string;
    wash: string;
    foundation: string;
    dot: string;
    dotPulse: string;
    eyebrow: string;
    badge: string;
    title: string;
    detail: string;
  }
> = {
  gold: {
    aura: "bg-[radial-gradient(circle,_rgba(251,191,36,0.32),_transparent_68%)]",
    wash:
      "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_36%),radial-gradient(circle_at_bottom,_rgba(245,158,11,0.08),_transparent_48%)]",
    foundation: "bg-[linear-gradient(180deg,rgba(19,17,12,0.96),rgba(17,14,10,0.9))]",
    dot: "bg-amber-200 shadow-[0_0_20px_rgba(253,230,138,0.65)]",
    dotPulse: "bg-amber-200/60",
    eyebrow: "text-amber-100/75",
    badge: "border-amber-100/15 bg-amber-300/10 text-amber-50/90",
    title: "text-white",
    detail: "text-amber-50/88",
  },
  rose: {
    aura: "bg-[radial-gradient(circle,_rgba(251,113,133,0.32),_transparent_68%)]",
    wash:
      "bg-[radial-gradient(circle_at_top,_rgba(251,113,133,0.18),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(253,186,116,0.08),_transparent_48%)]",
    foundation: "bg-[linear-gradient(180deg,rgba(24,11,16,0.95),rgba(18,11,16,0.9))]",
    dot: "bg-rose-200 shadow-[0_0_20px_rgba(254,205,211,0.6)]",
    dotPulse: "bg-rose-200/55",
    eyebrow: "text-rose-100/78",
    badge: "border-rose-100/15 bg-rose-300/10 text-rose-50/90",
    title: "text-white",
    detail: "text-white/74",
  },
  violet: {
    aura: "bg-[radial-gradient(circle,_rgba(129,140,248,0.28),_transparent_68%)]",
    wash:
      "bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.2),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.08),_transparent_48%)]",
    foundation: "bg-[linear-gradient(180deg,rgba(11,14,28,0.95),rgba(10,12,24,0.9))]",
    dot: "bg-indigo-200 shadow-[0_0_20px_rgba(199,210,254,0.6)]",
    dotPulse: "bg-indigo-200/55",
    eyebrow: "text-indigo-100/78",
    badge: "border-indigo-100/15 bg-indigo-300/10 text-indigo-50/90",
    title: "text-white",
    detail: "text-white/72",
  },
  sky: {
    aura: "bg-[radial-gradient(circle,_rgba(56,189,248,0.3),_transparent_68%)]",
    wash:
      "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(34,197,94,0.08),_transparent_48%)]",
    foundation: "bg-[linear-gradient(180deg,rgba(9,16,24,0.95),rgba(8,14,21,0.9))]",
    dot: "bg-sky-200 shadow-[0_0_20px_rgba(186,230,253,0.6)]",
    dotPulse: "bg-sky-200/55",
    eyebrow: "text-sky-100/78",
    badge: "border-sky-100/15 bg-sky-300/10 text-sky-50/90",
    title: "text-white",
    detail: "text-white/72",
  },
  amber: {
    aura: "bg-[radial-gradient(circle,_rgba(251,146,60,0.3),_transparent_68%)]",
    wash:
      "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.2),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(245,158,11,0.08),_transparent_48%)]",
    foundation: "bg-[linear-gradient(180deg,rgba(26,15,8,0.95),rgba(21,12,7,0.9))]",
    dot: "bg-amber-200 shadow-[0_0_20px_rgba(253,230,138,0.6)]",
    dotPulse: "bg-amber-200/55",
    eyebrow: "text-amber-100/78",
    badge: "border-amber-100/15 bg-amber-300/10 text-amber-50/90",
    title: "text-amber-50",
    detail: "text-amber-50/74",
  },
};

const VARIANT_STYLES: Record<
  AnnouncementVariant,
  {
    shell: string;
    eyebrow: string;
    title: string;
    detail: string;
    badge: string;
    contentGap: string;
    titleWeight: string;
    detailTone: string;
  }
> = {
  desktop: {
    shell: "w-full max-w-[760px] rounded-[2rem] px-7 py-6",
    eyebrow: "text-[11px] tracking-[0.28em]",
    title: "text-[2rem] leading-tight",
    detail: "text-[15px] leading-6",
    badge: "px-3.5 py-1.5 text-[11px] tracking-[0.18em]",
    contentGap: "space-y-4",
    titleWeight: "",
    detailTone: "",
  },
  mobile: {
    shell: "w-full rounded-[1.6rem] px-5 py-4",
    eyebrow: "text-[10px] tracking-[0.24em]",
    title: "text-[1.35rem] leading-tight",
    detail: "text-[13px] leading-5",
    badge: "px-3 py-1 text-[10px] tracking-[0.16em]",
    contentGap: "space-y-3",
    titleWeight: "drop-shadow-[0_4px_18px_rgba(2,6,23,0.5)]",
    detailTone: "text-white/90",
  },
};

export default function AnnouncementBanner({
  eyebrow,
  title,
  detail,
  badge,
  tone = "violet",
  variant = "desktop",
  children,
}: AnnouncementBannerProps) {
  const toneStyles = TONE_STYLES[tone];
  const variantStyles = VARIANT_STYLES[variant];
  const isMobile = variant === "mobile";
  const auraClass = isMobile
    ? "absolute -inset-2 rounded-[2rem] opacity-78 blur-xl"
    : "absolute -inset-3 rounded-[2.2rem] opacity-65 blur-xl";
  const shellShadow = isMobile
    ? "shadow-[0_22px_56px_rgba(2,6,23,0.52)]"
    : "shadow-[0_18px_48px_rgba(0,0,0,0.3)]";
  const topGlossClass = isMobile
    ? "absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.018)_44%,rgba(255,255,255,0.01))]"
    : "absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_48%,rgba(255,255,255,0.02))]";
  const shellBaseClass = isMobile
    ? "border-white/18 bg-slate-950/98 ring-1 ring-black/25"
    : "border-white/12 bg-slate-950/92";
  const shellVignetteClass = isMobile
    ? "absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.16)_48%,rgba(2,6,23,0.32))]"
    : "absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.1)_54%,rgba(2,6,23,0.16))]";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -10 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="relative isolate transform-gpu"
    >
      <div className={`${auraClass} ${toneStyles.aura}`} />

      <div
        className={`relative overflow-hidden border text-center text-white ${shellShadow} ${shellBaseClass} ${variantStyles.shell}`}
      >
        <div className={`absolute inset-0 ${toneStyles.foundation}`} />
        <div className={topGlossClass} />
        <div className={`absolute inset-0 ${toneStyles.wash}`} />
        <div className={shellVignetteClass} />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

        <div className={`relative ${variantStyles.contentGap}`}>
          <div className="flex items-center justify-between gap-3">
            <div className={`flex min-w-0 items-center gap-3 font-semibold uppercase ${variantStyles.eyebrow} ${toneStyles.eyebrow}`}>
              <span className="relative flex h-3 w-3 shrink-0">
                {!isMobile && (
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${toneStyles.dotPulse}`} />
                )}
                <span className={`relative inline-flex h-3 w-3 rounded-full ${toneStyles.dot}`} />
              </span>
              <span className="truncate">{eyebrow}</span>
            </div>

            {badge && (
              <div
                className={`shrink-0 rounded-full border font-semibold uppercase ${variantStyles.badge} ${toneStyles.badge}`}
              >
                {badge}
              </div>
            )}
          </div>

          {children}

          <div className="space-y-2">
            <div className={`font-black tracking-tight ${variantStyles.title} ${variantStyles.titleWeight} ${toneStyles.title}`}>
              {title}
            </div>
            {detail && (
              <div className={`mx-auto max-w-[38rem] font-medium ${variantStyles.detail} ${toneStyles.detail} ${variantStyles.detailTone}`}>
                {detail}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
