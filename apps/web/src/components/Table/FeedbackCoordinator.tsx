"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useIsMobileLayout } from "hooks/useIsMobileLayout";
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
  const platformRef = useRef(createWebFeedbackPlatform());
  const seenKeysRef = useRef(new Set<string>());
  const armedHandNumbersRef = useRef(new Set<number>());

  useEffect(() => {
    return () => platformRef.current.dispose?.();
  }, []);

  const dispatchEvent = useCallback((event: TableFeedbackPlaybackEvent) => {
    if (!markFeedbackKey(seenKeysRef.current, event.key)) return;

    const context = {
      myPlayerId: useGameStore.getState().myPlayerId,
      isMobile: isMobileLayout,
    };
    if (!isPlayableEvent(event, context.myPlayerId)) return;

    platformRef.current.playSound(event.kind, event, context);
    const hapticPattern = getFeedbackHapticPattern(event, context);
    if (hapticPattern) {
      platformRef.current.playHaptic(hapticPattern, event, context);
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
