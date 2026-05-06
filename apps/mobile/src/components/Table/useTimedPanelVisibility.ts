import { useEffect, useState } from "react";

export function useTimedPanelVisibility({
  visible,
  startedAt,
  durationMs,
}: {
  visible: boolean;
  startedAt?: number | null;
  durationMs: number;
}) {
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
    const timer = setTimeout(() => setExpired(true), remainingMs);
    return () => clearTimeout(timer);
  }, [durationMs, startedAt, visible]);

  return visible && !expired;
}
