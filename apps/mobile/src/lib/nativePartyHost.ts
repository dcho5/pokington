import Constants from "expo-constants";

function normalizeHostCandidate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^(https?|wss?):\/\//i, "")
    .replace(/\/+$/, "");
}

export function getExpoRequestHostname(): string | null {
  const constants = Constants as typeof Constants & {
    manifest2?: {
      extra?: {
        expoGo?: {
          developer?: {
            host?: string;
          };
        };
      };
    };
    manifest?: {
      debuggerHost?: string;
      hostUri?: string;
    };
  };

  return (
    normalizeHostCandidate(constants.expoConfig?.hostUri) ??
    normalizeHostCandidate(constants.manifest?.hostUri) ??
    normalizeHostCandidate(constants.manifest?.debuggerHost) ??
    normalizeHostCandidate(constants.manifest2?.extra?.expoGo?.developer?.host)
  );
}
