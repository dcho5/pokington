import type { TableBlinds } from "@pokington/network";

export const SEATED_TABLES_STORAGE_KEY = "pokington_seated_tables:v1";

const MAX_SEATED_TABLES = 5;
const TABLE_CODE_RE = /^[A-Z0-9]{6}$/;

export interface SeatedTableRecord {
  code: string;
  tableName: string;
  playerName: string;
  playerSessionId: string;
  blinds: TableBlinds;
  lastSeenAt: number;
}

export interface SeatedTablesStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
}

function normalizeCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function isRecord(value: unknown): value is SeatedTableRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SeatedTableRecord>;
  return (
    typeof record.code === "string" &&
    TABLE_CODE_RE.test(record.code) &&
    typeof record.tableName === "string" &&
    typeof record.playerName === "string" &&
    typeof record.playerSessionId === "string" &&
    typeof record.lastSeenAt === "number" &&
    !!record.blinds &&
    typeof record.blinds.small === "number" &&
    typeof record.blinds.big === "number"
  );
}

function sortAndTrim(records: SeatedTableRecord[]) {
  return records
    .filter((record) => TABLE_CODE_RE.test(record.code))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, MAX_SEATED_TABLES);
}

export async function getSeatedTables(storage: SeatedTablesStorage): Promise<SeatedTableRecord[]> {
  const raw = await storage.getItem(SEATED_TABLES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortAndTrim(parsed.filter(isRecord));
  } catch {
    return [];
  }
}

export async function upsertSeatedTable(
  storage: SeatedTablesStorage,
  record: Omit<SeatedTableRecord, "code" | "lastSeenAt"> & {
    code: string;
    lastSeenAt?: number;
  },
): Promise<SeatedTableRecord[]> {
  const code = normalizeCode(record.code);
  if (!TABLE_CODE_RE.test(code)) return getSeatedTables(storage);

  const current = await getSeatedTables(storage);
  const nextRecord: SeatedTableRecord = {
    code,
    tableName: record.tableName.trim() || `Table ${code}`,
    playerName: record.playerName.trim() || "Player",
    playerSessionId: record.playerSessionId,
    blinds: record.blinds,
    lastSeenAt: record.lastSeenAt ?? Date.now(),
  };
  const next = sortAndTrim([
    nextRecord,
    ...current.filter((candidate) => candidate.code !== code),
  ]);
  await storage.setItem(SEATED_TABLES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeSeatedTable(
  storage: SeatedTablesStorage,
  code: string,
): Promise<SeatedTableRecord[]> {
  const normalizedCode = normalizeCode(code);
  const next = (await getSeatedTables(storage)).filter((record) => record.code !== normalizedCode);
  await storage.setItem(SEATED_TABLES_STORAGE_KEY, JSON.stringify(next));
  return next;
}
