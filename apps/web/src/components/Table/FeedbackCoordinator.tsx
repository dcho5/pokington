"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useIsMobileLayout } from "@pokington/ui/web/useIsMobileLayout";
import {
  createWebFeedbackPlatform,
  getFeedbackHapticPattern,
  type TableFeedbackPlaybackEvent,
  type TableVisualFeedbackEvent,
} from "lib/feedbackPlatform";
import { markFeedbackKey } from "lib/tableFeedback.mjs";
import { subscribeToTableFeedback, type TableFeedbackEvent, useGameStore } from "store/useGameStore";

const VisualFeedbackContext = createContext<(event: TableVisualFeedbackEvent) => void>(() => {});

function isPlayableEvent(event: TableFeedbackPlaybackEvent, myPlayerId: string | null) {
  if (event.kind === "turn_changed") {
    return event.actorId === myPlayerId;
  }
  return true;
}

export function TableFeedbackProvider({ children }: { children: React.ReactNode }) {
  const isMobileLayout = useIsMobileLayout();
  const platformRef = useRef<ReturnType<typeof createWebFeedbackPlatform> | null>(null);
  const seenKeysRef = useRef(new Set<string>());
  const armedHandNumbersRef = useRef(new Set<number>());

  if (platformRef.current == null) {
    platformRef.current = createWebFeedbackPlatform();
  }

  useEffect(() => {
    const primeFeedback = () => platformRef.current?.prime();
    const primeOnVisible = () => {
      if (typeof document === "undefined" || !document.hidden) {
        primeFeedback();
      }
    };
    const gestureOptions: AddEventListenerOptions = { capture: true, passive: true };

    window.addEventListener("pointerdown", primeFeedback, gestureOptions);
    window.addEventListener("touchstart", primeFeedback, gestureOptions);
    window.addEventListener("click", primeFeedback, gestureOptions);
    window.addEventListener("keydown", primeFeedback, { capture: true });
    window.addEventListener("focus", primeOnVisible);
    window.addEventListener("pageshow", primeOnVisible);
    document.addEventListener("visibilitychange", primeOnVisible);

    return () => {
      window.removeEventListener("pointerdown", primeFeedback, gestureOptions);
      window.removeEventListener("touchstart", primeFeedback, gestureOptions);
      window.removeEventListener("click", primeFeedback, gestureOptions);
      window.removeEventListener("keydown", primeFeedback, { capture: true });
      window.removeEventListener("focus", primeOnVisible);
      window.removeEventListener("pageshow", primeOnVisible);
      document.removeEventListener("visibilitychange", primeOnVisible);
      platformRef.current?.dispose?.();
      platformRef.current = null;
    };
  }, []);

  const dispatchEvent = useCallback((event: TableFeedbackPlaybackEvent) => {
    if (!markFeedbackKey(seenKeysRef.current, event.key)) return;
    const platform = platformRef.current;
    if (!platform) return;

    const context = {
      myPlayerId: useGameStore.getState().myPlayerId,
      isMobile: isMobileLayout,
    };
    if (!isPlayableEvent(event, context.myPlayerId)) return;

    platform.playSound(event.kind, event, context);
    const hapticPattern = getFeedbackHapticPattern(event, context);
    if (hapticPattern) {
      platform.playHaptic(hapticPattern, event, context);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    return subscribeToTableFeedback((storeEvent: TableFeedbackEvent) => {
      if (storeEvent.kind === "feedback") {
        if (storeEvent.feedback.length > 0) {
          for (const cue of storeEvent.feedback) {
            armedHandNumbersRef.current.add(cue.handNumber);
            if (armedHandNumbersRef.current.size > 8) {
              const oldest = armedHandNumbersRef.current.values().next().value;
              if (oldest != null) armedHandNumbersRef.current.delete(oldest);
            }
          }
        }
        for (const cue of storeEvent.feedback) {
          dispatchEvent(cue);
        }
        return;
      }
      dispatchEvent(storeEvent);
    });
  }, [dispatchEvent]);

  const emitVisualFeedback = useMemo(
    () => (event: TableVisualFeedbackEvent) => {
      if (!armedHandNumbersRef.current.has(event.handNumber)) return;
      dispatchEvent(event);
    },
    [dispatchEvent],
  );

  return (
    <VisualFeedbackContext.Provider value={emitVisualFeedback}>
      {children}
    </VisualFeedbackContext.Provider>
  );
}

export function useTableVisualFeedback() {
  return useContext(VisualFeedbackContext);
}
