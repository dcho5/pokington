"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COPY_FEEDBACK_MS = 1800;

function getShareUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!didCopy) {
    throw new Error("Clipboard copy failed");
  }
}

export function useCopyCurrentUrl() {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }
  }, []);

  const copyLink = useCallback(async () => {
    if (typeof window === "undefined") return false;

    const shareUrl = getShareUrl();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        fallbackCopyText(shareUrl);
      }

      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
      setCopied(true);
      resetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimeoutRef.current = null;
      }, COPY_FEEDBACK_MS);
      return true;
    } catch {
      try {
        fallbackCopyText(shareUrl);
        if (resetTimeoutRef.current !== null) {
          window.clearTimeout(resetTimeoutRef.current);
        }
        setCopied(true);
        resetTimeoutRef.current = window.setTimeout(() => {
          setCopied(false);
          resetTimeoutRef.current = null;
        }, COPY_FEEDBACK_MS);
        return true;
      } catch {
        setCopied(false);
        return false;
      }
    }
  }, []);

  return {
    copied,
    copyLink,
  };
}
