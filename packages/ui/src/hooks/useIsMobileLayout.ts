"use client";

import { useSyncExternalStore } from "react";
import { shouldUseMobileTableLayout } from "../lib/tableLayoutMode";

function getIsMobileLayout() {
  if (typeof window === "undefined") return false;

  return shouldUseMobileTableLayout({
    width: window.innerWidth,
    height: window.innerHeight,
    hasCoarsePointer: window.matchMedia("(pointer: coarse)").matches,
    hasNoHover: window.matchMedia("(hover: none)").matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

function addMediaListener(mediaQuery: MediaQueryList, listener: () => void) {
  if ("addEventListener" in mediaQuery) {
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }

  const legacyMediaQuery = mediaQuery as MediaQueryList & {
    addListener: (callback: () => void) => void;
    removeListener: (callback: () => void) => void;
  };
  legacyMediaQuery.addListener(listener);
  return () => legacyMediaQuery.removeListener(listener);
}

export function useIsMobileLayout(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};

      const mediaQueries = [
        window.matchMedia("(pointer: coarse)"),
        window.matchMedia("(hover: none)"),
        window.matchMedia("(orientation: portrait)"),
      ];
      const cleanups = mediaQueries.map((mediaQuery) => addMediaListener(mediaQuery, onStoreChange));
      const visualViewport = window.visualViewport;

      window.addEventListener("resize", onStoreChange);
      visualViewport?.addEventListener("resize", onStoreChange);

      return () => {
        window.removeEventListener("resize", onStoreChange);
        visualViewport?.removeEventListener("resize", onStoreChange);
        for (const cleanup of cleanups) cleanup();
      };
    },
    getIsMobileLayout,
    () => false,
  );
}
