"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  MOBILE_OVERLAY_Z,
  MOBILE_SHELL,
  getMobileSheetPaddingBottom,
} from "lib/mobileShell.mjs";

const MOBILE_SHEET_TRANSITION = { type: "spring", stiffness: 400, damping: 30 };

interface MobileBottomSheetProps {
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
  handleClassName?: string;
  sheetZIndex?: number;
  scrimZIndex?: number;
  bottomPaddingExtraPx?: number;
  draggable?: boolean;
  style?: React.CSSProperties;
}

export default function MobileBottomSheet({
  children,
  onDismiss,
  className = "",
  handleClassName = "bg-gray-300 dark:bg-gray-700",
  sheetZIndex = MOBILE_OVERLAY_Z.sheet,
  scrimZIndex = MOBILE_OVERLAY_Z.sheetScrim,
  bottomPaddingExtraPx,
  draggable = true,
  style,
}: MobileBottomSheetProps) {
  return (
    <>
      <motion.div
        className="overlay-scrim-strong absolute inset-0"
        style={{ zIndex: scrimZIndex }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      />
      <motion.div
        className={`absolute bottom-0 left-0 right-0 rounded-t-3xl ${className}`}
        style={{
          zIndex: sheetZIndex,
          paddingBottom: getMobileSheetPaddingBottom(bottomPaddingExtraPx),
          ...style,
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={MOBILE_SHEET_TRANSITION}
        drag={draggable ? "y" : false}
        dragConstraints={draggable ? { top: 0 } : undefined}
        onDragEnd={draggable
          ? (_event: unknown, info: { offset: { y: number } }) => {
              if (info.offset.y > MOBILE_SHELL.sheetDismissOffsetPx) onDismiss();
            }
          : undefined}
      >
        <div className={`mx-auto mb-5 h-1 w-10 rounded-full ${handleClassName}`} />
        {children}
      </motion.div>
    </>
  );
}
