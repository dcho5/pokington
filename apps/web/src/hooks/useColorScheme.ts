"use client";
import { useState, useEffect } from "react";

/**
 * Returns the current OS color scheme and re-renders on change.
 * Defaults to "dark" on the server (SSR-safe).
 */
export function useColorScheme(): "dark" | "light" {
  const [scheme, setScheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setScheme(mq.matches ? "dark" : "light");
    const handler = (e: MediaQueryListEvent) =>
      setScheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return scheme;
}
