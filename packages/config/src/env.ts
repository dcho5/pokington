function readPublicEnv(name: string): string | null {
  return process.env[`NEXT_PUBLIC_${name}`]
    ?? process.env[`EXPO_PUBLIC_${name}`]
    ?? null;
}

export const env = {
  appEnv: readPublicEnv("APP_ENV"),
  partyKitHost: readPublicEnv("PARTYKIT_HOST"),
  webOrigin: readPublicEnv("WEB_ORIGIN"),
} as const;

export function requirePublicEnv(name: "APP_ENV" | "PARTYKIT_HOST" | "WEB_ORIGIN"): string {
  const value = readPublicEnv(name);
  if (value) return value;
  throw new Error(
    `Missing public environment variable: expected NEXT_PUBLIC_${name} or EXPO_PUBLIC_${name}.`,
  );
}
