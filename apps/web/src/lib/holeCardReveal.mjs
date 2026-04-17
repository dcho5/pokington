const PEEL_STORAGE_PREFIX = "pokington_card_peel_state:";
const AUTO_PEEL_STORAGE_KEY = "pokington_auto_peel_enabled";

export function canStartPublicReveal({
  isPrivatelyRevealed,
  canRevealToOthers,
  isRevealedToOthers,
  sevenTwoEligible,
}) {
  if (!canRevealToOthers || isRevealedToOthers) return false;

  // 7-2 claim windows should allow a single hold gesture to both flip and show.
  return isPrivatelyRevealed || sevenTwoEligible;
}

export function readPersistedPeelState(persistenceKey) {
  if (!persistenceKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${PEEL_STORAGE_PREFIX}${persistenceKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "boolean" &&
      typeof parsed[1] === "boolean"
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // Ignore malformed persisted state and fall back to a fresh hand.
  }
  return null;
}

export function writePersistedPeelState(persistenceKey, revealed) {
  if (!persistenceKey || typeof window === "undefined") return;
  const storageKey = `${PEEL_STORAGE_PREFIX}${persistenceKey}`;
  try {
    if (!revealed[0] && !revealed[1]) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(revealed));
  } catch {
    // Ignore storage failures; peel state still works for the current mount.
  }
}

export function getInitialPrivateRevealState({
  persistenceKey,
  autoReveal = false,
}) {
  const persisted = readPersistedPeelState(persistenceKey) ?? [false, false];
  return autoReveal ? [true, true] : persisted;
}

export function readPersistedAutoPeelPreference() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(AUTO_PEEL_STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function writePersistedAutoPeelPreference(enabled) {
  if (typeof window === "undefined") return;
  try {
    if (!enabled) {
      window.localStorage.removeItem(AUTO_PEEL_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTO_PEEL_STORAGE_KEY, JSON.stringify(true));
  } catch {
    // Ignore storage failures; the in-memory preference still applies.
  }
}
