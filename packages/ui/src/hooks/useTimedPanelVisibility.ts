"use client";

import { useEffect, useState } from "react";

interface UseTimedPanelVisibilityOptions {
  visible: boolean;
  startedAt: number | null | undefined;
  durationMs: number;
}

export function useTimedPanelVisibility({
  visible,
  startedAt,
  durationMs,
}: UseTimedPanelVisibilityOptions): boolean {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!visible) {
      setExpired(false);
      return;
    }
    if (startedAt == null) {
      setExpired(false);
      return;
    }

    const remainingMs = startedAt + durationMs - Date.now();
    if (remainingMs <= 0) {
      setExpired(true);
      return;
    }

    setExpired(false);
    const timer = window.setTimeout(() => setExpired(true), remainingMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, startedAt, visible]);

  return visible && !expired;
}
